import { z } from "zod";

export const AchievementCategorySchema = z.enum(["progress", "disaster"]);
export type AchievementCategory = z.infer<typeof AchievementCategorySchema>;

export const AchievementAwardSchema = z
  .object({
    attemptId: z.string().min(8).max(128),
    category: AchievementCategorySchema,
    createdAt: z.string(),
    description: z.string().min(1).max(240),
    id: z.string().min(8).max(128),
    key: z.enum([
      "fixed-it",
      "first-try-crossing",
      "worlds-shortest-bridge",
      "tidal-surprise",
      "perfect-pour",
      "level-adjusted",
      "bumper-boop",
      "perfect-arrival",
      "route-corrected",
    ]),
    roomSeq: z.number().int().positive(),
    title: z.string().min(1).max(100),
  })
  .strict();
export type AchievementAward = z.infer<typeof AchievementAwardSchema>;
