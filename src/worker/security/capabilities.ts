const CAPABILITY_BYTES = 32;
const ROOM_ID_BYTES = 16;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function hmac(pepper: string, value: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return new Uint8Array(signature);
}

export function generateTeacherCapability(): string {
  return bytesToBase64Url(randomBytes(CAPABILITY_BYTES));
}

export function generateRoomId(): string {
  return `rm_${bytesToBase64Url(randomBytes(ROOM_ID_BYTES))}`;
}

export async function deriveStudentCapability(
  pepper: string,
  roomId: string,
  teacherCapability: string,
): Promise<string> {
  return bytesToBase64Url(
    await hmac(pepper, `student-capability:v1:${roomId}:${teacherCapability}`),
  );
}

export async function hashCapability(
  pepper: string,
  role: "teacher" | "student",
  capability: string,
): Promise<string> {
  return bytesToBase64Url(
    await hmac(pepper, `capability-hash:v1:${role}:${capability}`),
  );
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

export async function roomCreationRateKey(
  pepper: string,
  actor: string,
): Promise<string> {
  return bytesToBase64Url(await hmac(pepper, `room-create-rate:v1:${actor}`));
}
