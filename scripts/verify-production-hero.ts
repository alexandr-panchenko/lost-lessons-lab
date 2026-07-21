import { chromium } from "@playwright/test";

import { RoomBootstrapSchema } from "../src/shared/protocol";

const productionOrigin =
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  reducedMotion: "reduce",
  viewport: { height: 900, width: 1280 },
});
const attemptRequests: string[] = [];
const consoleErrors: string[] = [];
const failedResponses: string[] = [];
page.on("request", (request) => {
  if (/\/api\/rooms\/[^/]+\/attempts$/u.test(new URL(request.url()).pathname))
    attemptRequests.push(request.method());
});
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const value = message.text();
  consoleErrors.push(
    /websocket/iu.test(value)
      ? "websocket"
      : /webgl|pixi|renderer/iu.test(value)
        ? "renderer"
        : /failed to load resource/iu.test(value)
          ? "resource"
          : "other",
  );
});
page.on("response", (response) => {
  if (response.status() < 400) return;
  const pathname = new URL(response.url()).pathname.replace(
    /\/api\/rooms\/[^/]+/u,
    "/api/rooms/:room",
  );
  failedResponses.push(`${response.status()}:${pathname}`);
});

try {
  await page.goto(new URL("/judge", productionOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Live room connected", { exact: true }).waitFor();
  await page
    .locator(".room-intro__role", { hasText: "Student lesson" })
    .waitFor();
  await page.locator('[data-saved-strokes="0"]').waitFor();
  await page.getByRole("button", { name: "Load sample mistake" }).click();
  await page
    .locator('[data-saved-strokes]:not([data-saved-strokes="0"])')
    .waitFor();
  await page.getByRole("button", { name: "Run my solution" }).click();

  const completedAnalyses = page.locator(".analysis-card").filter({
    hasText: "Interpretation complete",
  });
  await completedAnalyses.first().waitFor({ timeout: 75_000 });
  await completedAnalyses.first().getByText("0.34", { exact: true }).waitFor();
  await completedAnalyses
    .first()
    .getByText("4.08 m", { exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "The bridge fell short." })
    .waitFor({ timeout: 30_000 });
  const beforeSuccessText = await page.locator("main").innerText();
  if (/0[.,]75|\b9\s*(?:m|meters?)\b/iu.test(beforeSuccessText)) {
    throw new Error("The learner view disclosed the correct answer early");
  }

  await page.getByRole("button", { name: "Give me a hint" }).click();
  await page.getByText(/What is one of four equal parts/u).waitFor();
  const attemptsBeforeReplay = attemptRequests.length;
  await page.getByRole("button", { name: "Replay" }).first().click();
  await page
    .locator(".simulation-stage--bridge")
    .first()
    .waitFor({ state: "visible" });
  if (attemptRequests.length !== attemptsBeforeReplay)
    throw new Error("Replay launched another GPT request");
  await page
    .locator(".simulation-card")
    .first()
    .getByRole("button", { name: "Skip to result" })
    .click();

  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: "Load correct sample" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await completedAnalyses.nth(1).waitFor({ timeout: 75_000 });
  await completedAnalyses.nth(1).getByText("0.75", { exact: true }).waitFor();
  await completedAnalyses.nth(1).getByText("9 m", { exact: true }).waitFor();
  await page
    .locator(".simulation-card")
    .nth(1)
    .getByRole("button", { name: "Skip to result" })
    .click({ timeout: 30_000 });
  await page
    .getByText(/Each quarter is 3 meters\. Three quarters is 9 meters/u)
    .waitFor();
  await page.getByRole("heading", { name: "Fixed It" }).waitFor();

  const attemptsBeforeCorrectReplay = attemptRequests.length;
  await page
    .locator(".simulation-card")
    .nth(1)
    .getByRole("button", { name: "Replay" })
    .click();
  if (attemptRequests.length !== attemptsBeforeCorrectReplay)
    throw new Error("Correct Replay launched another GPT request");

  await page.reload({ waitUntil: "domcontentloaded" });
  await completedAnalyses.nth(1).waitFor({ timeout: 20_000 });
  await page
    .getByRole("img", {
      name: "Student handwriting submitted for this attempt",
    })
    .nth(1)
    .waitFor({ timeout: 20_000 });
  const roomUrl = new URL(page.url());
  const roomId = roomUrl.pathname.split("/").at(-1);
  const studentToken = new URLSearchParams(roomUrl.hash.slice(1)).get("token");
  if (roomId === undefined || studentToken === null)
    throw new Error("Production hero lost its room capability");
  const persisted = RoomBootstrapSchema.parse(
    await (
      await fetch(new URL(`/api/rooms/${roomId}/bootstrap`, productionOrigin), {
        headers: { Authorization: `Bearer ${studentToken}` },
      })
    ).json(),
  );
  const modelIds = persisted.analyses
    .filter((analysis) => analysis.result !== null)
    .map((analysis) => analysis.modelId);
  if (
    modelIds.length !== 2 ||
    modelIds.some((modelId) => !/^gpt-5\.6(?:-sol)?$/u.test(modelId ?? ""))
  ) {
    throw new Error(`Expected two GPT-5.6 analyses, saw ${modelIds.join(",")}`);
  }
  await page.getByRole("button", { name: "Teacher setup" }).click();
  await page
    .locator(".room-intro__role", { hasText: "Teacher setup" })
    .waitFor();
  await page.waitForFunction(() => {
    const images = [
      ...document.querySelectorAll<HTMLImageElement>(".attempt-media img"),
    ];
    return (
      images.length === 2 &&
      images.every((image) => image.complete && image.naturalWidth > 0)
    );
  });
  await page.getByRole("button", { name: "Reset current task" }).click();
  await page.locator(".analysis-card").first().waitFor({ state: "detached" });
  await page.locator('[data-saved-strokes="0"]').waitFor();

  if (attemptRequests.length !== 2)
    throw new Error(`Expected two GPT attempts, saw ${attemptRequests.length}`);
  if (consoleErrors.length > 0)
    throw new Error(
      `Production hero emitted browser console errors: ${consoleErrors.join(",")}; responses: ${failedResponses.join(",")}`,
    );
  console.info(
    JSON.stringify({
      aiAttempts: 2,
      directStudentEntry: true,
      modelIds,
      persistence: "reload-passed",
      replay: "no-new-gpt-request",
      reset: "empty-canvas-restored",
      status: "production-final-bridge-hero-passed",
    }),
  );
} finally {
  await browser.close();
}
