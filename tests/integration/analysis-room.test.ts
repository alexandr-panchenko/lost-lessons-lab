import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { RoomBootstrapSchema } from "../../src/shared/protocol";
import { wrongBridgeAnalysis } from "../fixtures/openai/solution-results";

async function createRoom() {
  const response = await exports.default.fetch("https://example.test/judge", {
    redirect: "manual",
  });
  const location = new URL(
    response.headers.get("location") ?? "",
    "https://example.test",
  );
  const roomId = location.pathname.split("/").at(-1);
  const teacherToken = new URLSearchParams(location.hash.slice(1)).get("token");
  if (roomId === undefined || teacherToken === null)
    throw new Error("Invalid room redirect");
  const bootstrap = RoomBootstrapSchema.parse(
    await (
      await exports.default.fetch(
        `https://example.test/api/rooms/${roomId}/bootstrap`,
        { headers: { Authorization: `Bearer ${teacherToken}` } },
      )
    ).json(),
  );
  if (bootstrap.studentCapability === undefined)
    throw new Error("Missing student capability");
  return {
    roomId,
    studentToken: bootstrap.studentCapability,
    teacherToken,
  };
}

describe("analysis room lifecycle", () => {
  it("fails closed to the manual path while AI is disabled", async () => {
    const created = await createRoom();
    const response = await exports.default.fetch(
      `https://example.test/api/rooms/${created.roomId}/attempts`,
      {
        headers: {
          Authorization: `Bearer ${created.studentToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: "{}",
      },
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "ai_disabled",
      fallback: "manual",
    });
  });

  it("serializes attempts, deduplicates mutations, and protects terminal state", async () => {
    const created = await createRoom();
    const room = env.ROOMS.getByName(created.roomId);
    const first = await room.beginAiAttempt({
      authorId: "student-integration",
      capability: created.studentToken,
      contentHash: "1".repeat(64),
      idempotencyKey: "analysis-integration-one",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    expect(first).toMatchObject({ duplicate: false, ok: true });
    if (!first.ok) throw new Error("First attempt was rejected");

    const locked = await room.beginAiAttempt({
      authorId: "student-integration",
      capability: created.studentToken,
      contentHash: "2".repeat(64),
      idempotencyKey: "analysis-integration-two",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    expect(locked).toEqual({ ok: false, reason: "attempt_in_progress" });

    const duplicate = await room.beginAiAttempt({
      authorId: "student-integration",
      capability: created.studentToken,
      contentHash: "1".repeat(64),
      idempotencyKey: "analysis-integration-one",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    expect(duplicate).toMatchObject({ duplicate: true, ok: true });

    const failed = await room.failAiAttempt({
      attemptId: first.attempt.id,
      category: "timeout",
      latencyMs: 3_000,
      usedRepair: true,
    });
    expect(failed).toMatchObject({
      analysis: { failureCategory: "timeout", usedRepair: true },
      attempt: { status: "failed" },
    });
    const terminalDuplicate = await room.beginAiAttempt({
      authorId: "student-integration",
      capability: created.studentToken,
      contentHash: "1".repeat(64),
      idempotencyKey: "analysis-integration-one",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    expect(terminalDuplicate).toMatchObject({
      attempt: { status: "failed" },
      duplicate: true,
      ok: true,
    });

    const afterFailure = await room.beginAiAttempt({
      authorId: "student-integration",
      capability: created.studentToken,
      contentHash: "2".repeat(64),
      idempotencyKey: "analysis-integration-two",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    expect(afterFailure).toMatchObject({ duplicate: false, ok: true });
    if (!afterFailure.ok) throw new Error("Second attempt was rejected");
    await room.failAiAttempt({
      attemptId: afterFailure.attempt.id,
      category: "upstream",
      latencyMs: 0,
      usedRepair: false,
    });
    const roomLimited = await room.beginAiAttempt({
      authorId: "student-integration",
      capability: created.studentToken,
      contentHash: "4".repeat(64),
      idempotencyKey: "analysis-integration-three",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    expect(roomLimited).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("enforces configurable hourly counters independently", async () => {
    const limiter = env.ROOMS.getByName("rate_ai_integration_test");
    await expect(
      limiter.reserveHourlyRateLimit("ai-ip:integration-test", 2),
    ).resolves.toBe(true);
    await expect(
      limiter.reserveHourlyRateLimit("ai-ip:integration-test", 2),
    ).resolves.toBe(true);
    await expect(
      limiter.reserveHourlyRateLimit("ai-ip:integration-test", 2),
    ).resolves.toBe(false);
    await expect(
      limiter.reserveHourlyRateLimit("room-create:integration-test", 1),
    ).resolves.toBe(true);
    await expect(
      limiter.reserveHourlyRateLimit("room-create:integration-test", 1),
    ).resolves.toBe(false);
  });

  it("expires a stale active analysis and rejects late completion", async () => {
    const created = await createRoom();
    const room = env.ROOMS.getByName(created.roomId);
    const begun = await room.beginAiAttempt({
      authorId: "student-stale-integration",
      capability: created.studentToken,
      contentHash: "5".repeat(64),
      idempotencyKey: "analysis-stale-attempt",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    if (!begun.ok) throw new Error("Stale attempt was rejected");
    const future = new Date(Date.now() + 90_000).toISOString();
    await expect(room.recoverStaleAnalysisAttempt(future)).resolves.toEqual({
      attemptId: begun.attempt.id,
      recovered: true,
    });
    const snapshot = RoomBootstrapSchema.parse(
      await (
        await exports.default.fetch(
          `https://example.test/api/rooms/${created.roomId}/bootstrap`,
          { headers: { Authorization: `Bearer ${created.studentToken}` } },
        )
      ).json(),
    );
    expect(snapshot.attempts).toContainEqual(
      expect.objectContaining({ id: begun.attempt.id, status: "failed" }),
    );
    expect(snapshot.analyses).toContainEqual(
      expect.objectContaining({
        attemptId: begun.attempt.id,
        failureCategory: "timeout",
      }),
    );
    const next = await room.beginAiAttempt({
      authorId: "student-stale-integration",
      capability: created.studentToken,
      contentHash: "6".repeat(64),
      idempotencyKey: "analysis-after-stale-attempt",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    expect(next).toMatchObject({ duplicate: false, ok: true });
  });

  it("keeps analysis media private to room capabilities", async () => {
    const created = await createRoom();
    const room = env.ROOMS.getByName(created.roomId);
    const begun = await room.beginAiAttempt({
      authorId: "student-integration",
      capability: created.studentToken,
      contentHash: "3".repeat(64),
      idempotencyKey: "analysis-media-one",
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    });
    if (!begun.ok) throw new Error("Attempt was rejected");
    const mediaId = "media_integration_private";
    const r2Key = `rooms/${created.roomId}/attempts/${begun.attempt.id}/${"3".repeat(64)}.png`;
    await env.MEDIA.put(r2Key, new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/png" },
    });
    await room.attachAiAttemptMedia({
      attemptId: begun.attempt.id,
      media: {
        byteSize: 3,
        contentHash: "3".repeat(64),
        contentType: "image/png",
        height: 1,
        id: mediaId,
        width: 1,
      },
      r2Key,
    });
    const completed = await room.completeAiAttempt({
      analysis: wrongBridgeAnalysis,
      attemptId: begun.attempt.id,
      disagreement: false,
      inputs: { deployedLengthMeters: 4.08, fractionAsDecimal: 0.34 },
      latencyMs: 1_234,
      modelId: "gpt-5.6-sol",
      responseId: "resp_integration_safe_identifier",
      usedRepair: false,
    });
    expect(completed).toMatchObject({
      achievement: {
        category: "disaster",
        key: "worlds-shortest-bridge",
      },
      analysis: {
        result: { scenarioInputs: { deployedLengthMeters: 4.08 } },
      },
      attempt: { status: "complete" },
      run: { outcome: { resultClass: "bridge_far_too_short" } },
    });

    const unauthorized = await exports.default.fetch(
      `https://example.test/api/rooms/${created.roomId}/media/${mediaId}`,
    );
    expect(unauthorized.status).toBe(401);
    const authorized = await exports.default.fetch(
      `https://example.test/api/rooms/${created.roomId}/media/${mediaId}`,
      { headers: { Authorization: `Bearer ${created.teacherToken}` } },
    );
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toBe("no-store");
    expect([...new Uint8Array(await authorized.arrayBuffer())]).toEqual([
      1, 2, 3,
    ]);
    await env.MEDIA.delete(r2Key);
    const missingObject = await exports.default.fetch(
      `https://example.test/api/rooms/${created.roomId}/media/${mediaId}`,
      { headers: { Authorization: `Bearer ${created.teacherToken}` } },
    );
    expect(missingObject.status).toBe(404);

    const reloaded = RoomBootstrapSchema.parse(
      await (
        await exports.default.fetch(
          `https://example.test/api/rooms/${created.roomId}/bootstrap`,
          { headers: { Authorization: `Bearer ${created.studentToken}` } },
        )
      ).json(),
    );
    expect(reloaded.attempts).toContainEqual(completed.attempt);
    expect(reloaded.analyses).toContainEqual(completed.analysis);
    expect(reloaded.achievements).toContainEqual(completed.achievement);
    expect(reloaded.simulationRuns).toContainEqual(completed.run);
  });
});
