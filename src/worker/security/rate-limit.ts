import type { Context } from "hono";

import type { WorkerEnv } from "../env";

type AppBindings = { Bindings: WorkerEnv };

export async function reserveAiIpRequest(
  context: Context<AppBindings>,
): Promise<boolean> {
  const actor = context.req.header("CF-Connecting-IP") ?? "local-development";
  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${context.env.ROOM_TOKEN_PEPPER}:ai:${actor}`),
  );
  const key = [...new Uint8Array(keyBytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (!(await context.env.AI_REQUEST_RATE_LIMITER.limit({ key })).success) {
    return false;
  }
  const hourlyLimit = Number.parseInt(context.env.AI_IP_LIMIT_PER_HOUR, 10);
  if (!Number.isInteger(hourlyLimit) || hourlyLimit < 1) return false;
  return context.env.ROOMS.getByName(`rate_ai_${key}`).reserveHourlyRateLimit(
    `ai-ip:${key}`,
    hourlyLimit,
  );
}
