import type { Hono } from "hono";
import { z } from "zod";

import { judgePreparedWrongOperations } from "../../../fixtures/judge-v1/fixture";
import type { WorkerEnv } from "../env";
import { bearerToken, ROOM_HEADERS, RoomIdSchema } from "./rooms";

type AppBindings = { Bindings: WorkerEnv };

const ResetRequestSchema = z
  .object({ idempotencyKey: z.string().min(8).max(128) })
  .strict();

export function registerResetRoutes(app: Hono<AppBindings>): void {
  app.post("/api/rooms/:roomId/reset", async (context) => {
    const roomId = RoomIdSchema.safeParse(context.req.param("roomId"));
    const capability = bearerToken(context.req.header("Authorization"));
    const request = ResetRequestSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!roomId.success || capability === null || !request.success) {
      return context.json({ error: "invalid_request" }, 400, ROOM_HEADERS);
    }
    const room = context.env.ROOMS.getByName(roomId.data);
    const current = await room.bootstrap(capability);
    if (current === null || current.role !== "teacher") {
      return context.json({ error: "permission_denied" }, 403, ROOM_HEADERS);
    }
    const result = await room.resetCurrentTask({
      capability,
      idempotencyKey: request.data.idempotencyKey,
      initialCanvasOperations:
        current.fixtureId === "judge-v1" ? judgePreparedWrongOperations : [],
    });
    if (!result.ok) {
      return context.json(
        { error: result.reason },
        result.reason === "attempt_in_progress" ? 409 : 403,
        ROOM_HEADERS,
      );
    }
    return context.json({ room: result.room }, 200, ROOM_HEADERS);
  });
}
