import type { Context, Hono } from "hono";
import { z } from "zod";

import {
  analyzeBridgeSolution,
  analyzeSpeedSolution,
  analyzeWaterSolution,
  parseAiConfiguration,
} from "../ai/openai-responses";
import { waterFixtureById } from "../../../fixtures/water/packs";
import { speedFixtureById } from "../../../fixtures/speed/packs";
import type { WorkerEnv } from "../env";
import { AttemptUploadSchema, validatePngUpload } from "../media/png";
import { logAnalysisMetadata } from "../security/logging";
import { reserveAiIpRequest } from "../security/rate-limit";
import { bearerToken, ROOM_HEADERS, RoomIdSchema } from "./rooms";

type AppBindings = { Bindings: WorkerEnv };

const MediaLimitsSchema = z.object({
  ANALYSIS_MEDIA_EDGE_PX: z.coerce.number().int().min(320).max(4096),
  MAX_MEDIA_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(8 * 1024 * 1024),
  MAX_MEDIA_EDGE_PX: z.coerce.number().int().min(320).max(8192),
});

async function roomHash(roomId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(roomId),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function statusForReason(reason: string): 401 | 403 | 409 | 429 {
  if (reason === "unauthorized") return 401;
  if (reason === "permission_denied") return 403;
  if (reason === "rate_limited") return 429;
  return 409;
}

async function runAnalysis(input: {
  attemptId: string;
  config: ReturnType<typeof parseAiConfiguration>;
  imageBase64: string;
  room: DurableObjectStub<
    import("../room/RoomDurableObject").RoomDurableObject
  >;
  roomId: string;
  fixtureId: string;
}): Promise<void> {
  const hashedRoom = await roomHash(input.roomId);
  try {
    const waterFixture = waterFixtureById(input.fixtureId);
    const speedFixture = speedFixtureById(input.fixtureId);
    const shared = {
      config: input.config,
      imageBase64: input.imageBase64,
      onStage: async (stage: "reading" | "extracting" | "validating") => {
        await input.room.setAnalysisStatus(input.attemptId, stage);
      },
      safetyIdentifier: `room_${hashedRoom}`,
    };
    const recordFailure = async (result: {
      category: import("../../shared/analysis-types").AnalysisFailureCategory;
      diagnostic?: string;
      latencyMs: number;
      upstreamStatus?: number;
      usedRepair: boolean;
    }) => {
      await input.room.failAiAttempt({
        attemptId: input.attemptId,
        category: result.category,
        latencyMs: result.latencyMs,
        usedRepair: result.usedRepair,
      });
      logAnalysisMetadata({
        attemptId: input.attemptId,
        category: result.category,
        ...(result.diagnostic === undefined
          ? {}
          : { diagnostic: result.diagnostic }),
        event: "analysis.failed",
        latencyMs: result.latencyMs,
        roomHash: hashedRoom,
        ...(result.upstreamStatus === undefined
          ? {}
          : { upstreamStatus: result.upstreamStatus }),
        usedRepair: result.usedRepair,
      });
    };
    if (speedFixture !== undefined) {
      const result = await analyzeSpeedSolution({
        ...shared,
        fixture: speedFixture,
      });
      if (!result.ok) {
        await recordFailure(result);
        return;
      }
      await input.room.setAnalysisStatus(input.attemptId, "preparing");
      await input.room.completeSpeedAiAttempt({
        analysis: result.validated.analysis,
        attemptId: input.attemptId,
        disagreement: result.validated.disagreement,
        inputs: result.validated.inputs,
        latencyMs: result.latencyMs,
        modelId: result.modelId,
        responseId: result.responseId,
        usedRepair: result.usedRepair,
      });
      logAnalysisMetadata({
        attemptId: input.attemptId,
        event: "analysis.completed",
        latencyMs: result.latencyMs,
        modelId: result.modelId,
        responseId: result.responseId,
        roomHash: hashedRoom,
        usedRepair: result.usedRepair,
      });
    } else if (waterFixture !== undefined) {
      const result = await analyzeWaterSolution({
        ...shared,
        fixture: waterFixture,
      });
      if (!result.ok) {
        await recordFailure(result);
        return;
      }
      await input.room.setAnalysisStatus(input.attemptId, "preparing");
      await input.room.completeWaterAiAttempt({
        analysis: result.validated.analysis,
        attemptId: input.attemptId,
        disagreement: result.validated.disagreement,
        inputs: result.validated.inputs,
        latencyMs: result.latencyMs,
        modelId: result.modelId,
        responseId: result.responseId,
        usedRepair: result.usedRepair,
      });
      logAnalysisMetadata({
        attemptId: input.attemptId,
        event: "analysis.completed",
        latencyMs: result.latencyMs,
        modelId: result.modelId,
        responseId: result.responseId,
        roomHash: hashedRoom,
        usedRepair: result.usedRepair,
      });
    } else {
      const result = await analyzeBridgeSolution(shared);
      if (!result.ok) {
        await recordFailure(result);
        return;
      }
      await input.room.setAnalysisStatus(input.attemptId, "preparing");
      await input.room.completeAiAttempt({
        analysis: result.validated.analysis,
        attemptId: input.attemptId,
        disagreement: result.validated.disagreement,
        inputs: result.validated.inputs,
        latencyMs: result.latencyMs,
        modelId: result.modelId,
        responseId: result.responseId,
        usedRepair: result.usedRepair,
      });
      logAnalysisMetadata({
        attemptId: input.attemptId,
        event: "analysis.completed",
        latencyMs: result.latencyMs,
        modelId: result.modelId,
        responseId: result.responseId,
        roomHash: hashedRoom,
        usedRepair: result.usedRepair,
      });
    }
  } catch {
    try {
      await input.room.failAiAttempt({
        attemptId: input.attemptId,
        category: "upstream",
        latencyMs: 0,
        usedRepair: false,
      });
    } catch {
      input.room.releaseAttemptProcessingLock(input.attemptId);
    }
    logAnalysisMetadata({
      attemptId: input.attemptId,
      category: "upstream",
      event: "analysis.failed",
      latencyMs: 0,
      roomHash: hashedRoom,
      usedRepair: false,
    });
  }
}

async function captureAttempt(
  context: Context<AppBindings>,
): Promise<Response> {
  const roomId = RoomIdSchema.safeParse(context.req.param("roomId"));
  const capability = bearerToken(context.req.header("Authorization"));
  if (!roomId.success || capability === null) {
    return context.json({ error: "unauthorized" }, 401, ROOM_HEADERS);
  }

  let config: ReturnType<typeof parseAiConfiguration>;
  try {
    config = parseAiConfiguration(
      context.env as WorkerEnv & { OPENAI_API_KEY?: string },
    );
  } catch {
    return context.json({ error: "ai_configuration" }, 503, ROOM_HEADERS);
  }
  if (config.AI_ENABLED !== "true") {
    return context.json(
      { error: "ai_disabled", fallback: "manual" },
      503,
      ROOM_HEADERS,
    );
  }
  if (!(await reserveAiIpRequest(context))) {
    return context.json(
      { error: "ai_rate_limited", fallback: "manual" },
      429,
      ROOM_HEADERS,
    );
  }

  const contentLength = Number(context.req.header("Content-Length") ?? "0");
  const limits = MediaLimitsSchema.parse(context.env);
  if (contentLength > limits.MAX_MEDIA_BYTES * 1.5 + 4096) {
    return context.json({ error: "invalid_media" }, 413, ROOM_HEADERS);
  }
  const upload = AttemptUploadSchema.safeParse(
    await context.req.json().catch(() => null),
  );
  if (!upload.success) {
    return context.json({ error: "invalid_request" }, 400, ROOM_HEADERS);
  }
  let png: Awaited<ReturnType<typeof validatePngUpload>>;
  try {
    png = await validatePngUpload(upload.data, {
      maxBytes: limits.MAX_MEDIA_BYTES,
      maxEdge: Math.min(
        limits.MAX_MEDIA_EDGE_PX,
        limits.ANALYSIS_MEDIA_EDGE_PX,
      ),
    });
  } catch {
    return context.json({ error: "invalid_media" }, 400, ROOM_HEADERS);
  }

  const room = context.env.ROOMS.getByName(roomId.data);
  const snapshot = await room.bootstrap(capability);
  if (snapshot === null) {
    return context.json({ error: "unauthorized" }, 401, ROOM_HEADERS);
  }
  const begun = await room.beginAiAttempt({
    authorId: upload.data.authorId,
    capability,
    contentHash: upload.data.contentHash,
    idempotencyKey: upload.data.idempotencyKey,
    previewAsStudent: upload.data.previewAsStudent,
    sourceCanvasSeq: upload.data.sourceCanvasSeq,
  });
  if (!begun.ok) {
    return context.json(
      {
        error: begun.reason,
        fallback: begun.reason === "rate_limited" ? "manual" : undefined,
      },
      statusForReason(begun.reason),
      ROOM_HEADERS,
    );
  }
  if (begun.duplicate) {
    return context.json(
      { attempt: begun.attempt, duplicate: true },
      200,
      ROOM_HEADERS,
    );
  }

  const mediaId = `media_${crypto.randomUUID()}`;
  const r2Key = `rooms/${roomId.data}/attempts/${begun.attempt.id}/${png.contentHash}.png`;
  try {
    await context.env.MEDIA.put(r2Key, png.bytes, {
      customMetadata: {
        attemptId: begun.attempt.id,
        roomId: roomId.data,
        visibility: "all",
      },
      httpMetadata: { contentType: "image/png" },
    });
    const attempt = await room.attachAiAttemptMedia({
      attemptId: begun.attempt.id,
      media: {
        byteSize: png.bytes.byteLength,
        contentHash: png.contentHash,
        contentType: "image/png",
        height: png.height,
        id: mediaId,
        width: png.width,
      },
      r2Key,
    });
    context.executionCtx.waitUntil(
      runAnalysis({
        attemptId: attempt.id,
        config,
        fixtureId: snapshot.fixtureId,
        imageBase64: upload.data.mediaBase64,
        room,
        roomId: roomId.data,
      }),
    );
    return context.json({ attempt, duplicate: false }, 202, ROOM_HEADERS);
  } catch {
    await context.env.MEDIA.delete(r2Key).catch(() => undefined);
    await room.failAiAttempt({
      attemptId: begun.attempt.id,
      category: "media_storage",
      latencyMs: 0,
      usedRepair: false,
    });
    return context.json(
      { error: "media_storage", fallback: "manual" },
      503,
      ROOM_HEADERS,
    );
  }
}

export function registerAttemptRoutes(app: Hono<AppBindings>): void {
  app.post("/api/rooms/:roomId/attempts", captureAttempt);

  app.get("/api/rooms/:roomId/media/:mediaId", async (context) => {
    const roomId = RoomIdSchema.safeParse(context.req.param("roomId"));
    const token = bearerToken(context.req.header("Authorization"));
    if (!roomId.success || token === null) {
      return context.json({ error: "unauthorized" }, 401, ROOM_HEADERS);
    }
    const reference = await context.env.ROOMS.getByName(
      roomId.data,
    ).mediaForCapability(token, context.req.param("mediaId"));
    if (reference === null) {
      return context.json({ error: "not_found" }, 404, ROOM_HEADERS);
    }
    const object = await context.env.MEDIA.get(reference.r2Key);
    if (object === null) {
      return context.json({ error: "not_found" }, 404, ROOM_HEADERS);
    }
    return new Response(object.body, {
      headers: {
        ...ROOM_HEADERS,
        "Content-Type": reference.contentType,
      },
      status: 200,
    });
  });
}
