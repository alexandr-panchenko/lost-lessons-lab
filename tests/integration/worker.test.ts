import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Cloudflare Worker shell", () => {
  it("serves a no-store health response", async () => {
    const response = await exports.default.fetch(
      "https://example.test/api/health",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      service: "lost-lessons-lab",
      status: "ok",
    });
  });

  it("instantiates the SQLite-backed room class", async () => {
    const room = env.ROOMS.getByName("m1-test-room");

    await expect(room.ping()).resolves.toBe("room-runtime-ready");
  });

  it("holds exactly one attempt-processing lock and releases by owner", async () => {
    const room = env.ROOMS.getByName("m3-attempt-lock-room");

    await expect(
      room.acquireAttemptProcessingLock("attempt-lock-owner-one"),
    ).resolves.toBe(true);
    await expect(
      room.acquireAttemptProcessingLock("attempt-lock-owner-two"),
    ).resolves.toBe(false);
    await expect(
      room.releaseAttemptProcessingLock("attempt-lock-owner-two"),
    ).resolves.toBe(false);
    await expect(
      room.releaseAttemptProcessingLock("attempt-lock-owner-one"),
    ).resolves.toBe(true);
    await expect(
      room.acquireAttemptProcessingLock("attempt-lock-owner-two"),
    ).resolves.toBe(true);
  });
});
