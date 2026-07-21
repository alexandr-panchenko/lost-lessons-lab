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
  AiAttemptSchema,
  AnalysisFailureCategorySchema,
  AnalysisRecordSchema,
  AnalysisStatusSchema,
  AttemptMediaSchema,
  SolutionAnalysisSchema,
  SpeedSolutionAnalysisSchema,
  StructureSolutionAnalysisSchema,
  WaterSolutionAnalysisSchema,
  type AiAttempt,
  type AnalysisRecord,
  type AnalysisStatus,
  type AttemptMedia,
} from "../../shared/analysis-types";
import {
  AchievementAwardSchema,
  type AchievementAward,
} from "../../shared/achievement-types";
import {
  BridgeSimulationInputsSchema,
  classifyBridgeInput,
  HERO_BRIDGE_PARAMETERS,
} from "../../shared/domain/bridge";
import {
  WaterSimulationInputsSchema,
  classifyWaterInput,
} from "../../shared/domain/water";
import {
  SpeedSimulationInputsSchema,
  classifySpeedInput,
} from "../../shared/domain/speed";
import {
  StructureSimulationInputsSchema,
  classifyStructureInput,
} from "../../shared/domain/structure";
import {
  ManualAttemptSchema,
  RoomFeedEventSchema,
  SimulationRunSchema,
  SocketAuthMessageSchema,
  SocketAuthenticatedMessageSchema,
  type ManualAttempt,
  type RoomAttempt,
  type RoomBootstrap,
  type RoomFeedEvent,
  type RoomRole,
  type SimulationRun,
  type SocketAuthenticatedMessage,
  type SocketServerMessage,
} from "../../shared/protocol";
import type { WorkerEnv } from "../env";
import { bridgeAchievement } from "../domain/achievements";
import { waterAchievement } from "../domain/water-achievements";
import { speedAchievement } from "../domain/speed-achievements";
import { structureAchievement } from "../domain/structure-achievements";
import { waterFixtureById } from "../../../fixtures/water/packs";
import { speedFixtureById } from "../../../fixtures/speed/packs";
import { structureFixtureById } from "../../../fixtures/structure/packs";
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

type AnalysisAttemptRow = {
  author_id: string;
  created_at: string;
  id: string;
  media_id: string | null;
  room_seq: number;
  source_canvas_seq: number;
  status: AnalysisStatus;
  task_id: string;
};

type MediaRow = {
  byte_size: number;
  content_hash: string;
  content_type: "image/png";
  height: number;
  id: string;
  r2_key: string;
  width: number;
};

type AnalysisResultRow = {
  attempt_id: string;
  completed_at: string;
  disagreement: number;
  failure_category: string | null;
  latency_ms: number;
  model_id: string | null;
  response_id: string | null;
  result_json: string | null;
  used_repair: number;
};

type AchievementRow = {
  achievement_key: string;
  attempt_id: string;
  category: string;
  created_at: string;
  description: string;
  id: string;
  room_seq: number;
  title: string;
};

type SocketAttachment = {
  clientId: string;
  role: RoomRole;
};

const BeginAiAttemptSchema = z
  .object({
    authorId: z.string().min(8).max(128),
    capability: z.string().min(32).max(256),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
    idempotencyKey: z.string().min(8).max(128),
    previewAsStudent: z.boolean(),
    sourceCanvasSeq: z.number().int().nonnegative(),
  })
  .strict();

const CompleteAiAttemptSchema = z
  .object({
    analysis: SolutionAnalysisSchema,
    attemptId: z.string().min(8).max(128),
    disagreement: z.boolean(),
    inputs: BridgeSimulationInputsSchema,
    latencyMs: z.number().int().nonnegative(),
    modelId: z.string().min(1).max(80),
    responseId: z.string().min(1).max(160),
    usedRepair: z.boolean(),
  })
  .strict();

const CompleteWaterAiAttemptSchema = z
  .object({
    analysis: WaterSolutionAnalysisSchema,
    attemptId: z.string().min(8).max(128),
    disagreement: z.boolean(),
    inputs: WaterSimulationInputsSchema,
    latencyMs: z.number().int().nonnegative(),
    modelId: z.string().min(1).max(80),
    responseId: z.string().min(1).max(160),
    usedRepair: z.boolean(),
  })
  .strict();

const CompleteSpeedAiAttemptSchema = z
  .object({
    analysis: SpeedSolutionAnalysisSchema,
    attemptId: z.string().min(8).max(128),
    disagreement: z.boolean(),
    inputs: SpeedSimulationInputsSchema,
    latencyMs: z.number().int().nonnegative(),
    modelId: z.string().min(1).max(80),
    responseId: z.string().min(1).max(160),
    usedRepair: z.boolean(),
  })
  .strict();

const CompleteStructureAiAttemptSchema = z
  .object({
    analysis: StructureSolutionAnalysisSchema,
    attemptId: z.string().min(8).max(128),
    disagreement: z.boolean(),
    inputs: StructureSimulationInputsSchema,
    latencyMs: z.number().int().nonnegative(),
    modelId: z.string().min(1).max(80),
    responseId: z.string().min(1).max(160),
    usedRepair: z.boolean(),
  })
  .strict();

export class RoomDurableObject extends DurableObject<WorkerEnv> {
  constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(CREATE_ROOM_SCHEMA_SQL);
  }

  ping(): string {
    return "room-runtime-ready";
  }

  reserveHourlyRateLimit(scope: string, limit: number): boolean {
    const parsedScope = z.string().min(16).max(160).parse(scope);
    const parsedLimit = z.number().int().positive().max(10_000).parse(limit);
    const bucketStart = new Date(
      Math.floor(Date.now() / 3_600_000) * 3_600_000,
    ).toISOString();
    let accepted = false;
    this.ctx.storage.transactionSync(() => {
      const current = this.ctx.storage.sql
        .exec<{ count: number }>(
          "SELECT count FROM rate_limit_buckets WHERE scope = ? AND bucket_start = ?",
          parsedScope,
          bucketStart,
        )
        .toArray()[0]?.count;
      if ((current ?? 0) >= parsedLimit) return;
      this.ctx.storage.sql.exec(
        `INSERT INTO rate_limit_buckets (scope, bucket_start, count)
         VALUES (?, ?, 1)
         ON CONFLICT(scope, bucket_start) DO UPDATE SET count = count + 1`,
        parsedScope,
        bucketStart,
      );
      this.ctx.storage.sql.exec(
        "DELETE FROM rate_limit_buckets WHERE bucket_start < ?",
        bucketStart,
      );
      accepted = true;
    });
    return accepted;
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

  async beginAiAttempt(input: z.input<typeof BeginAiAttemptSchema>): Promise<
    | { attempt: AiAttempt; duplicate: boolean; ok: true }
    | {
        ok: false;
        reason:
          | "attempt_in_progress"
          | "permission_denied"
          | "rate_limited"
          | "stale_canvas_sequence"
          | "unauthorized";
      }
  > {
    const value = BeginAiAttemptSchema.parse(input);
    const meta = this.roomMeta();
    if (meta === null) return { ok: false, reason: "unauthorized" };
    const role = await this.roleForCapability(meta, value.capability);
    if (role === null) return { ok: false, reason: "unauthorized" };
    if (role === "teacher" && !value.previewAsStudent) {
      return { ok: false, reason: "permission_denied" };
    }

    const duplicateId = this.ctx.storage.sql
      .exec<{ id: string }>(
        "SELECT id FROM analysis_attempts WHERE idempotency_key = ?",
        value.idempotencyKey,
      )
      .toArray()[0]?.id;
    if (duplicateId !== undefined) {
      const attempt = this.analysisAttemptById(duplicateId);
      if (attempt !== null) return { attempt, duplicate: true, ok: true };
    }
    if (!this.validStudentCutoff(value.sourceCanvasSeq)) {
      return { ok: false, reason: "stale_canvas_sequence" };
    }

    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = this.ctx.storage.sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM analysis_attempts WHERE created_at >= ?",
        cutoff,
      )
      .toArray()[0]?.count;
    const roomLimit = Number.parseInt(this.env.AI_ROOM_LIMIT_PER_HOUR, 10);
    if ((recent ?? 0) >= roomLimit)
      return { ok: false, reason: "rate_limited" };

    const attemptId = `at_${crypto.randomUUID()}`;
    if (!this.acquireAttemptProcessingLock(attemptId)) {
      return { ok: false, reason: "attempt_in_progress" };
    }

    const createdAt = new Date().toISOString();
    const taskId =
      structureFixtureById(meta.fixture_id) !== undefined
        ? "structure-task-v1"
        : speedFixtureById(meta.fixture_id) !== undefined
          ? "speed-task-v1"
          : waterFixtureById(meta.fixture_id) !== undefined
            ? "water-task-v1"
            : "bridge-task-v1";
    let roomSeq = 0;
    try {
      this.ctx.storage.transactionSync(() => {
        roomSeq = this.nextSequence();
        this.ctx.storage.sql.exec(
          `INSERT INTO analysis_attempts (
            id, idempotency_key, task_id, author_id, source_canvas_seq,
            status, room_seq, media_id, created_at
          ) VALUES (?, ?, ?, ?, ?, 'uploading', ?, NULL, ?)`,
          attemptId,
          value.idempotencyKey,
          taskId,
          value.authorId,
          value.sourceCanvasSeq,
          roomSeq,
          createdAt,
        );
        this.ctx.storage.sql.exec(
          "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
          roomSeq + 1,
        );
      });
    } catch (error) {
      this.releaseAttemptProcessingLock(attemptId);
      throw error;
    }
    const attempt = this.analysisAttemptById(attemptId);
    if (attempt === null) throw new Error("Analysis attempt was not persisted");
    this.broadcast({
      payload: { attempt, stage: "uploading" },
      type: "analysis.status",
      v: 1,
    });
    return { attempt, duplicate: false, ok: true };
  }

  attachAiAttemptMedia(input: {
    attemptId: string;
    media: AttemptMedia;
    r2Key: string;
  }): AiAttempt {
    const attemptId = z.string().min(8).max(128).parse(input.attemptId);
    const media = AttemptMediaSchema.parse(input.media);
    const r2Key = z
      .string()
      .regex(
        /^rooms\/rm_[A-Za-z0-9_-]+\/attempts\/at_[^/]+\/[a-f0-9]{64}\.png$/u,
      )
      .parse(input.r2Key);
    const attempt = this.analysisAttemptById(attemptId);
    if (attempt === null || attempt.status !== "uploading") {
      throw new Error("Analysis attempt is not awaiting media");
    }
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `INSERT INTO media_objects (
          id, attempt_id, r2_key, content_hash, content_type,
          byte_size, width, height, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        media.id,
        attemptId,
        r2Key,
        media.contentHash,
        media.contentType,
        media.byteSize,
        media.width,
        media.height,
        new Date().toISOString(),
      );
      this.ctx.storage.sql.exec(
        "UPDATE analysis_attempts SET media_id = ? WHERE id = ?",
        media.id,
        attemptId,
      );
    });
    const updated = this.analysisAttemptById(attemptId);
    if (updated === null)
      throw new Error("Analysis attempt media was not attached");
    return updated;
  }

  setAnalysisStatus(attemptId: string, status: AnalysisStatus): AiAttempt {
    const parsedId = z.string().min(8).max(128).parse(attemptId);
    const parsedStatus = AnalysisStatusSchema.exclude([
      "complete",
      "failed",
    ]).parse(status);
    const current = this.analysisAttemptById(parsedId);
    if (
      current === null ||
      current.status === "complete" ||
      current.status === "failed"
    ) {
      throw new Error("Analysis attempt is not active");
    }
    let roomSeq = 0;
    this.ctx.storage.transactionSync(() => {
      roomSeq = this.nextSequence();
      this.ctx.storage.sql.exec(
        "UPDATE analysis_attempts SET status = ?, room_seq = ? WHERE id = ?",
        parsedStatus,
        roomSeq,
        parsedId,
      );
      this.ctx.storage.sql.exec(
        "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
        roomSeq + 1,
      );
    });
    const attempt = this.analysisAttemptById(parsedId);
    if (attempt === null) throw new Error("Analysis status was not persisted");
    this.broadcast({
      payload: { attempt, stage: parsedStatus },
      type: "analysis.status",
      v: 1,
    });
    return attempt;
  }

  completeAiAttempt(input: z.input<typeof CompleteAiAttemptSchema>): {
    achievement: AchievementAward;
    analysis: AnalysisRecord;
    attempt: AiAttempt;
    run: SimulationRun;
  } {
    const value = CompleteAiAttemptSchema.parse(input);
    const current = this.analysisAttemptById(value.attemptId);
    if (current === null || current.media === null) {
      throw new Error("Analysis attempt or media is missing");
    }
    if (current.status === "complete" || current.status === "failed") {
      throw new Error("Analysis attempt is already terminal");
    }
    const outcome = classifyBridgeInput(HERO_BRIDGE_PARAMETERS, value.inputs);
    const completedAt = new Date().toISOString();
    const runId = `run_${crypto.randomUUID()}`;
    const randomSeed = crypto.randomUUID();
    let roomSeq = 0;
    const achievement = bridgeAchievement({
      attemptId: value.attemptId,
      createdAt: completedAt,
      hadPriorIncorrectAttempt: this.hasPriorIncorrectAttempt("bridge"),
      outcome,
      roomSeq: this.nextSequence(),
    });
    this.ctx.storage.transactionSync(() => {
      roomSeq = this.nextSequence();
      this.ctx.storage.sql.exec(
        "UPDATE analysis_attempts SET status = 'complete', room_seq = ? WHERE id = ?",
        roomSeq,
        value.attemptId,
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO analysis_results (
          attempt_id, result_json, failure_category, disagreement, model_id,
          response_id, latency_ms, used_repair, completed_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        value.attemptId,
        JSON.stringify(value.analysis),
        value.disagreement ? 1 : 0,
        value.modelId,
        value.responseId,
        value.latencyMs,
        value.usedRepair ? 1 : 0,
        completedAt,
      );
      this.insertAchievement(achievement);
      this.ctx.storage.sql.exec(
        `INSERT INTO simulation_runs (
          id, attempt_id, room_seq, template_id, template_version,
          inputs_json, outcome_json, presentation_variant, random_seed, created_at
        ) VALUES (?, ?, ?, 'bridge', 1, ?, ?, 'ravine-rescue-v1', ?, ?)`,
        runId,
        value.attemptId,
        roomSeq,
        JSON.stringify(value.inputs),
        JSON.stringify(outcome),
        randomSeed,
        completedAt,
      );
      this.ctx.storage.sql.exec(
        "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
        roomSeq + 1,
      );
    });
    this.releaseAttemptProcessingLock(value.attemptId);
    const attempt = this.analysisAttemptById(value.attemptId);
    const analysis = this.analysisForAttempt(value.attemptId);
    const run = this.simulationRunForAttempt(value.attemptId);
    if (attempt === null || analysis === null || run === null) {
      throw new Error("Completed analysis state was not persisted");
    }
    this.broadcast({
      payload: { achievement, analysis, attempt, run },
      type: "analysis.completed",
      v: 1,
    });
    return { achievement, analysis, attempt, run };
  }

  completeWaterAiAttempt(input: z.input<typeof CompleteWaterAiAttemptSchema>): {
    achievement: AchievementAward;
    analysis: AnalysisRecord;
    attempt: AiAttempt;
    run: Extract<SimulationRun, { templateId: "water" }>;
  } {
    const value = CompleteWaterAiAttemptSchema.parse(input);
    const current = this.analysisAttemptById(value.attemptId);
    const meta = this.roomMeta();
    const fixture =
      meta === null ? undefined : waterFixtureById(meta.fixture_id);
    if (
      current === null ||
      current.media === null ||
      current.taskId !== "water-task-v1" ||
      fixture === undefined
    ) {
      throw new Error("Water analysis attempt, media, or fixture is missing");
    }
    if (current.status === "complete" || current.status === "failed") {
      throw new Error("Water analysis attempt is already terminal");
    }
    const outcome = classifyWaterInput(fixture.parameters, value.inputs);
    const completedAt = new Date().toISOString();
    const runId = `run_${crypto.randomUUID()}`;
    const randomSeed = crypto.randomUUID();
    let roomSeq = 0;
    const achievement = waterAchievement({
      attemptId: value.attemptId,
      createdAt: completedAt,
      hadPriorIncorrectAttempt: this.hasPriorIncorrectAttempt("water"),
      outcome,
      roomSeq: this.nextSequence(),
    });
    this.ctx.storage.transactionSync(() => {
      roomSeq = this.nextSequence();
      this.ctx.storage.sql.exec(
        "UPDATE analysis_attempts SET status = 'complete', room_seq = ? WHERE id = ?",
        roomSeq,
        value.attemptId,
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO analysis_results (
          attempt_id, result_json, failure_category, disagreement, model_id,
          response_id, latency_ms, used_repair, completed_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        value.attemptId,
        JSON.stringify(value.analysis),
        value.disagreement ? 1 : 0,
        value.modelId,
        value.responseId,
        value.latencyMs,
        value.usedRepair ? 1 : 0,
        completedAt,
      );
      this.insertAchievement(achievement);
      this.ctx.storage.sql.exec(
        `INSERT INTO simulation_runs (
          id, attempt_id, room_seq, template_id, template_version,
          inputs_json, outcome_json, presentation_variant, random_seed, created_at
        ) VALUES (?, ?, ?, 'water', 1, ?, ?, 'tank-splash-v1', ?, ?)`,
        runId,
        value.attemptId,
        roomSeq,
        JSON.stringify(value.inputs),
        JSON.stringify(outcome),
        randomSeed,
        completedAt,
      );
      this.ctx.storage.sql.exec(
        "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
        roomSeq + 1,
      );
    });
    this.releaseAttemptProcessingLock(value.attemptId);
    const attempt = this.analysisAttemptById(value.attemptId);
    const analysis = this.analysisForAttempt(value.attemptId);
    const run = this.simulationRunForAttempt(value.attemptId);
    if (
      attempt === null ||
      analysis === null ||
      run === null ||
      run.templateId !== "water"
    ) {
      throw new Error("Completed water analysis state was not persisted");
    }
    this.broadcast({
      payload: { achievement, analysis, attempt, run },
      type: "analysis.completed",
      v: 1,
    });
    return { achievement, analysis, attempt, run };
  }

  completeSpeedAiAttempt(input: z.input<typeof CompleteSpeedAiAttemptSchema>): {
    achievement: AchievementAward;
    analysis: AnalysisRecord;
    attempt: AiAttempt;
    run: Extract<SimulationRun, { templateId: "speed" }>;
  } {
    const value = CompleteSpeedAiAttemptSchema.parse(input);
    const current = this.analysisAttemptById(value.attemptId);
    const meta = this.roomMeta();
    const fixture =
      meta === null ? undefined : speedFixtureById(meta.fixture_id);
    if (
      current === null ||
      current.media === null ||
      current.taskId !== "speed-task-v1" ||
      fixture === undefined
    ) {
      throw new Error("Speed analysis attempt, media, or fixture is missing");
    }
    if (current.status === "complete" || current.status === "failed") {
      throw new Error("Speed analysis attempt is already terminal");
    }
    const outcome = classifySpeedInput(fixture.parameters, value.inputs);
    const completedAt = new Date().toISOString();
    const runId = `run_${crypto.randomUUID()}`;
    const randomSeed = crypto.randomUUID();
    let roomSeq = 0;
    const achievement = speedAchievement({
      attemptId: value.attemptId,
      createdAt: completedAt,
      hadPriorIncorrectAttempt: this.hasPriorIncorrectAttempt("speed"),
      outcome,
      roomSeq: this.nextSequence(),
    });
    this.ctx.storage.transactionSync(() => {
      roomSeq = this.nextSequence();
      this.ctx.storage.sql.exec(
        "UPDATE analysis_attempts SET status = 'complete', room_seq = ? WHERE id = ?",
        roomSeq,
        value.attemptId,
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO analysis_results (
          attempt_id, result_json, failure_category, disagreement, model_id,
          response_id, latency_ms, used_repair, completed_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        value.attemptId,
        JSON.stringify(value.analysis),
        value.disagreement ? 1 : 0,
        value.modelId,
        value.responseId,
        value.latencyMs,
        value.usedRepair ? 1 : 0,
        completedAt,
      );
      this.insertAchievement(achievement);
      this.ctx.storage.sql.exec(
        `INSERT INTO simulation_runs (
          id, attempt_id, room_seq, template_id, template_version,
          inputs_json, outcome_json, presentation_variant, random_seed, created_at
        ) VALUES (?, ?, ?, 'speed', 1, ?, ?, 'shuttle-bumper-v1', ?, ?)`,
        runId,
        value.attemptId,
        roomSeq,
        JSON.stringify(value.inputs),
        JSON.stringify(outcome),
        randomSeed,
        completedAt,
      );
      this.ctx.storage.sql.exec(
        "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
        roomSeq + 1,
      );
    });
    this.releaseAttemptProcessingLock(value.attemptId);
    const attempt = this.analysisAttemptById(value.attemptId);
    const analysis = this.analysisForAttempt(value.attemptId);
    const run = this.simulationRunForAttempt(value.attemptId);
    if (
      attempt === null ||
      analysis === null ||
      run === null ||
      run.templateId !== "speed"
    ) {
      throw new Error("Completed speed analysis state was not persisted");
    }
    this.broadcast({
      payload: { achievement, analysis, attempt, run },
      type: "analysis.completed",
      v: 1,
    });
    return { achievement, analysis, attempt, run };
  }

  completeStructureAiAttempt(
    input: z.input<typeof CompleteStructureAiAttemptSchema>,
  ): {
    achievement: AchievementAward;
    analysis: AnalysisRecord;
    attempt: AiAttempt;
    run: Extract<SimulationRun, { templateId: "structure" }>;
  } {
    const value = CompleteStructureAiAttemptSchema.parse(input);
    const current = this.analysisAttemptById(value.attemptId);
    const meta = this.roomMeta();
    const fixture =
      meta === null ? undefined : structureFixtureById(meta.fixture_id);
    if (
      current === null ||
      current.media === null ||
      current.taskId !== "structure-task-v1" ||
      fixture === undefined
    ) {
      throw new Error(
        "Structure analysis attempt, media, or fixture is missing",
      );
    }
    if (current.status === "complete" || current.status === "failed") {
      throw new Error("Structure analysis attempt is already terminal");
    }
    const outcome = classifyStructureInput(fixture.parameters, value.inputs);
    const completedAt = new Date().toISOString();
    const runId = `run_${crypto.randomUUID()}`;
    const randomSeed = crypto.randomUUID();
    let roomSeq = 0;
    const achievement = structureAchievement({
      attemptId: value.attemptId,
      createdAt: completedAt,
      hadPriorIncorrectAttempt: this.hasPriorIncorrectAttempt("structure"),
      outcome,
      roomSeq: this.nextSequence(),
    });
    this.ctx.storage.transactionSync(() => {
      roomSeq = this.nextSequence();
      this.ctx.storage.sql.exec(
        "UPDATE analysis_attempts SET status = 'complete', room_seq = ? WHERE id = ?",
        roomSeq,
        value.attemptId,
      );
      this.ctx.storage.sql.exec(
        `INSERT INTO analysis_results (
          attempt_id, result_json, failure_category, disagreement, model_id,
          response_id, latency_ms, used_repair, completed_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        value.attemptId,
        JSON.stringify(value.analysis),
        value.disagreement ? 1 : 0,
        value.modelId,
        value.responseId,
        value.latencyMs,
        value.usedRepair ? 1 : 0,
        completedAt,
      );
      this.insertAchievement(achievement);
      this.ctx.storage.sql.exec(
        `INSERT INTO simulation_runs (
          id, attempt_id, room_seq, template_id, template_version,
          inputs_json, outcome_json, presentation_variant, random_seed, created_at
        ) VALUES (?, ?, ?, 'structure', 1, ?, ?, 'platform-fragments-v1', ?, ?)`,
        runId,
        value.attemptId,
        roomSeq,
        JSON.stringify(value.inputs),
        JSON.stringify(outcome),
        randomSeed,
        completedAt,
      );
      this.ctx.storage.sql.exec(
        "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
        roomSeq + 1,
      );
    });
    this.releaseAttemptProcessingLock(value.attemptId);
    const attempt = this.analysisAttemptById(value.attemptId);
    const analysis = this.analysisForAttempt(value.attemptId);
    const run = this.simulationRunForAttempt(value.attemptId);
    if (
      attempt === null ||
      analysis === null ||
      run === null ||
      run.templateId !== "structure"
    ) {
      throw new Error("Completed structure analysis state was not persisted");
    }
    this.broadcast({
      payload: { achievement, analysis, attempt, run },
      type: "analysis.completed",
      v: 1,
    });
    return { achievement, analysis, attempt, run };
  }

  failAiAttempt(input: {
    attemptId: string;
    category: z.input<typeof AnalysisFailureCategorySchema>;
    latencyMs: number;
    usedRepair: boolean;
  }): { analysis: AnalysisRecord; attempt: AiAttempt } {
    const attemptId = z.string().min(8).max(128).parse(input.attemptId);
    const category = AnalysisFailureCategorySchema.parse(input.category);
    const latencyMs = z.number().int().nonnegative().parse(input.latencyMs);
    const current = this.analysisAttemptById(attemptId);
    if (current === null) throw new Error("Analysis attempt is missing");
    if (current.status === "complete" || current.status === "failed") {
      throw new Error("Analysis attempt is already terminal");
    }
    const completedAt = new Date().toISOString();
    let roomSeq = 0;
    this.ctx.storage.transactionSync(() => {
      roomSeq = this.nextSequence();
      this.ctx.storage.sql.exec(
        "UPDATE analysis_attempts SET status = 'failed', room_seq = ? WHERE id = ?",
        roomSeq,
        attemptId,
      );
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO analysis_results (
          attempt_id, result_json, failure_category, disagreement, model_id,
          response_id, latency_ms, used_repair, completed_at
        ) VALUES (?, NULL, ?, 0, NULL, NULL, ?, ?, ?)`,
        attemptId,
        category,
        latencyMs,
        input.usedRepair ? 1 : 0,
        completedAt,
      );
      this.ctx.storage.sql.exec(
        "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
        roomSeq + 1,
      );
    });
    this.releaseAttemptProcessingLock(attemptId);
    const attempt = this.analysisAttemptById(attemptId);
    const analysis = this.analysisForAttempt(attemptId);
    if (attempt === null || analysis === null) {
      throw new Error("Failed analysis state was not persisted");
    }
    this.broadcast({
      payload: { analysis, attempt },
      type: "analysis.failed",
      v: 1,
    });
    return { analysis, attempt };
  }

  async mediaForCapability(
    capability: string,
    mediaId: string,
  ): Promise<{ contentType: string; r2Key: string } | null> {
    const meta = this.roomMeta();
    if (
      meta === null ||
      (await this.roleForCapability(meta, capability)) === null
    ) {
      return null;
    }
    const row = this.ctx.storage.sql
      .exec<MediaRow>(
        `SELECT id, r2_key, content_hash, content_type, byte_size, width, height
         FROM media_objects WHERE id = ?`,
        z.string().min(8).max(128).parse(mediaId),
      )
      .toArray()[0];
    return row === undefined
      ? null
      : { contentType: row.content_type, r2Key: row.r2_key };
  }

  async resetCurrentTask(input: {
    capability: string;
    idempotencyKey: string;
    initialCanvasOperations: CanvasOperation[];
  }): Promise<
    | { ok: true; room: RoomBootstrap }
    | { ok: false; reason: "attempt_in_progress" | "permission_denied" }
  > {
    const capability = z.string().min(32).max(256).parse(input.capability);
    const idempotencyKey = z
      .string()
      .min(8)
      .max(128)
      .parse(input.idempotencyKey);
    const operations = input.initialCanvasOperations.map((operation) =>
      CanvasOperationSchema.parse(operation),
    );
    const meta = this.roomMeta();
    if (
      meta === null ||
      (await this.roleForCapability(meta, capability)) !== "teacher"
    ) {
      return { ok: false, reason: "permission_denied" };
    }
    const active = this.ctx.storage.sql
      .exec<{ active_attempt_id: string | null }>(
        "SELECT active_attempt_id FROM room_locks WHERE singleton = 1",
      )
      .toArray()[0]?.active_attempt_id;
    if (active) return { ok: false, reason: "attempt_in_progress" };

    const duplicate = this.ctx.storage.sql
      .exec<{ room_seq: number }>(
        "SELECT room_seq FROM task_resets WHERE idempotency_key = ?",
        idempotencyKey,
      )
      .toArray()[0];
    if (duplicate !== undefined) {
      return {
        ok: true,
        room: await this.snapshot(meta, "teacher", capability),
      };
    }

    const r2Keys = this.ctx.storage.sql
      .exec<{ r2_key: string }>("SELECT r2_key FROM media_objects")
      .toArray()
      .map((row) => row.r2_key);
    const createdAt = new Date().toISOString();
    this.ctx.storage.transactionSync(() => {
      let seq = this.nextSequence();
      this.ctx.storage.sql.exec("DELETE FROM achievement_awards");
      this.ctx.storage.sql.exec("DELETE FROM analysis_results");
      this.ctx.storage.sql.exec("DELETE FROM media_objects");
      this.ctx.storage.sql.exec("DELETE FROM analysis_attempts");
      this.ctx.storage.sql.exec("DELETE FROM simulation_runs");
      this.ctx.storage.sql.exec("DELETE FROM attempts");
      this.ctx.storage.sql.exec("DELETE FROM canvas_operations");
      this.ctx.storage.sql.exec(
        "INSERT INTO task_resets (idempotency_key, room_seq, created_at) VALUES (?, ?, ?)",
        idempotencyKey,
        seq,
        createdAt,
      );
      seq += 1;
      for (const operation of operations) {
        const layer = this.operationLayer(operation);
        if (layer === null) throw new Error("Reset canvas layer is invalid");
        this.ctx.storage.sql.exec(
          `INSERT INTO canvas_operations (
            seq, client_operation_id, workspace_id, layer,
            author_id, operation_type, payload_json, created_at
          ) VALUES (?, ?, ?, ?, 'judge-fixture', ?, ?, ?)`,
          seq,
          operation.clientOperationId,
          operation.workspaceId,
          layer,
          operation.operation,
          JSON.stringify(operation),
          createdAt,
        );
        seq += 1;
      }
      this.ctx.storage.sql.exec(
        "UPDATE room_meta SET next_seq = ? WHERE singleton = 1",
        seq,
      );
      this.ctx.storage.sql.exec(
        "UPDATE room_locks SET active_attempt_id = NULL WHERE singleton = 1",
      );
    });
    if (r2Keys.length > 0) await this.env.MEDIA.delete(r2Keys);
    const refreshedMeta = this.roomMeta();
    if (refreshedMeta === null)
      throw new Error("Reset room metadata is missing");
    const room = await this.snapshot(refreshedMeta, "teacher", capability);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment =
        socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment !== null) {
        this.send(socket, {
          payload: await this.snapshot(refreshedMeta, attachment.role),
          type: "room.snapshot",
          v: 1,
        });
      }
    }
    return { ok: true, room };
  }

  initialize(
    input: Initialization,
    events: RoomFeedEvent[],
    initialCanvasOperations: CanvasOperation[] = [],
  ): void {
    const initialization = InitializationSchema.parse(input);
    const parsedEvents = events.map((event) =>
      RoomFeedEventSchema.parse(event),
    );
    const parsedOperations = initialCanvasOperations.map((operation) =>
      CanvasOperationSchema.parse(operation),
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
        parsedEvents.length + parsedOperations.length + 1,
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
      for (const [index, operation] of parsedOperations.entries()) {
        const seq = parsedEvents.length + index + 1;
        const layer = this.operationLayer(operation);
        if (layer === null) throw new Error("Initial canvas layer is invalid");
        this.ctx.storage.sql.exec(
          `INSERT INTO canvas_operations (
            seq, client_operation_id, workspace_id, layer,
            author_id, operation_type, payload_json, created_at
          ) VALUES (?, ?, ?, ?, 'judge-fixture', ?, ?, ?)`,
          seq,
          operation.clientOperationId,
          operation.workspaceId,
          layer,
          operation.operation,
          JSON.stringify(operation),
          createdAt,
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
    const changedAiAttempts = this.analysisAttemptsAfter(lastSeenSeq);
    const attemptIds = [
      ...runs.map((run) => run.attemptId),
      ...changedAiAttempts.map((attempt) => attempt.id),
    ];
    this.send(socket, {
      payload: {
        analyses: this.analysesByAttemptId(attemptIds),
        achievements: this.achievementsAfter(lastSeenSeq),
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
    if (message.payload.templateId === "structure") {
      this.captureManualStructureAttempt(socket, attachment, message);
      return;
    }
    if (message.payload.templateId === "speed") {
      this.captureManualSpeedAttempt(socket, attachment, message);
      return;
    }
    if (message.payload.templateId === "water") {
      this.captureManualWaterAttempt(socket, attachment, message);
      return;
    }
    if (
      waterFixtureById(this.roomMeta()?.fixture_id ?? "") !== undefined ||
      speedFixtureById(this.roomMeta()?.fixture_id ?? "") !== undefined ||
      structureFixtureById(this.roomMeta()?.fixture_id ?? "") !== undefined
    ) {
      this.rejectCommand(socket, message.requestId, "invalid_command");
      return;
    }
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
      const achievement = this.achievementForAttempt(duplicateRow.id);
      if (attempt !== undefined && run !== null && achievement !== null) {
        this.ack(
          socket,
          message.requestId,
          message.payload.idempotencyKey,
          run.roomSeq,
          true,
        );
        this.send(socket, {
          payload: { achievement, attempt, run },
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
    const achievement = bridgeAchievement({
      attemptId,
      createdAt,
      hadPriorIncorrectAttempt: this.hasPriorIncorrectAttempt("bridge"),
      outcome,
      roomSeq: this.nextSequence(),
    });

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
        this.insertAchievement(achievement);
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
      payload: { achievement, attempt, run },
      type: "simulation.launch",
      v: 1,
    });
  }

  private captureManualWaterAttempt(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: Extract<
      SocketAuthenticatedMessage,
      { type: "attempt.manual-capture" }
    >,
  ): void {
    if (message.payload.templateId !== "water") {
      this.rejectCommand(socket, message.requestId, "invalid_command");
      return;
    }
    const meta = this.roomMeta();
    const fixture =
      meta === null ? undefined : waterFixtureById(meta.fixture_id);
    if (fixture === undefined) {
      this.rejectCommand(socket, message.requestId, "invalid_command");
      return;
    }
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
      const achievement = this.achievementForAttempt(duplicateRow.id);
      if (attempt !== undefined && run !== null && achievement !== null) {
        this.ack(
          socket,
          message.requestId,
          message.payload.idempotencyKey,
          run.roomSeq,
          true,
        );
        this.send(socket, {
          payload: { achievement, attempt, run },
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
    const outcome = classifyWaterInput(
      fixture.parameters,
      message.payload.inputs,
    );
    const attemptId = `at_${crypto.randomUUID()}`;
    const runId = `run_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const randomSeed = crypto.randomUUID();
    let roomSeq = 0;
    const achievement = waterAchievement({
      attemptId,
      createdAt,
      hadPriorIncorrectAttempt: this.hasPriorIncorrectAttempt("water"),
      outcome,
      roomSeq: this.nextSequence(),
    });
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
          ) VALUES (?, ?, 'water-task-v1', ?, ?, 'completed', ?)`,
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
          ) VALUES (?, ?, ?, 'water', 1, ?, ?, 'tank-splash-v1', ?, ?)`,
          runId,
          attemptId,
          roomSeq,
          JSON.stringify(message.payload.inputs),
          JSON.stringify(outcome),
          randomSeed,
          createdAt,
        );
        this.insertAchievement(achievement);
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
      taskId: "water-task-v1",
    });
    const run = SimulationRunSchema.parse({
      attemptId,
      createdAt,
      id: runId,
      inputs: message.payload.inputs,
      outcome,
      presentationVariant: "tank-splash-v1",
      randomSeed,
      roomSeq,
      templateId: "water",
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
      payload: { achievement, attempt, run },
      type: "simulation.launch",
      v: 1,
    });
  }

  private captureManualSpeedAttempt(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: Extract<
      SocketAuthenticatedMessage,
      { type: "attempt.manual-capture" }
    >,
  ): void {
    if (message.payload.templateId !== "speed") {
      this.rejectCommand(socket, message.requestId, "invalid_command");
      return;
    }
    const meta = this.roomMeta();
    const fixture =
      meta === null ? undefined : speedFixtureById(meta.fixture_id);
    if (fixture === undefined) {
      this.rejectCommand(socket, message.requestId, "invalid_command");
      return;
    }
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
      const achievement = this.achievementForAttempt(duplicateRow.id);
      if (attempt !== undefined && run !== null && achievement !== null) {
        this.ack(
          socket,
          message.requestId,
          message.payload.idempotencyKey,
          run.roomSeq,
          true,
        );
        this.send(socket, {
          payload: { achievement, attempt, run },
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
    const outcome = classifySpeedInput(
      fixture.parameters,
      message.payload.inputs,
    );
    const attemptId = `at_${crypto.randomUUID()}`;
    const runId = `run_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const randomSeed = crypto.randomUUID();
    let roomSeq = 0;
    const achievement = speedAchievement({
      attemptId,
      createdAt,
      hadPriorIncorrectAttempt: this.hasPriorIncorrectAttempt("speed"),
      outcome,
      roomSeq: this.nextSequence(),
    });
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
          ) VALUES (?, ?, 'speed-task-v1', ?, ?, 'completed', ?)`,
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
          ) VALUES (?, ?, ?, 'speed', 1, ?, ?, 'shuttle-bumper-v1', ?, ?)`,
          runId,
          attemptId,
          roomSeq,
          JSON.stringify(message.payload.inputs),
          JSON.stringify(outcome),
          randomSeed,
          createdAt,
        );
        this.insertAchievement(achievement);
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
      taskId: "speed-task-v1",
    });
    const run = SimulationRunSchema.parse({
      attemptId,
      createdAt,
      id: runId,
      inputs: message.payload.inputs,
      outcome,
      presentationVariant: "shuttle-bumper-v1",
      randomSeed,
      roomSeq,
      templateId: "speed",
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
      payload: { achievement, attempt, run },
      type: "simulation.launch",
      v: 1,
    });
  }

  private captureManualStructureAttempt(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: Extract<
      SocketAuthenticatedMessage,
      { type: "attempt.manual-capture" }
    >,
  ): void {
    if (message.payload.templateId !== "structure") {
      this.rejectCommand(socket, message.requestId, "invalid_command");
      return;
    }
    const meta = this.roomMeta();
    const fixture =
      meta === null ? undefined : structureFixtureById(meta.fixture_id);
    if (fixture === undefined) {
      this.rejectCommand(socket, message.requestId, "invalid_command");
      return;
    }
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
      const achievement = this.achievementForAttempt(duplicateRow.id);
      if (attempt !== undefined && run !== null && achievement !== null) {
        this.ack(
          socket,
          message.requestId,
          message.payload.idempotencyKey,
          run.roomSeq,
          true,
        );
        this.send(socket, {
          payload: { achievement, attempt, run },
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
    const outcome = classifyStructureInput(
      fixture.parameters,
      message.payload.inputs,
    );
    const attemptId = `at_${crypto.randomUUID()}`;
    const runId = `run_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const randomSeed = crypto.randomUUID();
    let roomSeq = 0;
    const achievement = structureAchievement({
      attemptId,
      createdAt,
      hadPriorIncorrectAttempt: this.hasPriorIncorrectAttempt("structure"),
      outcome,
      roomSeq: this.nextSequence(),
    });
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
          ) VALUES (?, ?, 'structure-task-v1', ?, ?, 'completed', ?)`,
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
          ) VALUES (?, ?, ?, 'structure', 1, ?, ?, 'platform-fragments-v1', ?, ?)`,
          runId,
          attemptId,
          roomSeq,
          JSON.stringify(message.payload.inputs),
          JSON.stringify(outcome),
          randomSeed,
          createdAt,
        );
        this.insertAchievement(achievement);
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
      taskId: "structure-task-v1",
    });
    const run = SimulationRunSchema.parse({
      attemptId,
      createdAt,
      id: runId,
      inputs: message.payload.inputs,
      outcome,
      presentationVariant: "platform-fragments-v1",
      randomSeed,
      roomSeq,
      templateId: "structure",
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
      payload: { achievement, attempt, run },
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
          `SELECT seq FROM canvas_operations
           WHERE seq = ? AND layer = 'student' AND workspace_id = 'bridge-workspace-v1'`,
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

  private attempts(): RoomAttempt[] {
    return [...this.manualAttempts(), ...this.analysisAttempts()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  private manualAttempts(): ManualAttempt[] {
    return this.attemptRows(
      "SELECT id, task_id, author_id, source_canvas_seq, status, created_at FROM attempts ORDER BY created_at",
    );
  }

  private attemptsById(ids: string[]): RoomAttempt[] {
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

  private analysisAttempts(): AiAttempt[] {
    return this.analysisAttemptRows(
      `SELECT id, task_id, author_id, source_canvas_seq, status, room_seq,
              media_id, created_at FROM analysis_attempts ORDER BY created_at`,
    );
  }

  private analysisAttemptsAfter(seq: number): AiAttempt[] {
    return this.analysisAttemptRows(
      `SELECT id, task_id, author_id, source_canvas_seq, status, room_seq,
              media_id, created_at FROM analysis_attempts WHERE room_seq > ? ORDER BY room_seq`,
      seq,
    );
  }

  private analysisAttemptById(attemptId: string): AiAttempt | null {
    return (
      this.analysisAttemptRows(
        `SELECT id, task_id, author_id, source_canvas_seq, status, room_seq,
                media_id, created_at FROM analysis_attempts WHERE id = ?`,
        attemptId,
      )[0] ?? null
    );
  }

  private analysisAttemptRows(
    query: string,
    ...bindings: unknown[]
  ): AiAttempt[] {
    return this.ctx.storage.sql
      .exec<AnalysisAttemptRow>(query, ...bindings)
      .toArray()
      .map((row) =>
        AiAttemptSchema.parse({
          authorId: row.author_id,
          createdAt: row.created_at,
          id: row.id,
          media: row.media_id === null ? null : this.mediaById(row.media_id),
          mode: "ai",
          roomSeq: row.room_seq,
          sourceCanvasSeq: row.source_canvas_seq,
          status: row.status,
          taskId: row.task_id,
        }),
      );
  }

  private mediaById(mediaId: string): AttemptMedia | null {
    const row = this.ctx.storage.sql
      .exec<MediaRow>(
        `SELECT id, r2_key, content_hash, content_type, byte_size, width, height
         FROM media_objects WHERE id = ?`,
        mediaId,
      )
      .toArray()[0];
    return row === undefined
      ? null
      : AttemptMediaSchema.parse({
          byteSize: row.byte_size,
          contentHash: row.content_hash,
          contentType: row.content_type,
          height: row.height,
          id: row.id,
          width: row.width,
        });
  }

  private analyses(): AnalysisRecord[] {
    return this.ctx.storage.sql
      .exec<AnalysisResultRow>(
        `SELECT attempt_id, result_json, failure_category, disagreement,
                model_id, response_id, latency_ms, used_repair, completed_at
         FROM analysis_results ORDER BY completed_at`,
      )
      .toArray()
      .map((row) => this.analysisRecord(row));
  }

  private analysesByAttemptId(ids: string[]): AnalysisRecord[] {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    return this.analyses().filter((analysis) => wanted.has(analysis.attemptId));
  }

  private analysisForAttempt(attemptId: string): AnalysisRecord | null {
    const row = this.ctx.storage.sql
      .exec<AnalysisResultRow>(
        `SELECT attempt_id, result_json, failure_category, disagreement,
                model_id, response_id, latency_ms, used_repair, completed_at
         FROM analysis_results WHERE attempt_id = ?`,
        attemptId,
      )
      .toArray()[0];
    return row === undefined ? null : this.analysisRecord(row);
  }

  private analysisRecord(row: AnalysisResultRow): AnalysisRecord {
    return AnalysisRecordSchema.parse({
      attemptId: row.attempt_id,
      completedAt: row.completed_at,
      disagreement: row.disagreement === 1,
      failureCategory: row.failure_category,
      latencyMs: row.latency_ms,
      modelId: row.model_id,
      responseId: row.response_id,
      result: row.result_json === null ? null : JSON.parse(row.result_json),
      usedRepair: row.used_repair === 1,
    });
  }

  private insertAchievement(achievement: AchievementAward): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO achievement_awards (
        id, attempt_id, room_seq, achievement_key, category,
        title, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      achievement.id,
      achievement.attemptId,
      achievement.roomSeq,
      achievement.key,
      achievement.category,
      achievement.title,
      achievement.description,
      achievement.createdAt,
    );
  }

  private achievementForAttempt(attemptId: string): AchievementAward | null {
    const row = this.ctx.storage.sql
      .exec<AchievementRow>(
        `SELECT id, attempt_id, room_seq, achievement_key, category,
                title, description, created_at
         FROM achievement_awards WHERE attempt_id = ?`,
        attemptId,
      )
      .toArray()[0];
    return row === undefined ? null : this.achievementRecord(row);
  }

  private achievements(): AchievementAward[] {
    return this.achievementRows(
      `SELECT id, attempt_id, room_seq, achievement_key, category,
              title, description, created_at
       FROM achievement_awards ORDER BY room_seq`,
    );
  }

  private achievementsAfter(seq: number): AchievementAward[] {
    return this.achievementRows(
      `SELECT id, attempt_id, room_seq, achievement_key, category,
              title, description, created_at
       FROM achievement_awards WHERE room_seq > ? ORDER BY room_seq`,
      seq,
    );
  }

  private achievementRows(
    query: string,
    ...bindings: unknown[]
  ): AchievementAward[] {
    return this.ctx.storage.sql
      .exec<AchievementRow>(query, ...bindings)
      .toArray()
      .map((row) => this.achievementRecord(row));
  }

  private achievementRecord(row: AchievementRow): AchievementAward {
    return AchievementAwardSchema.parse({
      attemptId: row.attempt_id,
      category: row.category,
      createdAt: row.created_at,
      description: row.description,
      id: row.id,
      key: row.achievement_key,
      roomSeq: row.room_seq,
      title: row.title,
    });
  }

  private hasPriorIncorrectAttempt(
    templateId: "bridge" | "water" | "speed" | "structure",
  ): boolean {
    return this.simulationRuns().some(
      (run) =>
        run.templateId === templateId && !run.outcome.isMathematicallyCorrect,
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
      achievements: this.achievements(),
      analyses: this.analyses(),
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
