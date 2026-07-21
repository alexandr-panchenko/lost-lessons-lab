import type { Context, Hono } from "hono";
import { z } from "zod";

import {
  bridgeRoomFixture,
  JUDGE_FIXTURE_ID,
  judgePreparedWrongOperations,
} from "../../../fixtures/judge-v1/fixture";
import {
  DEFAULT_WATER_FIXTURE,
  WATER_PREPARED_OPERATIONS,
} from "../../../fixtures/water/packs";
import {
  DEFAULT_SPEED_FIXTURE,
  SPEED_PREPARED_OPERATIONS,
} from "../../../fixtures/speed/packs";
import {
  DEFAULT_STRUCTURE_FIXTURE,
  STRUCTURE_PREPARED_OPERATIONS,
} from "../../../fixtures/structure/packs";
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

type RoomFixture = "bridge" | "judge" | "water" | "speed" | "structure";

function fixtureEvents(
  createdAt: string,
  fixture: RoomFixture,
): RoomFeedEvent[] {
  const selected =
    fixture === "water"
      ? DEFAULT_WATER_FIXTURE
      : fixture === "speed"
        ? DEFAULT_SPEED_FIXTURE
        : fixture === "structure"
          ? DEFAULT_STRUCTURE_FIXTURE
          : bridgeRoomFixture;
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
        supportedSkills:
          fixture === "water"
            ? ["Volume", "Flow rate", "Measurement"]
            : fixture === "speed"
              ? ["Speed", "Time", "Distance"]
              : fixture === "structure"
                ? ["Multiplication", "Load", "Measurement"]
                : [...bridgeRoomFixture.supportedSkills],
      },
      seq: 2,
      type: "teacher.setup",
      visibility: "teacher",
    },
    {
      createdAt,
      payload: {
        fixtureLabel:
          fixture === "judge"
            ? bridgeRoomFixture.fixtureLabel
            : fixture === "water"
              ? selected.fixtureLabel
              : fixture === "speed"
                ? selected.fixtureLabel
                : fixture === "structure"
                  ? selected.fixtureLabel
                  : "Recommended starting point",
        prompt: selected.prompt,
        skillLabel: selected.skillLabel,
        taskTitle: selected.taskTitle,
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
  if (!result.success) return false;
  const hourlyLimit = Number.parseInt(
    context.env.ROOM_CREATE_IP_LIMIT_PER_HOUR,
    10,
  );
  if (!Number.isInteger(hourlyLimit) || hourlyLimit < 1) return false;
  return context.env.ROOMS.getByName(
    `rate_room_create_${key}`,
  ).reserveHourlyRateLimit(`room-create:${key}`, hourlyLimit);
}

async function createRoom(
  context: Context<AppBindings>,
  fixture: RoomFixture,
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
      fixtureId:
        fixture === "judge"
          ? JUDGE_FIXTURE_ID
          : fixture === "water"
            ? DEFAULT_WATER_FIXTURE.fixtureId
            : fixture === "speed"
              ? DEFAULT_SPEED_FIXTURE.fixtureId
              : fixture === "structure"
                ? DEFAULT_STRUCTURE_FIXTURE.fixtureId
                : "guided-room-v1",
      roomId,
      studentCapabilityHash,
      teacherCapabilityHash,
    },
    fixtureEvents(createdAt, fixture),
    fixture === "judge"
      ? judgePreparedWrongOperations
      : fixture === "water"
        ? WATER_PREPARED_OPERATIONS
        : fixture === "speed"
          ? SPEED_PREPARED_OPERATIONS
          : fixture === "structure"
            ? STRUCTURE_PREPARED_OPERATIONS
            : [],
  );

  return new Response(null, {
    headers: {
      ...ROOM_HEADERS,
      Location: `/r/${roomId}#token=${teacherCapability}`,
    },
    status: 302,
  });
}

function createSupportingRoom(
  context: Context<AppBindings>,
  fixture: Exclude<RoomFixture, "bridge" | "judge">,
): Promise<Response> | Response {
  if (context.env.PUBLIC_SUPPORTING_SCENARIOS_ENABLED !== "true") {
    return new Response(null, {
      headers: { ...ROOM_HEADERS, Location: "/" },
      status: 302,
    });
  }
  return createRoom(context, fixture);
}

export function bearerToken(value: string | undefined): string | null {
  if (value === undefined || !value.startsWith("Bearer ")) {
    return null;
  }
  const token = value.slice("Bearer ".length);
  return token.length >= 32 ? token : null;
}

export function registerRoomRoutes(app: Hono<AppBindings>): void {
  app.get("/", (context) => createRoom(context, "bridge"));
  app.get("/judge", (context) => createRoom(context, "judge"));
  app.get("/water", (context) => createSupportingRoom(context, "water"));
  app.get("/speed", (context) => createSupportingRoom(context, "speed"));
  app.get("/structure", (context) =>
    createSupportingRoom(context, "structure"),
  );

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
