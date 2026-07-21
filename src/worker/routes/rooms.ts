import type { Context, Hono } from "hono";
import { z } from "zod";

import {
  bridgeRoomFixture,
  JUDGE_FIXTURE_ID,
} from "../../../fixtures/judge-v1/fixture";
import type { RoomFeedEvent } from "../../shared/protocol";
import type { WorkerEnv } from "../env";
import {
  deriveStudentCapability,
  generateRoomId,
  generateTeacherCapability,
  hashCapability,
  roomCreationRateKey,
} from "../security/capabilities";

type AppBindings = { Bindings: WorkerEnv };

export const RoomIdSchema = z.string().regex(/^rm_[A-Za-z0-9_-]{20,40}$/u);

export const ROOM_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function fixtureEvents(createdAt: string, judge: boolean): RoomFeedEvent[] {
  return [
    {
      createdAt,
      payload: {
        message:
          "Turn handwritten math into a visible physical consequence, then correct it together.",
        title: "Welcome to Lost Lessons Lab",
      },
      seq: 1,
      type: "room.welcome",
      visibility: "all",
    },
    {
      createdAt,
      payload: {
        prompt: "What does your learner struggle with?",
        supportedSkills: [...bridgeRoomFixture.supportedSkills],
      },
      seq: 2,
      type: "teacher.setup",
      visibility: "teacher",
    },
    {
      createdAt,
      payload: {
        fixtureLabel: judge
          ? bridgeRoomFixture.fixtureLabel
          : "Recommended starting point",
        prompt: bridgeRoomFixture.prompt,
        skillLabel: bridgeRoomFixture.skillLabel,
        taskTitle: bridgeRoomFixture.taskTitle,
      },
      seq: 3,
      type: "task.preview",
      visibility: "all",
    },
  ];
}

async function applyRoomCreationLimit(
  context: Context<AppBindings>,
): Promise<boolean> {
  const actor = context.req.header("CF-Connecting-IP") ?? "local-development";
  const key = await roomCreationRateKey(context.env.ROOM_TOKEN_PEPPER, actor);
  const result = await context.env.ROOM_CREATE_RATE_LIMITER.limit({ key });
  return result.success;
}

async function createRoom(
  context: Context<AppBindings>,
  judge: boolean,
): Promise<Response> {
  if (!(await applyRoomCreationLimit(context))) {
    return context.json(
      { error: "room_creation_rate_limited" },
      429,
      ROOM_HEADERS,
    );
  }

  const roomId = generateRoomId();
  const teacherCapability = generateTeacherCapability();
  const studentCapability = await deriveStudentCapability(
    context.env.ROOM_TOKEN_PEPPER,
    roomId,
    teacherCapability,
  );
  const teacherCapabilityHash = await hashCapability(
    context.env.ROOM_TOKEN_PEPPER,
    "teacher",
    teacherCapability,
  );
  const studentCapabilityHash = await hashCapability(
    context.env.ROOM_TOKEN_PEPPER,
    "student",
    studentCapability,
  );
  const createdAt = new Date().toISOString();
  const room = context.env.ROOMS.getByName(roomId);
  await room.initialize(
    {
      fixtureId: judge ? JUDGE_FIXTURE_ID : "guided-room-v1",
      roomId,
      studentCapabilityHash,
      teacherCapabilityHash,
    },
    fixtureEvents(createdAt, judge),
  );

  return new Response(null, {
    headers: {
      ...ROOM_HEADERS,
      Location: `/r/${roomId}#token=${teacherCapability}`,
    },
    status: 302,
  });
}

export function bearerToken(value: string | undefined): string | null {
  if (value === undefined || !value.startsWith("Bearer ")) {
    return null;
  }
  const token = value.slice("Bearer ".length);
  return token.length >= 32 ? token : null;
}

export function registerRoomRoutes(app: Hono<AppBindings>): void {
  app.get("/", (context) => createRoom(context, false));
  app.get("/judge", (context) => createRoom(context, true));

  app.get("/api/rooms/:roomId/bootstrap", async (context) => {
    const roomId = RoomIdSchema.safeParse(context.req.param("roomId"));
    const token = bearerToken(context.req.header("Authorization"));
    if (!roomId.success || token === null) {
      return context.json({ error: "unauthorized" }, 401, ROOM_HEADERS);
    }
    const snapshot = await context.env.ROOMS.getByName(roomId.data).bootstrap(
      token,
    );
    if (snapshot === null) {
      return context.json({ error: "unauthorized" }, 401, ROOM_HEADERS);
    }
    return context.json(snapshot, 200, ROOM_HEADERS);
  });

  app.get("/api/rooms/:roomId/socket", (context) => {
    const roomId = RoomIdSchema.safeParse(context.req.param("roomId"));
    if (!roomId.success) {
      return context.json({ error: "not_found" }, 404, ROOM_HEADERS);
    }
    return context.env.ROOMS.getByName(roomId.data).fetch(context.req.raw);
  });
}
