import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  RoomBootstrapSchema,
  type SocketServerMessage,
} from "../../src/shared/protocol";

async function waitFor<T extends SocketServerMessage["type"]>(
  messages: SocketServerMessage[],
  type: T,
): Promise<Extract<SocketServerMessage, { type: T }>> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const match = messages.find((message) => message.type === type);
    if (match !== undefined)
      return match as Extract<SocketServerMessage, { type: T }>;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${type}`);
}

type CreatedRoom = {
  roomId: string;
  token: string;
};

async function createRoom(path = "/judge"): Promise<CreatedRoom> {
  const response = await exports.default.fetch(`https://example.test${path}`, {
    redirect: "manual",
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");

  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  const url = new URL(location ?? "", "https://example.test");
  const roomId = url.pathname.split("/").at(-1);
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  if (roomId === undefined || token === null)
    throw new Error("Invalid room redirect");
  return { roomId, token };
}

async function bootstrap(roomId: string, token: string) {
  return exports.default.fetch(
    `https://example.test/api/rooms/${roomId}/bootstrap`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

describe("persistent guided rooms", () => {
  it("creates isolated judge rooms", async () => {
    const first = await createRoom();
    const second = await createRoom();

    expect(first.roomId).not.toBe(second.roomId);
    expect(first.token).not.toBe(second.token);
  });

  it("opens judge and ordinary rooms with an empty editable canvas", async () => {
    const judgeCreated = await createRoom("/judge");
    const judge = RoomBootstrapSchema.parse(
      await (await bootstrap(judgeCreated.roomId, judgeCreated.token)).json(),
    );
    const ordinaryCreated = await createRoom("/");
    const ordinary = RoomBootstrapSchema.parse(
      await (
        await bootstrap(ordinaryCreated.roomId, ordinaryCreated.token)
      ).json(),
    );

    expect(judge.canvasOperations).toEqual([]);
    expect(ordinary.canvasOperations).toEqual([]);
  });

  it("filters private teacher setup from the learner", async () => {
    const created = await createRoom("/");
    const teacherResponse = await bootstrap(created.roomId, created.token);
    expect(teacherResponse.status).toBe(200);
    const teacher = RoomBootstrapSchema.parse(await teacherResponse.json());
    expect(teacher.role).toBe("teacher");
    expect(teacher.studentCapability).toBeDefined();
    expect(teacher.events.some((event) => event.type === "teacher.setup")).toBe(
      true,
    );

    const studentResponse = await bootstrap(
      created.roomId,
      teacher.studentCapability ?? "",
    );
    const student = RoomBootstrapSchema.parse(await studentResponse.json());
    expect(student.role).toBe("student");
    expect(student.studentCapability).toBeUndefined();
    expect(student.events.some((event) => event.type === "teacher.setup")).toBe(
      false,
    );
    expect(student.events.some((event) => event.type === "task.preview")).toBe(
      true,
    );
  });

  it("reconstructs the same room and rejects invalid capabilities", async () => {
    const created = await createRoom();
    const first = RoomBootstrapSchema.parse(
      await (await bootstrap(created.roomId, created.token)).json(),
    );
    const reloaded = RoomBootstrapSchema.parse(
      await (await bootstrap(created.roomId, created.token)).json(),
    );
    expect(reloaded).toEqual(first);

    const unauthorized = await bootstrap(
      created.roomId,
      "invalid-capability-value-that-is-long-enough-for-the-boundary",
    );
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      error: "unauthorized",
    });
  });

  it("sends no WebSocket room state before authentication", async () => {
    const created = await createRoom();
    const response = await exports.default.fetch(
      `https://example.test/api/rooms/${created.roomId}/socket`,
      { headers: { Upgrade: "websocket" } },
    );
    const socket = response.webSocket;
    expect(response.status).toBe(101);
    expect(socket).not.toBeNull();
    if (socket === null) throw new Error("Missing WebSocket");
    socket.accept();

    const messages: SocketServerMessage[] = [];
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        messages.push(JSON.parse(event.data) as SocketServerMessage);
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(messages).toEqual([]);

    socket.send(
      JSON.stringify({
        clientId: "integration-client",
        payload: { token: created.token },
        type: "auth",
        v: 1,
      }),
    );
    await waitFor(messages, "room.snapshot");
    expect(messages.map((message) => message.type)).toEqual([
      "auth.accepted",
      "room.snapshot",
    ]);
    socket.close();
  });
});
