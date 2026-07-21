import type { AiAttempt, AttemptMedia } from "../../shared/analysis-types";

type AttemptMediaRoom = {
  attachAiAttemptMedia(input: {
    attemptId: string;
    media: AttemptMedia;
    r2Key: string;
  }): Promise<AiAttempt>;
  failAiAttempt(input: {
    attemptId: string;
    category: "media_storage";
    latencyMs: number;
    usedRepair: boolean;
  }): Promise<unknown>;
  releaseAttemptProcessingLock(attemptId: string): Promise<boolean>;
};

export async function persistAnalysisMedia(input: {
  attemptId: string;
  bucket: R2Bucket;
  bytes: Uint8Array;
  media: AttemptMedia;
  r2Key: string;
  room: AttemptMediaRoom;
  roomId: string;
}): Promise<AiAttempt> {
  try {
    await input.bucket.put(input.r2Key, input.bytes, {
      customMetadata: {
        attemptId: input.attemptId,
        roomId: input.roomId,
        visibility: "all",
      },
      httpMetadata: { contentType: "image/png" },
    });
    return await input.room.attachAiAttemptMedia({
      attemptId: input.attemptId,
      media: input.media,
      r2Key: input.r2Key,
    });
  } catch {
    await input.bucket.delete(input.r2Key).catch(() => undefined);
    try {
      await input.room.failAiAttempt({
        attemptId: input.attemptId,
        category: "media_storage",
        latencyMs: 0,
        usedRepair: false,
      });
    } catch {
      await input.room.releaseAttemptProcessingLock(input.attemptId);
    }
    throw new Error("media_storage");
  }
}
