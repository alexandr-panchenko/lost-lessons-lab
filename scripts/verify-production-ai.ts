import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

import { RoomBootstrapSchema } from "../src/shared/protocol";

const productionUrl = new URL(
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev",
);
const image = await readFile("tests/fixtures/handwriting/bridge-wrong.png");
const contentHash = createHash("sha256").update(image).digest("hex");

const created = await fetch(new URL("/judge", productionUrl), {
  redirect: "manual",
});
if (created.status !== 302)
  throw new Error("Production /judge did not redirect");
const roomUrl = new URL(created.headers.get("location") ?? "", productionUrl);
const roomId = roomUrl.pathname.split("/").at(-1);
const teacherToken = new URLSearchParams(roomUrl.hash.slice(1)).get("token");
if (roomId === undefined || teacherToken === null)
  throw new Error("Production room redirect was invalid");

async function bootstrap(token: string) {
  const response = await fetch(
    new URL(`/api/rooms/${roomId}/bootstrap`, productionUrl),
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("Production bootstrap failed");
  return RoomBootstrapSchema.parse(await response.json());
}

const teacher = await bootstrap(teacherToken);
if (teacher.studentCapability === undefined)
  throw new Error("Production teacher bootstrap omitted learner capability");
const studentToken = teacher.studentCapability;
const accepted = await fetch(
  new URL(`/api/rooms/${roomId}/attempts`, productionUrl),
  {
    body: JSON.stringify({
      authorId: "production-ai-smoke",
      contentHash,
      idempotencyKey: crypto.randomUUID(),
      mediaBase64: image.toString("base64"),
      previewAsStudent: false,
      sourceCanvasSeq: 0,
    }),
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  },
);
if (accepted.status !== 202)
  throw new Error(`Production analysis was not accepted (${accepted.status})`);
const acceptedBody = (await accepted.json()) as { attempt?: { id?: string } };
const attemptId = acceptedBody.attempt?.id;
if (attemptId === undefined) throw new Error("Accepted attempt omitted its ID");

let finalRoom = teacher;
for (let poll = 0; poll < 35; poll += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  finalRoom = await bootstrap(studentToken);
  const attempt = finalRoom.attempts.find((item) => item.id === attemptId);
  if (
    attempt !== undefined &&
    "mode" in attempt &&
    (attempt.status === "complete" || attempt.status === "failed")
  ) {
    break;
  }
}

const attempt = finalRoom.attempts.find((item) => item.id === attemptId);
const analysis = finalRoom.analyses.find(
  (item) => item.attemptId === attemptId,
);
const run = finalRoom.simulationRuns.find(
  (item) => item.attemptId === attemptId,
);
if (
  attempt === undefined ||
  !("mode" in attempt) ||
  attempt.status !== "complete" ||
  attempt.media === null ||
  analysis?.result === null ||
  analysis?.result === undefined ||
  run === undefined
) {
  throw new Error(
    `Production analysis did not complete safely (${analysis?.failureCategory ?? "missing"}); inspect metadata-only Worker logs`,
  );
}
if (
  analysis.result.scenarioInputs.fractionAsDecimal !== 0.34 ||
  analysis.result.scenarioInputs.deployedLengthMeters !== 4.08 ||
  run.outcome.resultClass !== "bridge_far_too_short"
) {
  throw new Error("Production analysis extracted unexpected bridge inputs");
}

const mediaUrl = new URL(
  `/api/rooms/${roomId}/media/${encodeURIComponent(attempt.media.id)}`,
  productionUrl,
);
const unauthorizedMedia = await fetch(mediaUrl);
if (unauthorizedMedia.status !== 401)
  throw new Error(
    "Private production media was accessible without a capability",
  );
const authorizedMedia = await fetch(mediaUrl, {
  headers: { Authorization: `Bearer ${studentToken}` },
});
if (
  !authorizedMedia.ok ||
  authorizedMedia.headers.get("content-type") !== "image/png"
) {
  throw new Error("Authorized production media could not be loaded");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
await page.goto(roomUrl.toString(), { waitUntil: "domcontentloaded" });
const analysisCard = page.locator(".analysis-card").filter({
  hasText: "Interpretation complete",
});
await analysisCard.waitFor({ state: "visible", timeout: 15_000 });
await analysisCard.getByText("4.08 m", { exact: true }).waitFor();
await analysisCard
  .getByRole("img", { name: "Student handwriting submitted for this attempt" })
  .waitFor();
if (process.env.CAPTURE_EVIDENCE === "true") {
  await mkdir("docs/evidence/m4", { recursive: true });
  await analysisCard.screenshot({
    path: "docs/evidence/m4/analysis-wrong.png",
  });
}
await browser.close();
if (consoleErrors.length > 0)
  throw new Error("Production browser emitted a console error");

console.info(
  JSON.stringify({
    analysisLatencyMs: analysis.latencyMs,
    extractedInputs: analysis.result.scenarioInputs,
    mediaAuthorization: "unauthorized-denied-and-authorized-loaded",
    modelId: analysis.modelId,
    outcome: run.outcome.resultClass,
    responseIdSuffix: analysis.responseId?.slice(-8),
    status: "production-ai-smoke-passed",
    usedRepair: analysis.usedRepair,
  }),
);
