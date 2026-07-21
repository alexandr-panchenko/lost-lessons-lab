import { z } from "zod";

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

export const RoomBootstrapSchema = z
  .object({
    createdAt: z.string(),
    events: z.array(RoomFeedEventSchema),
    fixtureId: z.string(),
    role: RoomRoleSchema,
    roomId: z.string(),
    schemaId: z.literal("room.v1"),
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

export type SocketServerMessage =
  | { type: "auth.accepted"; v: 1; payload: { role: RoomRole } }
  | { type: "auth.rejected"; v: 1; payload: { reason: "unauthorized" } }
  | { type: "room.snapshot"; v: 1; payload: RoomBootstrap };
