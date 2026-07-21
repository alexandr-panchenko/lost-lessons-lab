import { Hono } from "hono";

import { parsePublicEnvironment, type WorkerEnv } from "./env";

export { RoomDurableObject } from "./room/RoomDurableObject";

const app = new Hono<{ Bindings: WorkerEnv }>();

app.get("/api/health", (context) => {
  const environment = parsePublicEnvironment(context.env);

  return context.json(
    {
      bindings: {
        media: context.env.MEDIA !== undefined,
        rooms: context.env.ROOMS !== undefined,
      },
      environment: environment.APP_ENV,
      service: "lost-lessons-lab",
      status: "ok",
    },
    200,
    {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  );
});

app.notFound((context) =>
  context.json(
    {
      error: "not_found",
    },
    404,
  ),
);

export default app;
