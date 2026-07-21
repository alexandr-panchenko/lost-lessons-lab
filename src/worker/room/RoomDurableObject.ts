import { DurableObject } from "cloudflare:workers";
import { z } from "zod";

import {
  RoomFeedEventSchema,
  SocketAuthMessageSchema,
  type RoomBootstrap,
  type RoomFeedEvent,
  type RoomRole,
  type SocketServerMessage,
} from "../../shared/protocol";
import {
  constantTimeEqual,
  deriveStudentCapability,
  hashCapability,
} from "../security/capabilities";
import type { WorkerEnv } from "../env";
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
    if (meta === null) {
      return null;
    }

    const role = await this.roleForCapability(meta, capability);
    if (role === null) {
      return null;
    }

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
    if (socket.deserializeAttachment() !== null) {
      return;
    }

    if (typeof message !== "string") {
      this.rejectSocket(socket);
      return;
    }

    const parsedJson: unknown = (() => {
      try {
        return JSON.parse(message) as unknown;
      } catch {
        return null;
      }
    })();
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

    const attachment: SocketAttachment = {
      clientId: auth.data.clientId,
      role: snapshot.role,
    };
    socket.serializeAttachment(attachment);
    this.send(socket, {
      payload: { role: snapshot.role },
      type: "auth.accepted",
      v: 1,
    });
    this.send(socket, { payload: snapshot, type: "room.snapshot", v: 1 });
  }

  override webSocketClose(): void {
    // Hibernation callback is intentionally state-free; SQLite remains authoritative.
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

  private roomMeta(): RoomMetaRow | null {
    const rows = this.ctx.storage.sql.exec<RoomMetaRow>(
      `SELECT room_id, schema_id, fixture_id, teacher_capability_hash,
              student_capability_hash, created_at
       FROM room_meta WHERE singleton = 1`,
    );
    return rows.toArray()[0] ?? null;
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

  private async snapshot(
    meta: RoomMetaRow,
    role: RoomRole,
    capability: string,
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
      createdAt: meta.created_at,
      events,
      fixtureId: meta.fixture_id,
      role,
      roomId: meta.room_id,
      schemaId: ROOM_SCHEMA_ID,
    } satisfies Omit<RoomBootstrap, "studentCapability">;

    if (role === "teacher") {
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
