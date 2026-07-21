import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, type Browser } from "@playwright/test";

const origin = new URL(
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev",
);
const outputDirectory = "docs/evidence/final-bridge-rc";
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function recordManualRun(
  browserInstance: Browser,
  variant: "correct" | "wrong",
): Promise<{ averageFps: number; p95FrameMs: number }> {
  const videoDirectory = await mkdtemp(
    join(tmpdir(), `lost-lessons-${variant}-video-`),
  );
  const context = await browserInstance.newContext({
    recordVideo: { dir: videoDirectory, size: { height: 1000, width: 1440 } },
    reducedMotion: "no-preference",
    viewport: { height: 1000, width: 1440 },
  });
  const page = await context.newPage();
  await page.route("**/api/rooms/*/attempts", (route) =>
    route.fulfill({
      body: JSON.stringify({ error: "ai_disabled", fallback: "manual" }),
      contentType: "application/json",
      status: 503,
    }),
  );
  await page.goto(new URL("/judge", origin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Live room connected", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Load sample mistake" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await page
    .getByLabel("Bridge length")
    .fill(variant === "wrong" ? "4.08" : "9");
  await page
    .getByLabel("Fraction as a decimal (optional)")
    .fill(variant === "wrong" ? "0.34" : "0.75");
  await page.getByRole("button", { name: "Test this bridge" }).click();
  const stage = page.locator(".simulation-stage--bridge").first();
  await stage.waitFor();
  await stage.scrollIntoViewIfNeeded();

  const performanceResult = await page.evaluate(async () => {
    const deltas: number[] = [];
    const startedAt = performance.now();
    let prior = startedAt;
    await new Promise<void>((resolve) => {
      const frame = (time: number) => {
        deltas.push(time - prior);
        prior = time;
        if (time - startedAt >= 2_500) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const sorted = [...deltas].sort((a, b) => a - b);
    const elapsed = deltas.reduce((total, delta) => total + delta, 0);
    return {
      averageFps: (deltas.length / elapsed) * 1000,
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    };
  });

  if (variant === "wrong") {
    await page.locator('[data-simulation-phase="collision"]').waitFor({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Pause" }).click();
    await stage.screenshot({
      path: `${outputDirectory}/wrong-climax.png`,
    });
    await page.getByRole("button", { name: "Resume" }).click();
  }
  await page.getByText("Result ready").waitFor({ timeout: 30_000 });
  if (variant === "correct") {
    await stage.screenshot({
      path: `${outputDirectory}/correct-climax.png`,
    });
  }
  await page.waitForTimeout(2_000);
  const video = page.video();
  if (video === null) throw new Error(`Missing ${variant} run video`);
  await context.close();
  await video.saveAs(`${outputDirectory}/${variant}-complete-run.webm`);
  return performanceResult;
}

async function captureRealHero(browserInstance: Browser): Promise<void> {
  const videoDirectory = await mkdtemp(
    join(tmpdir(), "lost-lessons-hero-video-"),
  );
  const context = await browserInstance.newContext({
    recordVideo: { dir: videoDirectory, size: { height: 1000, width: 1440 } },
    reducedMotion: "no-preference",
    viewport: { height: 1000, width: 1440 },
  });
  const page = await context.newPage();
  await page.goto(new URL("/judge", origin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Live room connected", { exact: true }).waitFor();
  await page.screenshot({
    path: `${outputDirectory}/initial-lesson.png`,
  });
  await page.getByRole("button", { name: "Load sample mistake" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  const completed = page.locator(".analysis-card").filter({
    hasText: "Interpretation complete",
  });
  await completed.first().waitFor({ timeout: 75_000 });
  await completed.first().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${outputDirectory}/recognized-wrong-work.png`,
  });
  await page
    .getByRole("heading", { name: "The bridge fell short." })
    .waitFor({ timeout: 35_000 });
  await page.getByRole("button", { name: "Try again" }).click();
  await page.screenshot({ path: `${outputDirectory}/retry-ui.png` });
  await page.getByRole("button", { name: "Load correct sample" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await completed.nth(1).waitFor({ timeout: 75_000 });
  await page
    .locator(".simulation-card")
    .nth(1)
    .getByText("Result ready")
    .waitFor({ timeout: 35_000 });
  await page.waitForTimeout(2_000);
  const video = page.video();
  if (video === null) throw new Error("Missing hero-flow video");
  await context.close();
  await video.saveAs(`${outputDirectory}/hero-flow-through-success.webm`);
}

try {
  const wrongPerformance = await recordManualRun(browser, "wrong");
  const correctPerformance = await recordManualRun(browser, "correct");
  await captureRealHero(browser);
  console.info(
    JSON.stringify({
      correctPerformance: {
        averageFps: Number(correctPerformance.averageFps.toFixed(1)),
        p95FrameMs: Number(correctPerformance.p95FrameMs.toFixed(1)),
      },
      outputDirectory,
      status: "final-bridge-release-candidate-captured",
      wrongPerformance: {
        averageFps: Number(wrongPerformance.averageFps.toFixed(1)),
        p95FrameMs: Number(wrongPerformance.p95FrameMs.toFixed(1)),
      },
    }),
  );
} finally {
  await browser.close();
}
