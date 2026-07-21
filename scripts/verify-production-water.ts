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
  if (/\/api\/rooms\/[^/]+\/attempts$/u.test(new URL(request.url()).pathname)) {
    aiRequests += 1;
  }
});

try {
  await page.goto(new URL("/water", productionOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Fill the aquarium" })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  const analysis = page.locator(".analysis-card").filter({
    hasText: "Interpretation complete",
  });
  await analysis.waitFor({ timeout: 30_000 });
  await analysis.getByText("15", { exact: true }).last().waitFor();
  await analysis.getByText("15 L", { exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Water level on target" })
    .waitFor({ timeout: 20_000 });
  await page.getByRole("heading", { name: "Perfect Pour" }).waitFor();

  await page.getByLabel("Final water volume").fill("24");
  await page.getByRole("button", { name: "Run water value" }).click();
  await page.getByRole("heading", { name: "Tank overflow" }).waitFor();
  await page.getByRole("heading", { name: "Tidal Surprise" }).waitFor();
  await page.getByText(/24 liters exceeds the 20 liter capacity/u).waitFor();

  const requestsBeforeReplay = aiRequests;
  await page.getByRole("button", { name: "Replay" }).last().click();
  if (aiRequests !== requestsBeforeReplay) {
    throw new Error("Water replay made a new AI request");
  }
  if (process.env.CAPTURE_EVIDENCE === "true") {
    await mkdir("docs/evidence/s1", { recursive: true });
    await page.locator(".feed").screenshot({
      path: "docs/evidence/s1/water-correct-and-overflow.png",
    });
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Water level on target" })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Tank overflow" }).waitFor();
  await page.getByRole("button", { name: "Reset current task" }).click();
  await page.locator(".simulation-card").first().waitFor({ state: "detached" });
  if (
    (await page.locator(".analysis-card").count()) !== 0 ||
    (await page.locator(".achievement-card").count()) !== 0
  ) {
    throw new Error("Water reset left result state behind");
  }
  await page.getByText(/shared operations saved/u).waitFor();
  if (aiRequests !== 1)
    throw new Error("Water path did not make one AI request");
  if (consoleErrors.length > 0) {
    throw new Error("Production water path emitted a console error");
  }
  console.info(
    JSON.stringify({
      aiAttempts: aiRequests,
      correctVolumeLiters: 15,
      manualOverflowLiters: 24,
      persistence: "reload-passed",
      reset: "fixture-restored",
      status: "production-water-passed",
    }),
  );
} finally {
  await browser.close();
}
