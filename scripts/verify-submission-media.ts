import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { z } from "zod";

const videoPath = "artifacts/submission/lost-lessons-lab-demo.mp4";
const captionsPath = "artifacts/submission/lost-lessons-lab-demo.en.srt";
const thumbnailPath = "docs/evidence/m9/submission-thumbnail.png";
const narrationPath = "docs/evidence/m9/video-narration.txt";

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=codec_name,codec_type,width,height",
    "-of",
    "json",
    videoPath,
  ],
  { encoding: "utf8" },
);
if (probe.status !== 0) {
  throw new Error("ffprobe could not inspect the submission video");
}

const ProbeSchema = z.object({
  format: z.object({
    duration: z.coerce.number().positive(),
    size: z.coerce.number().positive(),
  }),
  streams: z.array(
    z.object({
      codec_name: z.string(),
      codec_type: z.enum(["audio", "subtitle", "video"]),
      height: z.number().int().positive().optional(),
      width: z.number().int().positive().optional(),
    }),
  ),
});
const media = ProbeSchema.parse(JSON.parse(probe.stdout));
if (media.format.duration >= 180) {
  throw new Error("Submission video is not shorter than three minutes");
}
if (media.format.duration < 30) {
  throw new Error("Submission video is unexpectedly short");
}

const videoStream = media.streams.find(
  (stream) => stream.codec_type === "video",
);
const audioStream = media.streams.find(
  (stream) => stream.codec_type === "audio",
);
const subtitleStream = media.streams.find(
  (stream) => stream.codec_type === "subtitle",
);
if (
  videoStream?.codec_name !== "h264" ||
  videoStream.width !== 1280 ||
  videoStream.height !== 720
) {
  throw new Error("Submission video is not 1280x720 H.264");
}
if (audioStream?.codec_name !== "aac") {
  throw new Error("Submission video has no AAC narration stream");
}
if (subtitleStream?.codec_name !== "mov_text") {
  throw new Error("Submission video has no embedded caption stream");
}

const [video, captions, thumbnail, narration] = await Promise.all([
  readFile(videoPath),
  readFile(captionsPath, "utf8"),
  readFile(thumbnailPath),
  readFile(narrationPath, "utf8"),
]);
if (
  thumbnail.length < 24 ||
  thumbnail.toString("ascii", 1, 4) !== "PNG" ||
  thumbnail.readUInt32BE(16) !== 1536 ||
  thumbnail.readUInt32BE(20) !== 1024
) {
  throw new Error("Submission thumbnail is not the expected 1536x1024 PNG");
}

const forbiddenPatterns = [
  /#token=/iu,
  /OPENAI_API_KEY/u,
  /ROOM_TOKEN_PEPPER/u,
  /sk-[A-Za-z0-9_-]{20,}/u,
  /rm_[A-Za-z0-9_-]{20,}/u,
];
const searchableMedia = video.toString("latin1");
for (const pattern of forbiddenPatterns) {
  if (
    pattern.test(searchableMedia) ||
    pattern.test(captions) ||
    pattern.test(narration)
  ) {
    throw new Error(
      "Submission media contains private or server-only material",
    );
  }
}

const captionBlocks = captions.trim().split(/\n\n+/u);
if (captionBlocks.length !== 7 || !captions.includes("00:01:41,500")) {
  throw new Error("Submission caption sidecar is incomplete");
}
for (const requiredPhrase of [
  "GPT-5.6",
  "deterministic TypeScript validators",
  "Codex built and verified",
  "The learner's math is the controller",
]) {
  if (!narration.includes(requiredPhrase)) {
    throw new Error(`Narration omitted required evidence: ${requiredPhrase}`);
  }
}

console.info(
  JSON.stringify({
    captions: "embedded-and-sidecar",
    durationSeconds: Number(media.format.duration.toFixed(2)),
    narration: "english",
    privacyScan: "passed",
    sha256: createHash("sha256").update(video).digest("hex"),
    sizeBytes: media.format.size,
    status: "submission-media-verified",
    thumbnail: "1536x1024-png",
    video: "1280x720-h264-aac",
  }),
);
