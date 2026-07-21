import { z } from "zod";

const productionOrigin = z
  .url()
  .parse(
    process.env.PRODUCTION_URL ??
      "https://lost-lessons-lab.sanocks.workers.dev",
  );
const healthResponse = await fetch(new URL("/api/health", productionOrigin));

if (!healthResponse.ok) {
  throw new Error(
    `Production health check failed with ${healthResponse.status}`,
  );
}

const health = z
  .object({
    service: z.literal("lost-lessons-lab"),
    status: z.literal("ok"),
  })
  .parse(await healthResponse.json());

const RoomRedirectSchema = z.object({
  roomId: z.string().regex(/^rm_[A-Za-z0-9_-]{20,40}$/u),
  token: z.string().min(32),
});

const BootstrapSchema = z.object({
  achievements: z.array(z.unknown()),
  attempts: z.array(z.unknown()),
  canvasOperations: z.array(z.unknown()),
  events: z.array(
    z.object({
      type: z.string(),
      visibility: z.enum(["all", "teacher"]),
    }),
  ),
  fixtureId: z.string(),
  role: z.enum(["teacher", "student"]),
  roomId: z.string(),
  simulationRuns: z.array(z.unknown()),
  studentCapability: z.string().min(32).optional(),
});

async function createRoom(path = "/judge") {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    response = await fetch(new URL(path, productionOrigin), {
      redirect: "manual",
    });
    if (response.status === 302) break;
    if (response.status !== 200 || attempt === 9) break;
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (response === undefined) throw new Error("Room creation did not run.");
  if (response.status !== 302) {
    throw new Error(`Judge room creation failed with ${response.status}`);
  }
  if (response.headers.get("cache-control") !== "no-store") {
    throw new Error("Judge room redirect is missing no-store protection.");
  }
  const location = response.headers.get("location");
  if (location === null) throw new Error("Judge room redirect is missing.");
  const url = new URL(location, productionOrigin);
  const match = /^\/r\/(rm_[A-Za-z0-9_-]{20,40})$/u.exec(url.pathname);
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  return RoomRedirectSchema.parse({ roomId: match?.[1], token });
}

async function bootstrap(roomId: string, token: string) {
  return fetch(new URL(`/api/rooms/${roomId}/bootstrap`, productionOrigin), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

const firstRoom = await createRoom();
const secondRoom = await createRoom();
if (firstRoom.roomId === secondRoom.roomId) {
  throw new Error("Two judge requests returned the same room.");
}

for (const path of ["/water", "/speed", "/structure"] as const) {
  const response = await fetch(new URL(path, productionOrigin), {
    redirect: "manual",
  });
  if (response.status !== 302 || response.headers.get("location") !== "/") {
    throw new Error(`${path} is still publicly enabled.`);
  }
}

const teacherResponse = await bootstrap(firstRoom.roomId, firstRoom.token);
if (!teacherResponse.ok) {
  throw new Error(`Teacher bootstrap failed with ${teacherResponse.status}`);
}
const teacher = BootstrapSchema.parse(await teacherResponse.json());
if (
  teacher.role !== "teacher" ||
  teacher.studentCapability === undefined ||
  !teacher.events.some((event) => event.type === "teacher.setup")
) {
  throw new Error("Teacher bootstrap is missing private room state.");
}

const studentResponse = await bootstrap(
  firstRoom.roomId,
  teacher.studentCapability,
);
if (!studentResponse.ok) {
  throw new Error(`Student bootstrap failed with ${studentResponse.status}`);
}
const student = BootstrapSchema.parse(await studentResponse.json());
if (
  student.role !== "student" ||
  student.studentCapability !== undefined ||
  student.events.some((event) => event.visibility === "teacher")
) {
  throw new Error("Student bootstrap exposed teacher-only room state.");
}

const invalidResponse = await bootstrap(
  firstRoom.roomId,
  "invalid-capability-value-that-is-long-enough",
);
if (invalidResponse.status !== 401) {
  throw new Error(`Invalid capability returned ${invalidResponse.status}.`);
}

const socketUrl = new URL(
  `/api/rooms/${firstRoom.roomId}/socket`,
  productionOrigin,
);
socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(socketUrl);
const socketMessages: unknown[] = [];
socket.addEventListener("message", (event) => {
  if (typeof event.data === "string") {
    socketMessages.push(JSON.parse(event.data) as unknown);
  }
});

async function waitForSocketType(type: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const message = socketMessages.find(
      (candidate) =>
        typeof candidate === "object" &&
        candidate !== null &&
        "type" in candidate &&
        candidate.type === type,
    );
    if (message !== undefined) return message;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Production WebSocket did not send ${type}.`);
}

await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("Production WebSocket did not open.")),
    5_000,
  );
  socket.addEventListener("open", () => {
    clearTimeout(timeout);
    resolve();
  });
  socket.addEventListener("error", () => {
    clearTimeout(timeout);
    reject(new Error("Production WebSocket failed."));
  });
});

const smokeClientId = crypto.randomUUID();
socket.send(
  JSON.stringify({
    clientId: smokeClientId,
    payload: { token: teacher.studentCapability },
    type: "auth",
    v: 1,
  }),
);
await waitForSocketType("auth.accepted");
const smokeOperationId = crypto.randomUUID();
socket.send(
  JSON.stringify({
    clientId: smokeClientId,
    payload: {
      operation: {
        clientOperationId: smokeOperationId,
        layer: "student",
        opacity: 1,
        operation: "stroke.add",
        points: [
          { x: 0.2, y: 0.3 },
          { x: 0.7, y: 0.6 },
        ],
        strokeId: crypto.randomUUID(),
        tool: "pen",
        width: 4,
        workspaceId: "bridge-workspace-v1",
      },
      previewAsStudent: false,
    },
    requestId: crypto.randomUUID(),
    type: "canvas.operation",
    v: 1,
  }),
);
const operationMessage = z
  .object({
    payload: z.object({ seq: z.number().int().positive() }),
    type: z.literal("canvas.operation"),
  })
  .passthrough()
  .parse(await waitForSocketType("canvas.operation"));

socket.send(
  JSON.stringify({
    clientId: smokeClientId,
    payload: {
      idempotencyKey: crypto.randomUUID(),
      inputs: { deployedLengthMeters: 4.08, fractionAsDecimal: 0.34 },
      previewAsStudent: false,
      sourceCanvasSeq: operationMessage.payload.seq,
      templateId: "bridge",
    },
    requestId: crypto.randomUUID(),
    type: "attempt.manual-capture",
    v: 1,
  }),
);
const launch = z
  .object({
    payload: z.object({
      achievement: z.object({
        category: z.literal("disaster"),
        key: z.literal("worlds-shortest-bridge"),
      }),
      run: z.object({
        outcome: z.object({
          resultClass: z.literal("bridge_far_too_short"),
        }),
      }),
    }),
    type: z.literal("simulation.launch"),
  })
  .passthrough()
  .parse(await waitForSocketType("simulation.launch"));
if (launch.payload.run.outcome.resultClass !== "bridge_far_too_short") {
  throw new Error("Production deterministic bridge classification failed.");
}
socket.close();

const persistedStudent = BootstrapSchema.parse(
  await (await bootstrap(firstRoom.roomId, teacher.studentCapability)).json(),
);
if (
  persistedStudent.canvasOperations.length !==
    teacher.canvasOperations.length + 1 ||
  persistedStudent.attempts.length !== 1 ||
  persistedStudent.simulationRuns.length !== 1 ||
  persistedStudent.achievements.length !== 1
) {
  throw new Error("Production M3 room state did not persist.");
}

const resetResponse = await fetch(
  new URL(`/api/rooms/${firstRoom.roomId}/reset`, productionOrigin),
  {
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    headers: {
      Authorization: `Bearer ${firstRoom.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  },
);
if (!resetResponse.ok) {
  throw new Error(`Production task reset failed with ${resetResponse.status}`);
}
const resetRoom = z
  .object({ room: BootstrapSchema })
  .parse(await resetResponse.json()).room;
if (
  resetRoom.roomId !== firstRoom.roomId ||
  resetRoom.canvasOperations.length !== teacher.canvasOperations.length ||
  resetRoom.attempts.length !== 0 ||
  resetRoom.simulationRuns.length !== 0 ||
  resetRoom.achievements.length !== 0
) {
  throw new Error("Production task reset did not restore the judge fixture.");
}

const roomDocument = await fetch(
  new URL(`/r/${firstRoom.roomId}`, productionOrigin),
);
if (!roomDocument.ok || !roomDocument.headers.get("content-security-policy")) {
  throw new Error("Room document is unavailable or missing its CSP.");
}

console.log(
  `Production smoke passed for ${health.service}: isolated prepared rooms, role filtering, realtime canvas persistence, deterministic bridge and disaster award, teacher reset, invalid-capability rejection, and protected room headers.`,
);
