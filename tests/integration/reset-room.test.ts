import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { RoomBootstrapSchema } from "../../src/shared/protocol";
import { wrongBridgeAnalysis } from "../fixtures/openai/solution-results";

async function createJudgeRoom() {
  const response = await exports.default.fetch("https://example.test/judge", {
    redirect: "manual",
  });
  const location = new URL(
    response.headers.get("location") ?? "",
    "https://example.test",
  );
  const roomId = location.pathname.split("/").at(-1);
  const teacherToken = new URLSearchParams(location.hash.slice(1)).get("token");
  if (roomId === undefined || teacherToken === null) {
    throw new Error("Invalid judge redirect");
  }
  const teacher = RoomBootstrapSchema.parse(
    await (
      await exports.default.fetch(
        `https://example.test/api/rooms/${roomId}/bootstrap`,
        { headers: { Authorization: `Bearer ${teacherToken}` } },
      )
    ).json(),
  );
  if (teacher.studentCapability === undefined) {
    throw new Error("Missing student capability");
  }
  return {
    roomId,
    studentToken: teacher.studentCapability,
    teacher,
    teacherToken,
  };
}

async function reset(
  roomId: string,
  token: string,
  idempotencyKey = "reset-integration-one",
) {
  return exports.default.fetch(
    `https://example.test/api/rooms/${roomId}/reset`,
    {
      body: JSON.stringify({ idempotencyKey }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
}

describe("task reset", () => {
  it("is teacher-only and restores an empty judge task in the same room", async () => {
    const created = await createJudgeRoom();
    const sourceCanvasSeq = 0;
    const room = env.ROOMS.getByName(created.roomId);
    const begun = await room.beginAiAttempt({
      authorId: "student-reset-test",
      capability: created.studentToken,
      contentHash: "5".repeat(64),
      idempotencyKey: "analysis-before-reset",
      previewAsStudent: false,
      sourceCanvasSeq,
    });
    if (!begun.ok) throw new Error("Attempt was rejected");
    const mediaId = "media_before_reset";
    const r2Key = `rooms/${created.roomId}/attempts/${begun.attempt.id}/${"5".repeat(64)}.png`;
    await env.MEDIA.put(r2Key, new Uint8Array([8, 9]), {
      httpMetadata: { contentType: "image/png" },
    });
    await room.attachAiAttemptMedia({
      attemptId: begun.attempt.id,
      media: {
        byteSize: 2,
        contentHash: "5".repeat(64),
        contentType: "image/png",
        height: 1,
        id: mediaId,
        width: 1,
      },
      r2Key,
    });
    await room.completeAiAttempt({
      analysis: wrongBridgeAnalysis,
      attemptId: begun.attempt.id,
      disagreement: false,
      inputs: { deployedLengthMeters: 4.08, fractionAsDecimal: 0.34 },
      latencyMs: 10,
      modelId: "gpt-5.6-sol",
      responseId: "resp_before_reset",
      usedRepair: false,
    });

    const forbidden = await reset(
      created.roomId,
      created.studentToken,
      "reset-forbidden-student",
    );
    expect(forbidden.status).toBe(403);

    const response = await reset(created.roomId, created.teacherToken);
    expect(response.status).toBe(200);
    const body = (await response.json()) as unknown;
    const restored = RoomBootstrapSchema.parse(
      (body as { room: unknown }).room,
    );
    expect(restored.roomId).toBe(created.roomId);
    expect(restored.studentCapability).toBe(created.studentToken);
    expect(restored.attempts).toEqual([]);
    expect(restored.analyses).toEqual([]);
    expect(restored.simulationRuns).toEqual([]);
    expect(restored.achievements).toEqual([]);
    expect(restored.canvasOperations).toEqual([]);

    const deletedMedia = await exports.default.fetch(
      `https://example.test/api/rooms/${created.roomId}/media/${mediaId}`,
      { headers: { Authorization: `Bearer ${created.teacherToken}` } },
    );
    expect(deletedMedia.status).toBe(404);
    await expect(env.MEDIA.get(r2Key)).resolves.toBeNull();

    const studentReload = RoomBootstrapSchema.parse(
      await (
        await exports.default.fetch(
          `https://example.test/api/rooms/${created.roomId}/bootstrap`,
          { headers: { Authorization: `Bearer ${created.studentToken}` } },
        )
      ).json(),
    );
    expect(studentReload.roomId).toBe(created.roomId);
    expect(studentReload.canvasOperations).toEqual(restored.canvasOperations);

    const duplicate = await reset(created.roomId, created.teacherToken);
    expect(duplicate.status).toBe(200);
    const duplicateRoom = RoomBootstrapSchema.parse(
      ((await duplicate.json()) as { room: unknown }).room,
    );
    expect(duplicateRoom.roomSeq).toBe(restored.roomSeq);
  });
});
