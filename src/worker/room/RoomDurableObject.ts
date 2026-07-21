import { DurableObject } from "cloudflare:workers";
import { z } from "zod";

import {
  CanvasOperationRecordSchema,
  CanvasOperationSchema,
  type CanvasOperation,
  type CanvasOperationRecord,
  type DrawableCanvasLayer,
} from "../../shared/canvas";
import {
  classifyBridgeInput,
  HERO_BRIDGE_PARAMETERS,
} from "../../shared/domain/bridge";
import {
  ManualAttemptSchema,
  RoomFeedEventSchema,
  SimulationRunSchema,
  SocketAuthMessageSchema,
  SocketAuthenticatedMessageSchema,
  type ManualAttempt,
  type RoomBootstrap,
  type RoomFeedEvent,
  type RoomRole,
  type SimulationRun,
  type SocketAuthenticatedMessage,
  type SocketServerMessage,
} from "../../shared/protocol";
import type { WorkerEnv } from "../env";
import {
  constantTimeEqual,
  deriveStudentCapability,
  hashCapability,
} from "../security/capabilities";
import { CREATE_ROOM_SCHEMA_SQL, ROOM_SCHEMA_ID } from "./room-schema";

const InitializationSchema = z
  .object({
    fixtureId: z.string().min(1).max(64),
    roomId: z.string().regex(/^rm_[A-Za-z0-9_-]{20,40}$/u),
    studentCapabilityHash: z.string().min(40).max(64),
    teacherCapabilityHash: z.string().min(40).max(64),
  })
  .strict();

type Initialization = z.infer<typeof InitializationSchema>;

type RoomMetaRow = {
  created_at: string;
  fixture_id: string;
  next_seq: number;
  room_id: string;
  schema_id: string;
  student_capability_hash: string;
  teacher_capability_hash: string;
};

type RoomEventRow = {
  created_at: string;
  payload_json: string;
  seq: number;
  type: string;
  visible_to: "all" | "teacher";
};

type CanvasOperationRow = {
  author_id: string;
  created_at: string;
  layer: DrawableCanvasLayer;
  payload_json: string;
  seq: number;
};

type AttemptRow = {
  author_id: string;
  created_at: string;
  id: string;
  source_canvas_seq: number;
  status: string;
  task_id: string;
};

type SimulationRunRow = {
  attempt_id: string;
  created_at: string;
  id: string;
  inputs_json: string;
  outcome_json: string;
  presentation_variant: string;
  random_seed: string;
  room_seq: number;
  template_id: string;
  template_version: number;
};

type SocketAttachment = {
  clientId: string;
  role: RoomRole;
};

export class RoomDurableObject extends DurableObject<WorkerEnv> {
  constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(CREATE_ROOM_SCHEMA_SQL);
  }

  ping(): string {
    return "room-runtime-ready";
  }

  acquireAttemptProcessingLock(attemptId: string): boolean {
    const parsedAttemptId = z.string().min(8).max(128).parse(attemptId);
    let acquired = false;
    this.ctx.storage.transactionSync(() => {
      const lock = this.ctx.storage.sql
        .exec<{ active_attempt_id: string | null }>(
          "SELECT active_attempt_id FROM room_locks WHERE singleton = 1",
        )
        .toArray()[0];
      if (lock?.active_attempt_id) return;
      this.ctx.storage.sql.exec(
        "UPDATE room_locks SET active_attempt_id = ? WHERE singleton = 1",
        parsedAttemptId,
      );
      acquired = true;
    });
    return acquired;
  }

  releaseAttemptProcessingLock(attemptId: string): boolean {
    const parsedAttemptId = z.string().min(8).max(128).parse(attemptId);
    const lock = this.ctx.storage.sql
      .exec<{ active_attempt_id: string | null }>(
        "SELECT active_attempt_id FROM room_locks WHERE singleton = 1",
      )
      .toArray()[0];
    if (lock?.active_attempt_id !== parsedAttemptId) return false;
    this.ctx.storage.sql.exec(
      "UPDATE room_locks SET active_attempt_id = NULL WHERE singleton = 1",
    );
    return true;
  }

  initialize(input: Initialization, events: RoomFeedEvent[]): void {
    const initialization = InitializationSchema.parse(input);
    const parsedEvents = events.map((event) =>
      RoomFeedEventSchema.parse(event),
    );
    const existing = this.roomMeta();

    if (existing !== null) {
      if (existing.room_id !== initialization.roomId) {
        throw new Error("Room identity mismatch");
      }
      return;
    }

    const createdAt = parsedEvents[0]?.createdAt ?? new Date().toISOString();
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `INSERT INTO room_meta (
          singleton, room_id, schema_id, fixture_id,
          teacher_capability_hash, student_capability_hash, next_seq, created_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
        initialization.roomId,
        ROOM_SCHEMA_ID,
        initialization.fixtureId,
        initialization.teacherCapabilityHash,
        initialization.studentCapabilityHash,
        parsedEvents.length + 1,
        createdAt,
      );

      for (const event of parsedEvents) {
        this.ctx.storage.sql.exec(
          `INSERT INTO room_events (seq, type, visible_to, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          event.seq,
          event.type,
          event.visibility,
          JSON.stringify(event.payload),
          event.createdAt,
        );
      }
    });
  }

  async bootstrap(capability: string): Promise<RoomBootstrap | null> {
    const meta = this.roomMeta();
    if (meta === null) return null;
    const role = await this.roleForCapability(meta, capability);
    if (role === null) return null;
    return this.snapshot(meta, role, capability);
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof message !== "string") {
      this.rejectCommand(socket, undefined, "invalid_command");
      return;
    }
    const parsedJson: unknown = (() => {
      try {
        return JSON.parse(message) as unknown;
      } catch {
        return null;
      }
    })();
    const attachment =
      socket.deserializeAttachment() as SocketAttachment | null;

    if (attachment === null) {
      const auth = SocketAuthMessageSchema.safeParse(parsedJson);
      if (!auth.success) {
        this.rejectSocket(socket);
        return;
      }
      const snapshot = await this.bootstrap(auth.data.payload.token);
      if (snapshot === null) {
        this.rejectSocket(socket);
        return;
      }
      socket.serializeAttachment({
        clientId: auth.data.clientId,
        role: snapshot.role,
      } satisfies SocketAttachment);
      this.send(socket, {
        payload: { role: snapshot.role },
        type: "auth.accepted",
        v: 1,
      });
      this.send(socket, { payload: snapshot, type: "room.snapshot", v: 1 });
      return;
    }

    const command = SocketAuthenticatedMessageSchema.safeParse(parsedJson);
    if (!command.success || command.data.clientId !== attachment.clientId) {
      this.rejectCommand(socket, undefined, "invalid_command");
      return;
    }
    await this.handleCommand(socket, attachment, command.data);
  }

  override webSocketClose(): void {
    // Hibernation callback is state-free; SQLite and socket attachments are authoritative.
  }

  private async handleCommand(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: SocketAuthenticatedMessage,
  ): Promise<void> {
    if (message.type === "room.resume") {
      await this.resume(socket, attachment, message.payload.lastSeenSeq);
      return;
    }
    if (message.type === "canvas.operation") {
      this.acceptCanvasOperation(socket, attachment, message);
      return;
    }
    this.captureManualAttempt(socket, attachment, message);
  }

  private async resume(
    socket: WebSocket,
    attachment: SocketAttachment,
    lastSeenSeq: number,
  ): Promise<void> {
    const meta = this.roomMeta();
    if (meta === null) return;
    const currentSeq = meta.next_seq - 1;
    if (lastSeenSeq > currentSeq || currentSeq - lastSeenSeq > 500) {
      this.send(socket, {
        payload: await this.snapshot(meta, attachment.role),
        type: "room.snapshot",
        v: 1,
      });
      return;
    }

    const runs = this.simulationRunsAfter(lastSeenSeq);
    const attemptIds = runs.map((run) => run.attemptId);
    this.send(socket, {
      payload: {
        attempts: this.attemptsById(attemptIds),
        canvasOperations: this.canvasOperationsAfter(lastSeenSeq),
        fromSeq: lastSeenSeq,
        simulationRuns: runs,
        toSeq: currentSeq,
      },
      type: "room.delta",
      v: 1,
    });
  }

  private acceptCanvasOperation(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: Extract<SocketAuthenticatedMessage, { type: "canvas.operation" }>,
  ): void {
    const operation = CanvasOperationSchema.parse(message.payload.operation);
    const duplicate = this.ctx.storage.sql
      .exec<{ seq: number }>(
        "SELECT seq FROM canvas_operations WHERE client_operation_id = ?",
        operation.clientOperationId,
      )
      .toArray()[0];
    if (duplicate !== undefined) {
      this.ack(
        socket,
        message.requestId,
        operation.clientOperationId,
        duplicate.seq,
        true,
      );
      return;
    }

    const allowedLayer = this.allowedLayer(
      attachment.role,
      message.payload.previewAsStudent,
    );
    const operationLayer = this.operationLayer(operation);
    if (operationLayer === null || operationLayer !== allowedLayer) {
      this.rejectCommand(socket, message.requestId, "permission_denied");
      return;
    }

    const createdAt = new Date().toISOString();
    let seq = 0;
    this.ctx.storage.transactionSync(() => {
      seq = this.nextSequence();
      this.ctx.storage.sql.exec(
        `INSERT INTO canvas_operations (
          seq, client_operation_id, workspace_id, layer, author_id,
          operation_type, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        seq,
        operation.clientOperationId,
        operation.workspaceId,
        operationLayer,
        attachment.clientId,
        operation.operation,
        JSON.stringify(operation),
        createdAt,
      );
      this.ctx.storage.sql.exec(
        "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
        seq + 1,
      );
    });

    const record = CanvasOperationRecordSchema.parse({
      authorId: attachment.clientId,
      createdAt,
      layer: operationLayer,
      operation,
      seq,
    });
    this.ack(
      socket,
      message.requestId,
      operation.clientOperationId,
      seq,
      false,
    );
    this.broadcast({ payload: record, type: "canvas.operation", v: 1 });
  }

  private captureManualAttempt(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: Extract<
      SocketAuthenticatedMessage,
      { type: "attempt.manual-capture" }
    >,
  ): void {
    if (attachment.role === "teacher" && !message.payload.previewAsStudent) {
      this.rejectCommand(socket, message.requestId, "permission_denied");
      return;
    }

    const duplicateRow = this.ctx.storage.sql
      .exec<{ id: string }>(
        "SELECT id FROM attempts WHERE idempotency_key = ?",
        message.payload.idempotencyKey,
      )
      .toArray()[0];
    if (duplicateRow !== undefined) {
      const attempt = this.attemptsById([duplicateRow.id])[0];
      const run = this.simulationRunForAttempt(duplicateRow.id);
      if (attempt !== undefined && run !== null) {
        this.ack(
          socket,
          message.requestId,
          message.payload.idempotencyKey,
          run.roomSeq,
          true,
        );
        this.send(socket, {
          payload: { attempt, run },
          type: "simulation.launch",
          v: 1,
        });
      }
      return;
    }

    if (!this.validStudentCutoff(message.payload.sourceCanvasSeq)) {
      this.rejectCommand(socket, message.requestId, "stale_canvas_sequence");
      return;
    }

    const outcome = classifyBridgeInput(
      HERO_BRIDGE_PARAMETERS,
      message.payload.inputs,
    );
    const attemptId = `at_${crypto.randomUUID()}`;
    const runId = `run_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const randomSeed = crypto.randomUUID();
    let roomSeq = 0;

    if (!this.acquireAttemptProcessingLock(attemptId)) {
      this.rejectCommand(socket, message.requestId, "attempt_in_progress");
      return;
    }

    try {
      this.ctx.storage.transactionSync(() => {
        roomSeq = this.nextSequence();
        this.ctx.storage.sql.exec(
          `INSERT INTO attempts (
            id, idempotency_key, task_id, author_id,
            source_canvas_seq, status, created_at
          ) VALUES (?, ?, 'bridge-task-v1', ?, ?, 'completed', ?)`,
          attemptId,
          message.payload.idempotencyKey,
          attachment.clientId,
          message.payload.sourceCanvasSeq,
          createdAt,
        );
        this.ctx.storage.sql.exec(
          `INSERT INTO simulation_runs (
            id, attempt_id, room_seq, template_id, template_version,
            inputs_json, outcome_json, presentation_variant, random_seed, created_at
          ) VALUES (?, ?, ?, 'bridge', 1, ?, ?, 'ravine-rescue-v1', ?, ?)`,
          runId,
          attemptId,
          roomSeq,
          JSON.stringify(message.payload.inputs),
          JSON.stringify(outcome),
          randomSeed,
          createdAt,
        );
        this.ctx.storage.sql.exec(
          "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
          roomSeq + 1,
        );
      });
    } finally {
      this.releaseAttemptProcessingLock(attemptId);
    }

    const attempt = ManualAttemptSchema.parse({
      authorId: attachment.clientId,
      createdAt,
      id: attemptId,
      sourceCanvasSeq: message.payload.sourceCanvasSeq,
      status: "completed",
      taskId: "bridge-task-v1",
    });
    const run = SimulationRunSchema.parse({
      attemptId,
      createdAt,
      id: runId,
      inputs: message.payload.inputs,
      outcome,
      presentationVariant: "ravine-rescue-v1",
      randomSeed,
      roomSeq,
      templateId: "bridge",
      templateVersion: 1,
    });
    this.ack(
      socket,
      message.requestId,
      message.payload.idempotencyKey,
      roomSeq,
      false,
    );
    this.broadcast({
      payload: { attempt, run },
      type: "simulation.launch",
      v: 1,
    });
  }

  private allowedLayer(
    role: RoomRole,
    previewAsStudent: boolean,
  ): DrawableCanvasLayer {
    return role === "student" || previewAsStudent ? "student" : "teacher";
  }

  private operationLayer(
    operation: CanvasOperation,
  ): DrawableCanvasLayer | null {
    if (
      operation.operation === "stroke.add" ||
      operation.operation === "layer.clear"
    ) {
      return operation.layer;
    }
    const records = this.canvasOperations();
    const target = records.find(
      (record) =>
        record.operation.operation === "stroke.add" &&
        record.operation.strokeId === operation.targetStrokeId,
    );
    return target?.operation.operation === "stroke.add"
      ? target.operation.layer
      : null;
  }

  private validStudentCutoff(sourceCanvasSeq: number): boolean {
    if (sourceCanvasSeq === 0) return true;
    return (
      this.ctx.storage.sql
        .exec<{ seq: number }>(
          "SELECT seq FROM canvas_operations WHERE seq = ? AND layer = 'student'",
          sourceCanvasSeq,
        )
        .toArray()[0] !== undefined
    );
  }

  private nextSequence(): number {
    const row = this.ctx.storage.sql
      .exec<{ next_seq: number }>(
        "SELECT next_seq FROM room_meta WHERE singleton = 1",
      )
      .toArray()[0];
    if (row === undefined) throw new Error("Room is not initialized");
    return row.next_seq;
  }

  private ack(
    socket: WebSocket,
    requestId: string,
    idempotencyKey: string,
    roomSeq: number,
    duplicate: boolean,
  ): void {
    this.send(socket, {
      payload: { duplicate, idempotencyKey, requestId, roomSeq },
      type: "command.ack",
      v: 1,
    });
  }

  private rejectCommand(
    socket: WebSocket,
    requestId: string | undefined,
    reason: Extract<
      SocketServerMessage,
      { type: "command.rejected" }
    >["payload"]["reason"],
  ): void {
    const payload =
      requestId === undefined ? { reason } : { reason, requestId };
    this.send(socket, { payload, type: "command.rejected", v: 1 });
  }

  private rejectSocket(socket: WebSocket): void {
    this.send(socket, {
      payload: { reason: "unauthorized" },
      type: "auth.rejected",
      v: 1,
    });
    socket.close(1008, "Unauthorized");
  }

  private send(socket: WebSocket, message: SocketServerMessage): void {
    socket.send(JSON.stringify(message));
  }

  private broadcast(message: SocketServerMessage): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.deserializeAttachment() !== null) this.send(socket, message);
    }
  }

  private roomMeta(): RoomMetaRow | null {
    return (
      this.ctx.storage.sql
        .exec<RoomMetaRow>(
          `SELECT room_id, schema_id, fixture_id, teacher_capability_hash,
                  student_capability_hash, next_seq, created_at
           FROM room_meta WHERE singleton = 1`,
        )
        .toArray()[0] ?? null
    );
  }

  private async roleForCapability(
    meta: RoomMetaRow,
    capability: string,
  ): Promise<RoomRole | null> {
    const teacherHash = await hashCapability(
      this.env.ROOM_TOKEN_PEPPER,
      "teacher",
      capability,
    );
    if (constantTimeEqual(teacherHash, meta.teacher_capability_hash)) {
      return "teacher";
    }
    const studentHash = await hashCapability(
      this.env.ROOM_TOKEN_PEPPER,
      "student",
      capability,
    );
    return constantTimeEqual(studentHash, meta.student_capability_hash)
      ? "student"
      : null;
  }

  private canvasOperations(): CanvasOperationRecord[] {
    return this.canvasOperationRows(
      "SELECT seq, author_id, layer, payload_json, created_at FROM canvas_operations ORDER BY seq",
    );
  }

  private canvasOperationsAfter(seq: number): CanvasOperationRecord[] {
    return this.canvasOperationRows(
      "SELECT seq, author_id, layer, payload_json, created_at FROM canvas_operations WHERE seq > ? ORDER BY seq",
      seq,
    );
  }

  private canvasOperationRows(
    query: string,
    ...bindings: unknown[]
  ): CanvasOperationRecord[] {
    return this.ctx.storage.sql
      .exec<CanvasOperationRow>(query, ...bindings)
      .toArray()
      .map((row) =>
        CanvasOperationRecordSchema.parse({
          authorId: row.author_id,
          createdAt: row.created_at,
          layer: row.layer,
          operation: JSON.parse(row.payload_json) as unknown,
          seq: row.seq,
        }),
      );
  }

  private attempts(): ManualAttempt[] {
    return this.attemptRows(
      "SELECT id, task_id, author_id, source_canvas_seq, status, created_at FROM attempts ORDER BY created_at",
    );
  }

  private attemptsById(ids: string[]): ManualAttempt[] {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    return this.attempts().filter((attempt) => wanted.has(attempt.id));
  }

  private attemptRows(query: string): ManualAttempt[] {
    return this.ctx.storage.sql
      .exec<AttemptRow>(query)
      .toArray()
      .map((row) =>
        ManualAttemptSchema.parse({
          authorId: row.author_id,
          createdAt: row.created_at,
          id: row.id,
          sourceCanvasSeq: row.source_canvas_seq,
          status: row.status,
          taskId: row.task_id,
        }),
      );
  }

  private simulationRuns(): SimulationRun[] {
    return this.simulationRunRows(
      `SELECT id, attempt_id, room_seq, template_id, template_version,
              inputs_json, outcome_json, presentation_variant, random_seed, created_at
       FROM simulation_runs ORDER BY room_seq`,
    );
  }

  private simulationRunsAfter(seq: number): SimulationRun[] {
    return this.simulationRunRows(
      `SELECT id, attempt_id, room_seq, template_id, template_version,
              inputs_json, outcome_json, presentation_variant, random_seed, created_at
       FROM simulation_runs WHERE room_seq > ? ORDER BY room_seq`,
      seq,
    );
  }

  private simulationRunForAttempt(attemptId: string): SimulationRun | null {
    return (
      this.simulationRunRows(
        `SELECT id, attempt_id, room_seq, template_id, template_version,
                inputs_json, outcome_json, presentation_variant, random_seed, created_at
         FROM simulation_runs WHERE attempt_id = ?`,
        attemptId,
      )[0] ?? null
    );
  }

  private simulationRunRows(
    query: string,
    ...bindings: unknown[]
  ): SimulationRun[] {
    return this.ctx.storage.sql
      .exec<SimulationRunRow>(query, ...bindings)
      .toArray()
      .map((row) =>
        SimulationRunSchema.parse({
          attemptId: row.attempt_id,
          createdAt: row.created_at,
          id: row.id,
          inputs: JSON.parse(row.inputs_json) as unknown,
          outcome: JSON.parse(row.outcome_json) as unknown,
          presentationVariant: row.presentation_variant,
          randomSeed: row.random_seed,
          roomSeq: row.room_seq,
          templateId: row.template_id,
          templateVersion: row.template_version,
        }),
      );
  }

  private async snapshot(
    meta: RoomMetaRow,
    role: RoomRole,
    capability?: string,
  ): Promise<RoomBootstrap> {
    const query =
      role === "teacher"
        ? "SELECT seq, type, visible_to, payload_json, created_at FROM room_events ORDER BY seq"
        : "SELECT seq, type, visible_to, payload_json, created_at FROM room_events WHERE visible_to = 'all' ORDER BY seq";
    const events = this.ctx.storage.sql
      .exec<RoomEventRow>(query)
      .toArray()
      .map((row) =>
        RoomFeedEventSchema.parse({
          createdAt: row.created_at,
          payload: JSON.parse(row.payload_json) as unknown,
          seq: row.seq,
          type: row.type,
          visibility: row.visible_to,
        }),
      );

    const base = {
      attempts: this.attempts(),
      canvasOperations: this.canvasOperations(),
      createdAt: meta.created_at,
      events,
      fixtureId: meta.fixture_id,
      role,
      roomId: meta.room_id,
      roomSeq: meta.next_seq - 1,
      schemaId: ROOM_SCHEMA_ID,
      simulationRuns: this.simulationRuns(),
    } satisfies Omit<RoomBootstrap, "studentCapability">;

    if (role === "teacher" && capability !== undefined) {
      return {
        ...base,
        studentCapability: await deriveStudentCapability(
          this.env.ROOM_TOKEN_PEPPER,
          meta.room_id,
          capability,
        ),
      };
    }
    return base;
  }
}
