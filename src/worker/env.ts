import { z } from "zod";

export type WorkerEnv = Cloudflare.Env;

export type PublicEnvironmentInput = Partial<
  Pick<
    WorkerEnv,
    "AI_ENABLED" | "APP_ENV" | "OPENAI_MODEL" | "PUBLIC_APP_ORIGIN"
  >
>;

const PublicEnvironmentSchema = z.object({
  AI_ENABLED: z.enum(["true", "false"]).default("false"),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6"),
  PUBLIC_APP_ORIGIN: z.url().optional(),
});

export type PublicEnvironment = z.infer<typeof PublicEnvironmentSchema>;

export function parsePublicEnvironment(
  env: PublicEnvironmentInput,
): PublicEnvironment {
  return PublicEnvironmentSchema.parse(env);
}
