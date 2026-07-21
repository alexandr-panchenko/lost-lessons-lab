import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  RoomBootstrapSchema,
  type SocketServerMessage,
} from "../../src/shared/protocol";

async function createSpeedRoom() {
  const response = await exports.default.fetch("https://example.test/speed", {
    redirect: "manual",
  });
  const location = new URL(
    response.headers.get("location") ?? "",
    "https://example.test",
  );
  const roomId = location.pathname.split("/").at(-1);
  const teacherToken = new URLSearchParams(location.hash.slice(1)).get("token");
  if (roomId === undefined || teacherToken === null)
    throw new Error("Invalid speed redirect");
  const teacher = RoomBootstrapSchema.parse(
    await (
      await exports.default.fetch(
        `https://example.test/api/rooms/${roomId}/bootstrap`,
        {
          headers: { Authorization: `Bearer ${teacherToken}` },
        },
      )
    ).json(),
  );
  if (teacher.studentCapability === undefined)
    throw new Error("Missing student capability");
  return { roomId, studentToken: teacher.studentCapability, teacher };
}

async function connect(roomId: string, token: string) {
  const response = await exports.default.fetch(
    `https://example.test/api/rooms/${roomId}/socket`,
    {
      headers: { Upgrade: "websocket" },
    },
  );
  const socket = response.webSocket;
  if (socket === null) throw new Error("Missing WebSocket");
  socket.accept();
  const messages: SocketServerMessage[] = [];
  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string")
      messages.push(JSON.parse(event.data) as SocketServerMessage);
  });
  socket.send(
    JSON.stringify({
      clientId: "speed-student-integration",
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
    if (match !== undefined)
      return match as Extract<SocketServerMessage, { type: T }>;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${type}`);
}

describe("speed room", () => {
  it("persists short, collision, and corrected manual motion runs", async () => {
    const created = await createSpeedRoom();
    expect(created.teacher.fixtureId).toBe("speed-shuttle-v1");
    expect(created.teacher.canvasOperations.length).toBeGreaterThan(5);
    const student = await connect(created.roomId, created.studentToken);
    const sourceCanvasSeq = Math.max(
      ...created.teacher.canvasOperations.map((record) => record.seq),
    );
    for (const [index, distanceMeters] of [12, 36, 24].entries()) {
      student.socket.send(
        JSON.stringify({
          clientId: "speed-student-integration",
          payload: {
            idempotencyKey: `speed-manual-${index}`,
            inputs: { distanceMeters, speedMetersPerSecond: 8, timeSeconds: 3 },
            previewAsStudent: false,
            sourceCanvasSeq,
            templateId: "speed",
          },
          requestId: `speed-request-${index}`,
          type: "attempt.manual-capture",
          v: 1,
        }),
      );
    }
    const short = await waitFor(student.messages, "simulation.launch", 1);
    const collision = await waitFor(student.messages, "simulation.launch", 2);
    const correct = await waitFor(student.messages, "simulation.launch", 3);
    expect(short.payload.run).toMatchObject({
      outcome: { resultClass: "speed_short" },
      templateId: "speed",
    });
    expect(collision.payload.run).toMatchObject({
      outcome: { resultClass: "speed_collision" },
      templateId: "speed",
    });
    expect(collision.payload.achievement).toMatchObject({
      category: "disaster",
      key: "bumper-boop",
    });
    expect(correct.payload.run).toMatchObject({
      outcome: { resultClass: "speed_correct" },
      templateId: "speed",
    });
    expect(correct.payload.achievement).toMatchObject({
      category: "progress",
      key: "route-corrected",
    });
    const reloaded = RoomBootstrapSchema.parse(
      await (
        await exports.default.fetch(
          `https://example.test/api/rooms/${created.roomId}/bootstrap`,
          {
            headers: { Authorization: `Bearer ${created.studentToken}` },
          },
        )
      ).json(),
    );
    expect(reloaded.simulationRuns).toHaveLength(3);
    student.socket.close();
  });

  it("completes a speed AI attempt through the persisted contract", async () => {
    const created = await createSpeedRoom();
    const room = env.ROOMS.getByName(created.roomId);
    const sourceCanvasSeq = Math.max(
      ...created.teacher.canvasOperations.map((record) => record.seq),
    );
    const begun = await room.beginAiAttempt({
      authorId: "speed-ai-integration",
      capability: created.studentToken,
      contentHash: "b".repeat(64),
      idempotencyKey: "speed-ai-attempt",
      previewAsStudent: false,
      sourceCanvasSeq,
    });
    if (!begun.ok) throw new Error("Speed AI attempt was rejected");
    expect(begun.attempt.taskId).toBe("speed-task-v1");
    const r2Key = `rooms/${created.roomId}/attempts/${begun.attempt.id}/${"b".repeat(64)}.png`;
    await env.MEDIA.put(r2Key, new Uint8Array([1]), {
      httpMetadata: { contentType: "image/png" },
    });
    await room.attachAiAttemptMedia({
      attemptId: begun.attempt.id,
      media: {
        byteSize: 1,
        contentHash: "b".repeat(64),
        contentType: "image/png",
        height: 1,
        id: "media_speed_integration",
        width: 1,
      },
      r2Key,
    });
    const completed = await room.completeSpeedAiAttempt({
      analysis: {
        confidence: 0.95,
        finalAnswers: [{ name: "distanceMeters", unit: "m", value: 24 }],
        firstError: null,
        scenarioInputs: {
          distanceMeters: 24,
          speedMetersPerSecond: 8,
          timeSeconds: 3,
        },
        schemaVersion: "solution-analysis.v1",
        steps: [
          {
            normalizedExpression: "8 * 3 = 24",
            regionId: "line-1",
            status: "valid",
            text: "8 × 3 = 24 m",
          },
        ],
        studentFacingExplanation: "Speed times time gives 24 meters.",
        transcription: "8 m/s × 3 s = 24 m",
        verdict: "correct",
      },
      attemptId: begun.attempt.id,
      disagreement: false,
      inputs: { distanceMeters: 24, speedMetersPerSecond: 8, timeSeconds: 3 },
      latencyMs: 100,
      modelId: "gpt-5.6-sol",
      responseId: "resp_speed_integration",
      usedRepair: false,
    });
    expect(completed.run).toMatchObject({
      outcome: { resultClass: "speed_correct" },
      templateId: "speed",
    });
  });
});
