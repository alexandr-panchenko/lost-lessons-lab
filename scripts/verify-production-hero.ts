import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const productionOrigin =
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev";
const captureEvidence = process.env.CAPTURE_EVIDENCE === "true";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  reducedMotion: "reduce",
  viewport: { height: 900, width: 1280 },
});
const consoleErrors: string[] = [];
const attemptRequests: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("request", (request) => {
  if (/\/api\/rooms\/[^/]+\/attempts$/u.test(new URL(request.url()).pathname)) {
    attemptRequests.push(request.method());
  }
});

try {
  await page.goto(new URL("/judge", productionOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Prepared judge sample").waitFor();
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page
    .getByText(/shared operations saved/u)
    .waitFor({ state: "visible" });

  await page.getByRole("button", { name: "Run my solution" }).click();
  const wrongAnalysis = page.locator(".analysis-card").filter({
    hasText: "Interpretation complete",
  });
  await wrongAnalysis.waitFor({ state: "visible", timeout: 30_000 });
  await wrongAnalysis.getByText("0.34", { exact: true }).waitFor();
  await wrongAnalysis.getByText("4.08 m", { exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Bridge too short" })
    .waitFor({ timeout: 20_000 });
  await page
    .getByRole("heading", { name: "The World's Shortest Bridge" })
    .waitFor();

  const requestsBeforeReplay = attemptRequests.length;
  await page.getByRole("button", { name: "Replay" }).first().click();
  await page.getByText("Result confirmed").first().waitFor();
  if (attemptRequests.length !== requestsBeforeReplay) {
    throw new Error("Production replay made a new analysis request");
  }

  await page.getByRole("button", { name: "Apply prepared correction" }).click();
  await page
    .getByRole("button", { name: "Run my solution" })
    .waitFor({ state: "visible" });
  await page
    .getByRole("button", { name: "Run my solution" })
    .click({ timeout: 15_000 });

  const analyses = page.locator(".analysis-card").filter({
    hasText: "Interpretation complete",
  });
  await analyses.nth(1).waitFor({ state: "visible", timeout: 30_000 });
  await analyses.nth(1).getByText("0.75", { exact: true }).waitFor();
  await analyses.nth(1).getByText("9 m", { exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Safe crossing" })
    .waitFor({ timeout: 20_000 });
  await page.getByRole("heading", { name: "Fixed It" }).waitFor();

  if (captureEvidence) {
    await mkdir("docs/evidence/m5", { recursive: true });
    await page.locator(".feed").screenshot({
      path: "docs/evidence/m5/hero-wrong-to-correct.png",
    });
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Bridge too short" })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("heading", { name: "Safe crossing" }).waitFor();
  await page.getByRole("heading", { name: "Fixed It" }).waitFor();

  await page.getByRole("button", { name: "Reset current task" }).click();
  await page.locator(".simulation-card").first().waitFor({ state: "detached" });
  if (
    (await page.locator(".analysis-card").count()) !== 0 ||
    (await page.locator(".achievement-card").count()) !== 0
  ) {
    throw new Error("Production reset left attempt results in the feed");
  }
  await page.getByText(/shared operations saved/u).waitFor();

  if (attemptRequests.length !== 2) {
    throw new Error("Production hero did not make exactly two AI requests");
  }
  if (consoleErrors.length > 0) {
    throw new Error("Production hero emitted a browser console error");
  }

  console.info(
    JSON.stringify({
      aiAttempts: attemptRequests.length,
      correction: "0.75-and-9m",
      persistence: "reload-passed",
      reset: "fixture-restored",
      status: "production-hero-passed",
      wrongInputs: "0.34-and-4.08m",
    }),
  );
} finally {
  await browser.close();
}
