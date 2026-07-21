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
