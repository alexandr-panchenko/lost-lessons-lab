import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  RoomBootstrapSchema,
  type SocketServerMessage,
} from "../../src/shared/protocol";

type CreatedRoom = {
  roomId: string;
  studentToken: string;
  teacherToken: string;
};

async function createRoom(path = "/judge"): Promise<CreatedRoom> {
  const response = await exports.default.fetch(`https://example.test${path}`, {
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
  return {
    roomId,
    studentToken: teacher.studentCapability,
    teacherToken,
  };
}

async function connect(roomId: string, token: string, clientId: string) {
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
      clientId,
      payload: { token },
      type: "auth",
      v: 1,
    }),
  );
  await waitFor(messages, "room.snapshot");
  return { clientId, messages, socket };
}

async function waitFor<T extends SocketServerMessage["type"]>(
  messages: SocketServerMessage[],
  type: T,
  occurrence = 1,
): Promise<Extract<SocketServerMessage, { type: T }>> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const matches = messages.filter((message) => message.type === type);
    const match = matches[occurrence - 1];
    if (match !== undefined) {
      return match as Extract<SocketServerMessage, { type: T }>;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${type}`);
}

function addStroke(
  clientId: string,
  layer: "student" | "teacher",
  operationId: string,
  previewAsStudent = false,
) {
  return {
    clientId,
    payload: {
      operation: {
        clientOperationId: operationId,
        layer,
        opacity: 1,
        operation: "stroke.add",
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.8, y: 0.7 },
        ],
        strokeId: `stroke-${operationId}`,
        tool: "pen",
        width: 4,
        workspaceId: "bridge-workspace-v1",
      },
      previewAsStudent,
    },
    requestId: `request-${operationId}`,
    type: "canvas.operation",
    v: 1,
  } as const;
}

describe("realtime canvas room", () => {
  it("orders, broadcasts, deduplicates, filters roles, and resumes operations", async () => {
    const room = await createRoom("/");
    const teacher = await connect(
      room.roomId,
      room.teacherToken,
      "teacher-client-m3",
    );
    const student = await connect(
      room.roomId,
      room.studentToken,
      "student-client-m3",
    );

    const studentAdd = addStroke(
      student.clientId,
      "student",
      "student-operation-one",
    );
    student.socket.send(JSON.stringify(studentAdd));
    const accepted = await waitFor(student.messages, "canvas.operation");
    const teacherCopy = await waitFor(teacher.messages, "canvas.operation");
    expect(accepted.payload.seq).toBe(teacherCopy.payload.seq);
    expect(accepted.payload.operation).toEqual(studentAdd.payload.operation);

    student.socket.send(JSON.stringify(studentAdd));
    const duplicateAck = await waitFor(student.messages, "command.ack", 2);
    expect(duplicateAck.payload.duplicate).toBe(true);

    student.socket.send(
      JSON.stringify(
        addStroke(student.clientId, "teacher", "forbidden-teacher-stroke"),
      ),
    );
    expect(
      (await waitFor(student.messages, "command.rejected")).payload.reason,
    ).toBe("permission_denied");

    teacher.socket.send(
      JSON.stringify(
        addStroke(teacher.clientId, "teacher", "teacher-operation-one"),
      ),
    );
    const teacherAnnotation = await waitFor(
      student.messages,
      "canvas.operation",
      2,
    );
    expect(teacherAnnotation.payload.operation).toMatchObject({
      layer: "teacher",
      operation: "stroke.add",
    });

    const reconnect = await connect(
      room.roomId,
      room.studentToken,
      "student-reconnect-m3",
    );
    reconnect.socket.send(
      JSON.stringify({
        clientId: reconnect.clientId,
        payload: { lastSeenSeq: 3 },
        type: "room.resume",
        v: 1,
      }),
    );
    const delta = await waitFor(reconnect.messages, "room.delta");
    expect(delta.payload.canvasOperations).toHaveLength(2);
    expect(
      new Set(delta.payload.canvasOperations.map((record) => record.seq)).size,
    ).toBe(2);

    const snapshot = (await waitFor(
      reconnect.messages,
      "room.snapshot",
    )) as Extract<SocketServerMessage, { type: "room.snapshot" }>;
    expect(snapshot.payload.canvasOperations).toHaveLength(2);
    teacher.socket.close();
    student.socket.close();
    reconnect.socket.close();
  });

  it("captures immutable attempts and persists deterministic runs", async () => {
    const room = await createRoom();
    const student = await connect(
      room.roomId,
      room.studentToken,
      "attempt-student-m3",
    );
    student.socket.send(
      JSON.stringify(
        addStroke(student.clientId, "student", "attempt-source-one"),
      ),
    );
    const source = await waitFor(student.messages, "canvas.operation");

    const attemptCommand = {
      clientId: student.clientId,
      payload: {
        idempotencyKey: "manual-attempt-one",
        inputs: { deployedLengthMeters: 4.08, fractionAsDecimal: 0.34 },
        previewAsStudent: false,
        sourceCanvasSeq: source.payload.seq,
        templateId: "bridge",
      },
      requestId: "request-manual-attempt-one",
      type: "attempt.manual-capture",
      v: 1,
    } as const;
    student.socket.send(JSON.stringify(attemptCommand));
    const firstLaunch = await waitFor(student.messages, "simulation.launch");
    expect(firstLaunch.payload.run.outcome.resultClass).toBe(
      "bridge_far_too_short",
    );
    expect(firstLaunch.payload.achievement).toMatchObject({
      category: "disaster",
      key: "worlds-shortest-bridge",
      title: "The World's Shortest Bridge",
    });

    student.socket.send(
      JSON.stringify(
        addStroke(student.clientId, "student", "attempt-source-two"),
      ),
    );
    const laterStroke = await waitFor(student.messages, "canvas.operation", 2);
    expect(laterStroke.payload.seq).toBeGreaterThan(source.payload.seq);

    student.socket.send(JSON.stringify(attemptCommand));
    const duplicateLaunch = await waitFor(
      student.messages,
      "simulation.launch",
      2,
    );
    expect(duplicateLaunch.payload.attempt.id).toBe(
      firstLaunch.payload.attempt.id,
    );

    student.socket.send(
      JSON.stringify({
        clientId: student.clientId,
        payload: {
          idempotencyKey: "manual-attempt-two",
          inputs: { deployedLengthMeters: 9, fractionAsDecimal: 0.75 },
          previewAsStudent: false,
          sourceCanvasSeq: laterStroke.payload.seq,
          templateId: "bridge",
        },
        requestId: "request-manual-attempt-two",
        type: "attempt.manual-capture",
        v: 1,
      }),
    );
    const secondLaunch = await waitFor(
      student.messages,
      "simulation.launch",
      3,
    );
    expect(secondLaunch.payload.run.outcome.resultClass).toBe("bridge_correct");
    expect(secondLaunch.payload.achievement).toMatchObject({
      category: "progress",
      key: "fixed-it",
      title: "Fixed It",
    });

    const persisted = RoomBootstrapSchema.parse(
      await (
        await exports.default.fetch(
          `https://example.test/api/rooms/${room.roomId}/bootstrap`,
          { headers: { Authorization: `Bearer ${room.studentToken}` } },
        )
      ).json(),
    );
    expect(persisted.attempts).toHaveLength(2);
    expect(persisted.achievements).toHaveLength(2);
    expect(persisted.simulationRuns).toHaveLength(2);
    expect(persisted.attempts[0]?.sourceCanvasSeq).toBe(source.payload.seq);
    expect(persisted.simulationRuns[0]).toMatchObject({
      inputs: { deployedLengthMeters: 4.08 },
      templateId: "bridge",
    });
    student.socket.close();
  });
});
