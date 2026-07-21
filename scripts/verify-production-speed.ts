import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const productionOrigin =
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  reducedMotion: "reduce",
  viewport: { height: 900, width: 1280 },
});
const consoleErrors: string[] = [];
let aiRequests = 0;
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("request", (request) => {
  if (/\/api\/rooms\/[^/]+\/attempts$/u.test(new URL(request.url()).pathname))
    aiRequests += 1;
});

try {
  await page.goto(new URL("/speed", productionOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Guide the lab shuttle" })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  const analysis = page
    .locator(".analysis-card")
    .filter({ hasText: "Interpretation complete" });
  await analysis.waitFor({ timeout: 30_000 });
  await analysis.getByText(/Read by gpt-5\.6-sol/u).waitFor();
  const extractedText = (
    await analysis.getByLabel("Extracted simulation values").innerText()
  ).replaceAll(/\s+/gu, " ");
  if (!/Speed 8 m\/s Time 3 s Travel distance 24 m/u.test(extractedText)) {
    throw new Error(`Unexpected extracted speed values: ${extractedText}`);
  }
  await page
    .getByRole("heading", { name: "Shuttle arrived on target" })
    .waitFor({ timeout: 20_000 });
  await page.getByRole("heading", { name: "Perfect Arrival" }).waitFor();

  await page.getByLabel("Final travel distance").fill("36");
  await page.getByRole("button", { name: "Run shuttle value" }).click();
  await page.getByRole("heading", { name: "Soft bumper boop" }).waitFor();
  await page
    .getByRole("heading", { exact: true, name: "Bumper Boop" })
    .waitFor();
  const requestsBeforeReplay = aiRequests;
  await page.getByRole("button", { name: "Replay" }).last().click();
  if (aiRequests !== requestsBeforeReplay)
    throw new Error("Speed replay made a new AI request");
  if (process.env.CAPTURE_EVIDENCE === "true") {
    await mkdir("docs/evidence/s2", { recursive: true });
    await page
      .locator(".feed")
      .screenshot({ path: "docs/evidence/s2/speed-correct-and-collision.png" });
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Shuttle arrived on target" })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Soft bumper boop" }).waitFor();
  await page.getByRole("button", { name: "Reset current task" }).click();
  await page.locator(".simulation-card").first().waitFor({ state: "detached" });
  if (
    (await page.locator(".analysis-card").count()) !== 0 ||
    (await page.locator(".achievement-card").count()) !== 0
  ) {
    throw new Error("Speed reset left result state behind");
  }
  if (aiRequests !== 1)
    throw new Error("Speed path did not make one AI request");
  if (consoleErrors.length > 0)
    throw new Error("Production speed path emitted a console error");
  console.info(
    JSON.stringify({
      aiAttempts: aiRequests,
      correctDistanceMeters: 24,
      manualCollisionMeters: 36,
      persistence: "reload-passed",
      reset: "fixture-restored",
      status: "production-speed-passed",
    }),
  );
} finally {
  await browser.close();
}
