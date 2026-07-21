import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  RoomBootstrapSchema,
  type SocketServerMessage,
} from "../../src/shared/protocol";

async function createWaterRoom() {
  const response = await exports.default.fetch("https://example.test/water", {
    redirect: "manual",
  });
  const location = new URL(
    response.headers.get("location") ?? "",
    "https://example.test",
  );
  const roomId = location.pathname.split("/").at(-1);
  const teacherToken = new URLSearchParams(location.hash.slice(1)).get("token");
  if (roomId === undefined || teacherToken === null) {
    throw new Error("Invalid water room redirect");
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

async function connect(roomId: string, token: string) {
  const response = await exports.default.fetch(
    `https://example.test/api/rooms/${roomId}/socket`,
    { headers: { Upgrade: "websocket" } },
  );
  const socket = response.webSocket;
  if (socket === null) throw new Error("Missing WebSocket");
  socket.accept();
  const messages: SocketServerMessage[] = [];
  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      messages.push(JSON.parse(event.data) as SocketServerMessage);
    }
  });
  socket.send(
    JSON.stringify({
      clientId: "water-student-integration",
      payload: { token },
      type: "auth",
      v: 1,
    }),
  );
  await waitFor(messages, "room.snapshot");
  return { messages, socket };
}

async function waitFor<T extends SocketServerMessage["type"]>(
  messages: SocketServerMessage[],
  type: T,
  occurrence = 1,
): Promise<Extract<SocketServerMessage, { type: T }>> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const match = messages.filter((message) => message.type === type)[
      occurrence - 1
    ];
    if (match !== undefined) {
      return match as Extract<SocketServerMessage, { type: T }>;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${type}`);
}

describe("water room", () => {
  it("persists underfill, overflow, and correct manual runs with awards", async () => {
    const created = await createWaterRoom();
    expect(created.teacher.fixtureId).toBe("water-aquarium-v1");
    expect(created.teacher.canvasOperations.length).toBeGreaterThan(5);
    expect(
      created.teacher.canvasOperations.every(
        (record) => record.layer === "student",
      ),
    ).toBe(true);
    expect(created.teacher.events).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ taskTitle: "Fill the aquarium" }),
        type: "task.preview",
      }),
    );
    const student = await connect(created.roomId, created.studentToken);
    const sourceCanvasSeq = Math.max(
      ...created.teacher.canvasOperations.map((record) => record.seq),
    );
    for (const [index, volumeLiters] of [8, 24, 15].entries()) {
      student.socket.send(
        JSON.stringify({
          clientId: "water-student-integration",
          payload: {
            idempotencyKey: `water-manual-${index}`,
            inputs: {
              flowRateLitersPerMinute: 3,
              timeMinutes: 5,
              volumeLiters,
            },
            previewAsStudent: false,
            sourceCanvasSeq,
            templateId: "water",
          },
          requestId: `water-request-${index}`,
          type: "attempt.manual-capture",
          v: 1,
        }),
      );
    }
    const underfill = await waitFor(student.messages, "simulation.launch", 1);
    const overflow = await waitFor(student.messages, "simulation.launch", 2);
    const correct = await waitFor(student.messages, "simulation.launch", 3);
    expect(underfill.payload.run).toMatchObject({
      outcome: { resultClass: "water_underfill" },
      templateId: "water",
    });
    expect(overflow.payload.run).toMatchObject({
      outcome: { resultClass: "water_overflow" },
      templateId: "water",
    });
    expect(overflow.payload.achievement).toMatchObject({
      category: "disaster",
      key: "tidal-surprise",
    });
    expect(correct.payload.run).toMatchObject({
      outcome: { resultClass: "water_correct" },
      templateId: "water",
    });
    expect(correct.payload.achievement).toMatchObject({
      category: "progress",
      key: "level-adjusted",
    });

    const reloaded = RoomBootstrapSchema.parse(
      await (
        await exports.default.fetch(
          `https://example.test/api/rooms/${created.roomId}/bootstrap`,
          { headers: { Authorization: `Bearer ${created.studentToken}` } },
        )
      ).json(),
    );
    expect(reloaded.simulationRuns).toHaveLength(3);
    expect(reloaded.achievements).toHaveLength(3);
    student.socket.close();
  });

  it("completes a water AI attempt through the same persisted contract", async () => {
    const created = await createWaterRoom();
    const room = env.ROOMS.getByName(created.roomId);
    const sourceCanvasSeq = Math.max(
      ...created.teacher.canvasOperations.map((record) => record.seq),
    );
    const begun = await room.beginAiAttempt({
      authorId: "water-ai-integration",
      capability: created.studentToken,
      contentHash: "a".repeat(64),
      idempotencyKey: "water-ai-attempt",
      previewAsStudent: false,
      sourceCanvasSeq,
    });
    if (!begun.ok) throw new Error("Water AI attempt was rejected");
    expect(begun.attempt.taskId).toBe("water-task-v1");
    const mediaId = "media_water_integration";
    const r2Key = `rooms/${created.roomId}/attempts/${begun.attempt.id}/${"a".repeat(64)}.png`;
    await env.MEDIA.put(r2Key, new Uint8Array([1]), {
      httpMetadata: { contentType: "image/png" },
    });
    await room.attachAiAttemptMedia({
      attemptId: begun.attempt.id,
      media: {
        byteSize: 1,
        contentHash: "a".repeat(64),
        contentType: "image/png",
        height: 1,
        id: mediaId,
        width: 1,
      },
      r2Key,
    });
    const completed = await room.completeWaterAiAttempt({
      analysis: {
        confidence: 0.95,
        finalAnswers: [{ name: "volumeLiters", unit: "L", value: 15 }],
        firstError: null,
        scenarioInputs: {
          flowRateLitersPerMinute: 3,
          timeMinutes: 5,
          volumeLiters: 15,
        },
        schemaVersion: "solution-analysis.v1",
        steps: [
          {
            normalizedExpression: "3 * 5 = 15",
            regionId: "line-1",
            status: "valid",
            text: "3 × 5 = 15 L",
          },
        ],
        studentFacingExplanation: "Rate times time gives the water volume.",
        transcription: "3 L/min × 5 min = 15 L",
        verdict: "correct",
      },
      attemptId: begun.attempt.id,
      disagreement: false,
      inputs: {
        flowRateLitersPerMinute: 3,
        timeMinutes: 5,
        volumeLiters: 15,
      },
      latencyMs: 100,
      modelId: "gpt-5.6-sol",
      responseId: "resp_water_integration",
      usedRepair: false,
    });
    expect(completed.run).toMatchObject({
      outcome: { resultClass: "water_correct" },
      templateId: "water",
    });
    expect(completed.analysis.result).toMatchObject({
      scenarioInputs: { volumeLiters: 15 },
    });
  });
});
