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
});
