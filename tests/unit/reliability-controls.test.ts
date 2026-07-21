import { describe, expect, it, vi } from "vitest";

import { chooseRenderQuality } from "../../src/simulations/core/render-quality";
import { persistAnalysisMedia } from "../../src/worker/media/attempt-media";
import {
  logAnalysisMetadata,
  safeErrorClass,
} from "../../src/worker/security/logging";

describe("reliability and privacy controls", () => {
  it("reduces rendering cost without changing simulation inputs", () => {
    expect(
      chooseRenderQuality({
        devicePixelRatio: 3,
        hardwareConcurrency: 2,
        reducedMotion: false,
      }),
    ).toEqual({ antialias: false, lowDetail: true, resolution: 1 });
    expect(
      chooseRenderQuality({
        devicePixelRatio: 3,
        hardwareConcurrency: 8,
        reducedMotion: false,
      }),
    ).toEqual({ antialias: true, lowDetail: false, resolution: 2 });
  });

  it("keeps only an error class and metadata in analysis logs", () => {
    expect(safeErrorClass("TypeError:token=private-value")).toBe("TypeError");
    expect(safeErrorClass("raw learner transcription")).toBeUndefined();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logAnalysisMetadata({
      attemptId: "attempt_safe_metadata",
      category: "upstream",
      errorClass: "TypeError",
      event: "analysis.failed",
      latencyMs: 12,
      roomHash: "a".repeat(24),
      usedRepair: false,
    });
    const payload = String(info.mock.calls[0]?.[0]);
    expect(payload).toContain('"errorClass":"TypeError"');
    expect(payload).not.toContain("private-value");
    expect(payload).not.toContain("transcription");
    logAnalysisMetadata({
      attemptId: "attempt_safe_metadata",
      errorClass: "TypeError:private-value",
      event: "analysis.failed",
      latencyMs: 12,
      roomHash: "a".repeat(24),
      usedRepair: false,
    } as never);
    const rejectedPayload = String(info.mock.calls[1]?.[0]);
    expect(rejectedPayload).toContain("analysis.log_rejected");
    expect(rejectedPayload).not.toContain("private-value");
    info.mockRestore();
  });

  it("fails the attempt and releases the lock if media persistence breaks", async () => {
    const put = vi.fn().mockRejectedValue(new Error("R2 unavailable"));
    const remove = vi.fn().mockResolvedValue(undefined);
    const fail = vi.fn().mockRejectedValue(new Error("DO unavailable"));
    const release = vi.fn().mockResolvedValue(true);
    const attach = vi.fn();
    await expect(
      persistAnalysisMedia({
        attemptId: "attempt_media_failure",
        bucket: { delete: remove, put } as unknown as R2Bucket,
        bytes: new Uint8Array([1, 2, 3]),
        media: {
          byteSize: 3,
          contentHash: "a".repeat(64),
          contentType: "image/png",
          height: 1,
          id: "media_failure_test",
          width: 1,
        },
        r2Key: `rooms/rm_${"a".repeat(20)}/attempts/attempt_media_failure/${"a".repeat(64)}.png`,
        room: {
          attachAiAttemptMedia: attach,
          failAiAttempt: fail,
          releaseAttemptProcessingLock: release,
        },
        roomId: `rm_${"a".repeat(20)}`,
      }),
    ).rejects.toThrow("media_storage");
    expect(put).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(attach).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({ category: "media_storage" }),
    );
    expect(release).toHaveBeenCalledWith("attempt_media_failure");
  });
});
