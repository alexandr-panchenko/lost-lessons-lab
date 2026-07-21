import { z } from "zod";

const productionOrigin = z.url().parse(process.env.PRODUCTION_URL);
const response = await fetch(new URL("/api/health", productionOrigin));

if (!response.ok) {
  throw new Error(`Production health check failed with ${response.status}`);
}

const health = z
  .object({
    service: z.literal("lost-lessons-lab"),
    status: z.literal("ok"),
  })
  .parse(await response.json());

console.log(`Production health check passed for ${health.service}.`);
