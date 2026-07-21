import { z } from "zod";

import { AiAttemptSchema } from "../../shared/analysis-types";
import { RoomBootstrapSchema, type RoomBootstrap } from "../../shared/protocol";

export type RoomLocation = {
  roomId: string;
  token: string;
};

export function readRoomLocation(location: Location): RoomLocation | null {
  const roomMatch = /^\/r\/(rm_[A-Za-z0-9_-]{20,40})$/u.exec(location.pathname);
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  if (roomMatch?.[1] === undefined || token === null || token.length < 32) {
    return null;
  }
  return { roomId: roomMatch[1], token };
}

export async function fetchRoomBootstrap(
  room: RoomLocation,
  signal: AbortSignal,
): Promise<RoomBootstrap> {
  const response = await fetch(`/api/rooms/${room.roomId}/bootstrap`, {
    headers: { Authorization: `Bearer ${room.token}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "This room link is not authorized."
        : "Room unavailable.",
    );
  }
  return RoomBootstrapSchema.parse(await response.json());
}

export function roomSocketUrl(roomId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/rooms/${roomId}/socket`;
}

export async function submitAnalysisAttempt(input: {
  authorId: string;
  contentHash: string;
  idempotencyKey: string;
  mediaBase64: string;
  previewAsStudent: boolean;
  room: RoomLocation;
  sourceCanvasSeq: number;
}): Promise<{
  attempt: import("../../shared/analysis-types").AiAttempt;
  duplicate: boolean;
}> {
  const response = await fetch(`/api/rooms/${input.room.roomId}/attempts`, {
    body: JSON.stringify({
      authorId: input.authorId,
      contentHash: input.contentHash,
      idempotencyKey: input.idempotencyKey,
      mediaBase64: input.mediaBase64,
      previewAsStudent: input.previewAsStudent,
      sourceCanvasSeq: input.sourceCanvasSeq,
    }),
    headers: {
      Authorization: `Bearer ${input.room.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? String(body.error)
        : "analysis_failed";
    throw new Error(error);
  }
  const envelope = z
    .object({ attempt: AiAttemptSchema, duplicate: z.boolean() })
    .strict()
    .parse(body);
  return envelope;
}

export async function resetRoom(room: RoomLocation): Promise<RoomBootstrap> {
  const response = await fetch(`/api/rooms/${room.roomId}/reset`, {
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    headers: {
      Authorization: `Bearer ${room.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? String(body.error)
        : "reset_failed";
    throw new Error(error);
  }
  return z.object({ room: RoomBootstrapSchema }).strict().parse(body).room;
}
