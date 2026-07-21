import { z } from "zod";

import {
  AiAttemptSchema,
  AnalysisRecordSchema,
  AnalysisStatusSchema,
} from "./analysis-types";
import { AchievementAwardSchema } from "./achievement-types";
import { CanvasOperationRecordSchema, CanvasOperationSchema } from "./canvas";
import {
  BridgeOutcomeSchema,
  BridgeSimulationInputsSchema,
} from "./domain/bridge";
import {
  WaterOutcomeSchema,
  WaterSimulationInputsSchema,
} from "./domain/water";
import {
  SpeedOutcomeSchema,
  SpeedSimulationInputsSchema,
} from "./domain/speed";

export const RoomRoleSchema = z.enum(["teacher", "student"]);
export type RoomRole = z.infer<typeof RoomRoleSchema>;

export const FeedVisibilitySchema = z.enum(["all", "teacher"]);
export type FeedVisibility = z.infer<typeof FeedVisibilitySchema>;

const WelcomeEventSchema = z
  .object({
    createdAt: z.string(),
    payload: z.object({ message: z.string(), title: z.string() }).strict(),
    seq: z.number().int().positive(),
    type: z.literal("room.welcome"),
    visibility: z.literal("all"),
  })
  .strict();

const TeacherSetupEventSchema = z
  .object({
    createdAt: z.string(),
    payload: z
      .object({
        prompt: z.string(),
        supportedSkills: z.array(z.string()).min(1).max(8),
      })
      .strict(),
    seq: z.number().int().positive(),
    type: z.literal("teacher.setup"),
    visibility: z.literal("teacher"),
  })
  .strict();

const TaskPreviewEventSchema = z
  .object({
    createdAt: z.string(),
    payload: z
      .object({
        fixtureLabel: z.string(),
        prompt: z.string(),
        skillLabel: z.string(),
        taskTitle: z.string(),
      })
      .strict(),
    seq: z.number().int().positive(),
    type: z.literal("task.preview"),
    visibility: z.literal("all"),
  })
  .strict();

export const RoomFeedEventSchema = z.discriminatedUnion("type", [
  WelcomeEventSchema,
  TeacherSetupEventSchema,
  TaskPreviewEventSchema,
]);
export type RoomFeedEvent = z.infer<typeof RoomFeedEventSchema>;

export const ManualAttemptSchema = z
  .object({
    authorId: z.string().min(8).max(128),
    createdAt: z.string(),
    id: z.string().min(8).max(128),
    sourceCanvasSeq: z.number().int().nonnegative(),
    status: z.literal("completed"),
    taskId: z.enum(["bridge-task-v1", "water-task-v1", "speed-task-v1"]),
  })
  .strict();
export type ManualAttempt = z.infer<typeof ManualAttemptSchema>;

export const RoomAttemptSchema = z.union([
  ManualAttemptSchema,
  AiAttemptSchema,
]);
export type RoomAttempt = z.infer<typeof RoomAttemptSchema>;

export const BridgeSimulationRunSchema = z
  .object({
    attemptId: z.string().min(8).max(128),
    createdAt: z.string(),
    id: z.string().min(8).max(128),
    inputs: BridgeSimulationInputsSchema,
    outcome: BridgeOutcomeSchema,
    presentationVariant: z.literal("ravine-rescue-v1"),
    randomSeed: z.string().min(8).max(128),
    roomSeq: z.number().int().positive(),
    templateId: z.literal("bridge"),
    templateVersion: z.literal(1),
  })
  .strict();
export const WaterSimulationRunSchema = z
  .object({
    attemptId: z.string().min(8).max(128),
    createdAt: z.string(),
    id: z.string().min(8).max(128),
    inputs: WaterSimulationInputsSchema,
    outcome: WaterOutcomeSchema,
    presentationVariant: z.literal("tank-splash-v1"),
    randomSeed: z.string().min(8).max(128),
    roomSeq: z.number().int().positive(),
    templateId: z.literal("water"),
    templateVersion: z.literal(1),
  })
  .strict();
export const SpeedSimulationRunSchema = z
  .object({
    attemptId: z.string().min(8).max(128),
    createdAt: z.string(),
    id: z.string().min(8).max(128),
    inputs: SpeedSimulationInputsSchema,
    outcome: SpeedOutcomeSchema,
    presentationVariant: z.literal("shuttle-bumper-v1"),
    randomSeed: z.string().min(8).max(128),
    roomSeq: z.number().int().positive(),
    templateId: z.literal("speed"),
    templateVersion: z.literal(1),
  })
  .strict();
export const SimulationRunSchema = z.discriminatedUnion("templateId", [
  BridgeSimulationRunSchema,
  WaterSimulationRunSchema,
  SpeedSimulationRunSchema,
]);
export type SimulationRun = z.infer<typeof SimulationRunSchema>;

export const RoomBootstrapSchema = z
  .object({
    achievements: z.array(AchievementAwardSchema),
    createdAt: z.string(),
    analyses: z.array(AnalysisRecordSchema),
    attempts: z.array(RoomAttemptSchema),
    canvasOperations: z.array(CanvasOperationRecordSchema),
    events: z.array(RoomFeedEventSchema),
    fixtureId: z.string(),
    role: RoomRoleSchema,
    roomId: z.string(),
    roomSeq: z.number().int().nonnegative(),
    schemaId: z.literal("room.v1"),
    simulationRuns: z.array(SimulationRunSchema),
    studentCapability: z.string().optional(),
  })
  .strict();
export type RoomBootstrap = z.infer<typeof RoomBootstrapSchema>;

export const SocketAuthMessageSchema = z
  .object({
    clientId: z.string().min(8).max(128),
    payload: z.object({ token: z.string().min(32).max(256) }).strict(),
    type: z.literal("auth"),
    v: z.literal(1),
  })
  .strict();

export const SocketResumeMessageSchema = z
  .object({
    clientId: z.string().min(8).max(128),
    payload: z.object({ lastSeenSeq: z.number().int().nonnegative() }).strict(),
    type: z.literal("room.resume"),
    v: z.literal(1),
  })
  .strict();

export const SocketCanvasOperationMessageSchema = z
  .object({
    clientId: z.string().min(8).max(128),
    payload: z
      .object({
        operation: CanvasOperationSchema,
        previewAsStudent: z.boolean().default(false),
      })
      .strict(),
    requestId: z.string().min(8).max(128),
    type: z.literal("canvas.operation"),
    v: z.literal(1),
  })
  .strict();

export const SocketManualAttemptMessageSchema = z
  .object({
    clientId: z.string().min(8).max(128),
    payload: z.discriminatedUnion("templateId", [
      z
        .object({
          idempotencyKey: z.string().min(8).max(128),
          inputs: BridgeSimulationInputsSchema,
          previewAsStudent: z.boolean().default(false),
          sourceCanvasSeq: z.number().int().nonnegative(),
          templateId: z.literal("bridge"),
        })
        .strict(),
      z
        .object({
          idempotencyKey: z.string().min(8).max(128),
          inputs: WaterSimulationInputsSchema,
          previewAsStudent: z.boolean().default(false),
          sourceCanvasSeq: z.number().int().nonnegative(),
          templateId: z.literal("water"),
        })
        .strict(),
      z
        .object({
          idempotencyKey: z.string().min(8).max(128),
          inputs: SpeedSimulationInputsSchema,
          previewAsStudent: z.boolean().default(false),
          sourceCanvasSeq: z.number().int().nonnegative(),
          templateId: z.literal("speed"),
        })
        .strict(),
    ]),
    requestId: z.string().min(8).max(128),
    type: z.literal("attempt.manual-capture"),
    v: z.literal(1),
  })
  .strict();

export const SocketAuthenticatedMessageSchema = z.discriminatedUnion("type", [
  SocketResumeMessageSchema,
  SocketCanvasOperationMessageSchema,
  SocketManualAttemptMessageSchema,
]);
export type SocketAuthenticatedMessage = z.infer<
  typeof SocketAuthenticatedMessageSchema
>;

export type SocketServerMessage =
  | { type: "auth.accepted"; v: 1; payload: { role: RoomRole } }
  | { type: "auth.rejected"; v: 1; payload: { reason: "unauthorized" } }
  | { type: "room.snapshot"; v: 1; payload: RoomBootstrap }
  | {
      type: "room.delta";
      v: 1;
      payload: {
        analyses: z.infer<typeof AnalysisRecordSchema>[];
        achievements: z.infer<typeof AchievementAwardSchema>[];
        attempts: RoomAttempt[];
        canvasOperations: z.infer<typeof CanvasOperationRecordSchema>[];
        fromSeq: number;
        simulationRuns: SimulationRun[];
        toSeq: number;
      };
    }
  | {
      type: "canvas.operation";
      v: 1;
      payload: z.infer<typeof CanvasOperationRecordSchema>;
    }
  | {
      type: "command.ack";
      v: 1;
      payload: {
        duplicate: boolean;
        idempotencyKey: string;
        requestId: string;
        roomSeq: number;
      };
    }
  | {
      type: "command.rejected";
      v: 1;
      payload: {
        reason:
          | "invalid_command"
          | "permission_denied"
          | "attempt_in_progress"
          | "stale_canvas_sequence";
        requestId?: string;
      };
    }
  | {
      type: "simulation.launch";
      v: 1;
      payload: {
        achievement: z.infer<typeof AchievementAwardSchema>;
        attempt: RoomAttempt;
        run: SimulationRun;
      };
    }
  | {
      type: "analysis.status";
      v: 1;
      payload: {
        attempt: z.infer<typeof AiAttemptSchema>;
        stage: z.infer<typeof AnalysisStatusSchema>;
      };
    }
  | {
      type: "analysis.completed";
      v: 1;
      payload: {
        achievement: z.infer<typeof AchievementAwardSchema>;
        analysis: z.infer<typeof AnalysisRecordSchema>;
        attempt: z.infer<typeof AiAttemptSchema>;
        run: SimulationRun;
      };
    }
  | {
      type: "analysis.failed";
      v: 1;
      payload: {
        analysis: z.infer<typeof AnalysisRecordSchema>;
        attempt: z.infer<typeof AiAttemptSchema>;
      };
    };
