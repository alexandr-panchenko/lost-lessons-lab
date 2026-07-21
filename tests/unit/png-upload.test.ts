import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { validatePngUpload } from "../../src/worker/media/png";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function upload(mediaBase64 = PNG_BASE64) {
  const bytes = Buffer.from(mediaBase64, "base64");
  return {
    authorId: "student-author",
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    idempotencyKey: "idempotency-test",
    mediaBase64,
    previewAsStudent: false,
    sourceCanvasSeq: 0,
  };
}

describe("private PNG upload validation", () => {
  it("validates complete PNG structure, dimensions, size, and digest", async () => {
    await expect(
      validatePngUpload(upload(), { maxBytes: 1024, maxEdge: 10 }),
    ).resolves.toMatchObject({ height: 1, width: 1 });
  });

  it("rejects forged headers, oversized dimensions, and hash mismatches", async () => {
    const truncated = Buffer.from(PNG_BASE64, "base64").subarray(0, 33);
    await expect(
      validatePngUpload(
        {
          ...upload(truncated.toString("base64")),
          contentHash: createHash("sha256").update(truncated).digest("hex"),
        },
        { maxBytes: 1024, maxEdge: 10 },
      ),
    ).rejects.toThrow("invalid_png");
    await expect(
      validatePngUpload(upload(), { maxBytes: 1024, maxEdge: 0 }),
    ).rejects.toThrow("invalid_png_dimensions");
    await expect(
      validatePngUpload(
        { ...upload(), contentHash: "0".repeat(64) },
        { maxBytes: 1024, maxEdge: 10 },
      ),
    ).rejects.toThrow("content_hash_mismatch");
  });
});
