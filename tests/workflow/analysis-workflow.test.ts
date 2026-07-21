import { env, exports } from "cloudflare:workers";
import { introspectWorkflow } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { RoomBootstrapSchema } from "../../src/shared/protocol";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function contentHash(base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (value) => value.charCodeAt(0));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

describe("durable handwriting analysis Workflow", () => {
  it("completes a delayed model response after the request client disconnects", async () => {
    const created = await exports.default.fetch("https://example.test/judge", {
      redirect: "manual",
    });
    const location = new URL(
      created.headers.get("location") ?? "",
      "https://example.test",
    );
    const roomId = location.pathname.split("/").at(-1);
    const teacherToken = new URLSearchParams(location.hash.slice(1)).get(
      "token",
    );
    if (roomId === undefined || teacherToken === null)
      throw new Error("Invalid judge redirect");
    const teacher = RoomBootstrapSchema.parse(
      await (
        await exports.default.fetch(
          `https://example.test/api/rooms/${roomId}/bootstrap`,
          { headers: { Authorization: `Bearer ${teacherToken}` } },
        )
      ).json(),
    );
    if (teacher.studentCapability === undefined)
      throw new Error("Missing student capability");

    await using workflow = await introspectWorkflow(env.ANALYSIS_WORKFLOW);
    const response = await exports.default.fetch(
      `https://example.test/api/rooms/${roomId}/attempts`,
      {
        body: JSON.stringify({
          authorId: "student-workflow-test",
          contentHash: await contentHash(PNG_BASE64),
          idempotencyKey: "delayed-workflow-attempt",
          mediaBase64: PNG_BASE64,
          previewAsStudent: false,
          sourceCanvasSeq: 0,
        }),
        headers: {
          Authorization: `Bearer ${teacher.studentCapability}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    expect(response.status).toBe(202);
    // Deliberately do not retain or read the response body: the request client is gone.

    const instances = await workflow.get();
    expect(instances).toHaveLength(1);
    await instances[0]!.waitForStatus("complete");

    const reloaded = RoomBootstrapSchema.parse(
      await (
        await exports.default.fetch(
          `https://example.test/api/rooms/${roomId}/bootstrap`,
          { headers: { Authorization: `Bearer ${teacher.studentCapability}` } },
        )
      ).json(),
    );
    expect(reloaded.attempts).toContainEqual(
      expect.objectContaining({ status: "complete" }),
    );
    expect(reloaded.simulationRuns).toContainEqual(
      expect.objectContaining({
        outcome: expect.objectContaining({
          resultClass: "bridge_far_too_short",
        }),
        templateId: "bridge",
      }),
    );
  });
});
