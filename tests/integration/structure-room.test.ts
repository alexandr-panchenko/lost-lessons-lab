import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  RoomBootstrapSchema,
  type SocketServerMessage,
} from "../../src/shared/protocol";

async function createStructureRoom() {
  const response = await exports.default.fetch(
    "https://example.test/structure",
    { redirect: "manual" },
  );
  const location = new URL(
    response.headers.get("location") ?? "",
    "https://example.test",
  );
  const roomId = location.pathname.split("/").at(-1);
  const teacherToken = new URLSearchParams(location.hash.slice(1)).get("token");
  if (roomId === undefined || teacherToken === null)
    throw new Error("Invalid structure redirect");
  const teacher = RoomBootstrapSchema.parse(
    await (
      await exports.default.fetch(
        `https://example.test/api/rooms/${roomId}/bootstrap`,
        { headers: { Authorization: `Bearer ${teacherToken}` } },
      )
    ).json(),
  );
  if (teacher.studentCapability === undefined)
    throw new Error("Missing student capability");
  return { roomId, studentToken: teacher.studentCapability, teacher };
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
    if (typeof event.data === "string")
      messages.push(JSON.parse(event.data) as SocketServerMessage);
  });
  socket.send(
    JSON.stringify({
      clientId: "structure-student-integration",
      payload: { token },
      type: "auth",
      v: 1,
    }),
  );
  await waitFor(messages, "room.snapshot");
  return { messages, socket };
}

describe("structure room", () => {
  it("persists underload, collapse, and corrected manual runs", async () => {
    const created = await createStructureRoom();
    expect(created.teacher.fixtureId).toBe("structure-platform-v1");
    expect(created.teacher.canvasOperations.length).toBeGreaterThan(5);
    const student = await connect(created.roomId, created.studentToken);
    const sourceCanvasSeq = Math.max(
      ...created.teacher.canvasOperations.map((record) => record.seq),
    );
    for (const [index, totalLoadKg] of [30, 90, 60].entries()) {
      student.socket.send(
        JSON.stringify({
          clientId: "structure-student-integration",
          payload: {
            idempotencyKey: `structure-manual-${index}`,
            inputs: { itemCount: 12, totalLoadKg, unitLoadKg: 5 },
            previewAsStudent: false,
            sourceCanvasSeq,
            templateId: "structure",
          },
          requestId: `structure-request-${index}`,
          type: "attempt.manual-capture",
          v: 1,
        }),
      );
    }
    const under = await waitFor(student.messages, "simulation.launch", 1);
    const collapse = await waitFor(student.messages, "simulation.launch", 2);
    const correct = await waitFor(student.messages, "simulation.launch", 3);
    expect(under.payload.run).toMatchObject({
      outcome: { resultClass: "structure_underload" },
      templateId: "structure",
    });
    expect(collapse.payload.run).toMatchObject({
      outcome: { resultClass: "structure_collapse" },
      templateId: "structure",
    });
    expect(collapse.payload.achievement).toMatchObject({
      category: "disaster",
      key: "platform-pancake",
    });
    expect(correct.payload.run).toMatchObject({
      outcome: { resultClass: "structure_stable" },
      templateId: "structure",
    });
    expect(correct.payload.achievement).toMatchObject({
      category: "progress",
      key: "support-restored",
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
    student.socket.close();
  });

  it("completes a structure AI attempt through the persisted contract", async () => {
    const created = await createStructureRoom();
    const room = env.ROOMS.getByName(created.roomId);
    const sourceCanvasSeq = Math.max(
      ...created.teacher.canvasOperations.map((record) => record.seq),
    );
    const begun = await room.beginAiAttempt({
      authorId: "structure-ai-integration",
      capability: created.studentToken,
      contentHash: "c".repeat(64),
      idempotencyKey: "structure-ai-attempt",
      previewAsStudent: false,
      sourceCanvasSeq,
    });
    if (!begun.ok) throw new Error("Structure AI attempt was rejected");
    expect(begun.attempt.taskId).toBe("structure-task-v1");
    const r2Key = `rooms/${created.roomId}/attempts/${begun.attempt.id}/${"c".repeat(64)}.png`;
    await env.MEDIA.put(r2Key, new Uint8Array([1]), {
      httpMetadata: { contentType: "image/png" },
    });
    await room.attachAiAttemptMedia({
      attemptId: begun.attempt.id,
      media: {
        byteSize: 1,
        contentHash: "c".repeat(64),
        contentType: "image/png",
        height: 1,
        id: "media_structure_integration",
        width: 1,
      },
      r2Key,
    });
    const completed = await room.completeStructureAiAttempt({
      analysis: {
        confidence: 0.95,
        finalAnswers: [{ name: "totalLoadKg", unit: "kg", value: 60 }],
        firstError: null,
        scenarioInputs: { itemCount: 12, totalLoadKg: 60, unitLoadKg: 5 },
        schemaVersion: "solution-analysis.v1",
        steps: [
          {
            normalizedExpression: "12 * 5 = 60",
            regionId: "line-1",
            status: "valid",
            text: "12 × 5 = 60",
          },
        ],
        studentFacingExplanation: "The total load is 60 kilograms.",
        transcription: "12 × 5 = 60",
        verdict: "correct",
      },
      attemptId: begun.attempt.id,
      disagreement: false,
      inputs: { itemCount: 12, totalLoadKg: 60, unitLoadKg: 5 },
      latencyMs: 100,
      modelId: "gpt-5.6-sol",
      responseId: "resp_structure_integration",
      usedRepair: false,
    });
    expect(completed.run).toMatchObject({
      outcome: { resultClass: "structure_stable" },
      templateId: "structure",
    });
  });
});
