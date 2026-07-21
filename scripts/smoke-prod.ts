import { z } from "zod";

const productionOrigin = z.url().parse(process.env.PRODUCTION_URL);
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
  events: z.array(
    z.object({
      type: z.string(),
      visibility: z.enum(["all", "teacher"]),
    }),
  ),
  role: z.enum(["teacher", "student"]),
  roomId: z.string(),
  studentCapability: z.string().min(32).optional(),
});

async function createJudgeRoom() {
  const response = await fetch(new URL("/judge", productionOrigin), {
    redirect: "manual",
  });
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

const firstRoom = await createJudgeRoom();
const secondRoom = await createJudgeRoom();
if (firstRoom.roomId === secondRoom.roomId) {
  throw new Error("Two judge requests returned the same room.");
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

const roomDocument = await fetch(
  new URL(`/r/${firstRoom.roomId}`, productionOrigin),
);
if (!roomDocument.ok || !roomDocument.headers.get("content-security-policy")) {
  throw new Error("Room document is unavailable or missing its CSP.");
}

console.log(
  `Production smoke passed for ${health.service}: isolated rooms, role filtering, invalid-capability rejection, and protected room headers.`,
);
