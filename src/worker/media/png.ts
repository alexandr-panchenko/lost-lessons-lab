import { z } from "zod";

export const AttemptUploadSchema = z
  .object({
    authorId: z.string().min(8).max(128),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
    idempotencyKey: z.string().min(8).max(128),
    mediaBase64: z.string().min(16),
    previewAsStudent: z.boolean().default(false),
    sourceCanvasSeq: z.number().int().nonnegative(),
  })
  .strict();
export type AttemptUpload = z.infer<typeof AttemptUploadSchema>;

export type ValidatedPng = {
  bytes: Uint8Array;
  contentHash: string;
  height: number;
  width: number;
};

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(value) || value.length % 4 !== 0) {
    throw new Error("invalid_base64");
  }
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function uint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! * 0x1000000 +
    bytes[offset + 1]! * 0x10000 +
    bytes[offset + 2]! * 0x100 +
    bytes[offset + 3]!
  );
}

function hasCompletePngStructure(bytes: Uint8Array): boolean {
  let offset = 8;
  let sawImageData = false;
  let sawEnd = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = uint32(bytes, offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.byteLength) return false;
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (offset === 8 && (type !== "IHDR" || length !== 13)) return false;
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") {
      sawEnd = length === 0 && chunkEnd === bytes.byteLength;
      break;
    }
    offset = chunkEnd;
  }
  return sawImageData && sawEnd;
}

export async function validatePngUpload(
  upload: AttemptUpload,
  limits: { maxBytes: number; maxEdge: number },
): Promise<ValidatedPng> {
  const estimatedBytes = Math.floor((upload.mediaBase64.length * 3) / 4);
  if (estimatedBytes > limits.maxBytes + 2) throw new Error("media_too_large");
  const bytes = decodeBase64(upload.mediaBase64);
  if (bytes.byteLength === 0 || bytes.byteLength > limits.maxBytes) {
    throw new Error("media_too_large");
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.byteLength < 33 ||
    signature.some((value, index) => bytes[index] !== value) ||
    new TextDecoder().decode(bytes.slice(12, 16)) !== "IHDR" ||
    !hasCompletePngStructure(bytes)
  ) {
    throw new Error("invalid_png");
  }
  const width = uint32(bytes, 16);
  const height = uint32(bytes, 20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const interlace = bytes[28];
  if (
    width < 1 ||
    height < 1 ||
    width > limits.maxEdge ||
    height > limits.maxEdge ||
    bitDepth !== 8 ||
    ![0, 2, 4, 6].includes(colorType ?? -1) ||
    ![0, 1].includes(interlace ?? -1)
  ) {
    throw new Error("invalid_png_dimensions");
  }
  const digestInput = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const contentHash = hex(await crypto.subtle.digest("SHA-256", digestInput));
  if (contentHash !== upload.contentHash)
    throw new Error("content_hash_mismatch");
  return { bytes, contentHash, height, width };
}
