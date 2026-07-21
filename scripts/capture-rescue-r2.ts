import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const reviewOrigin = new URL(
  process.env.R2_REVIEW_URL ??
    process.env.PRODUCTION_URL ??
    "https://lost-lessons-lab.sanocks.workers.dev",
);
const outputDirectory = "docs/evidence/r2-1";
await mkdir(outputDirectory, { recursive: true });
const videoDirectory = await mkdtemp(join(tmpdir(), "lost-lessons-r2-video-"));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: {
    dir: videoDirectory,
    size: { height: 1000, width: 1440 },
  },
  reducedMotion: "no-preference",
  viewport: { height: 1000, width: 1440 },
});
const page = await context.newPage();
const consoleErrors: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push("browser-console-error");
});

async function positionStage(): Promise<void> {
  await page.locator(".simulation-stage--bridge").evaluate((element) => {
    const headerHeight =
      document.querySelector(".room-header")?.getBoundingClientRect().height ??
      80;
    const top =
      element.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
    window.scrollTo({ behavior: "instant", top });
  });
  await page.waitForTimeout(100);
}

async function clickPlaybackControl(name: "Pause" | "Resume"): Promise<void> {
  await page.getByRole("button", { name }).evaluate((element) => {
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error("Playback control is not a button");
    }
    element.click();
  });
}

async function pauseWhenStageMatches(
  attribute: "data-simulation-events" | "data-simulation-phase",
  value: string,
): Promise<void> {
  await page.locator(".simulation-stage--bridge").evaluate(
    (element, target) =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (
            (element.getAttribute(target.attribute) ?? "").includes(
              target.value,
            )
          ) {
            const pause = Array.from(document.querySelectorAll("button")).find(
              (button) => button.textContent?.trim() === "Pause",
            );
            if (!(pause instanceof HTMLButtonElement)) {
              throw new Error("Pause control is unavailable during capture");
            }
            pause.click();
            resolve();
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      }),
    { attribute, value },
  );
  await page.getByRole("button", { name: "Resume" }).waitFor();
}

try {
  await page.goto(new URL("/judge", reviewOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: "Try the lesson as a student" })
    .click();
  await page.getByText("Live room connected", { exact: true }).waitFor();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByLabel("Fraction as a decimal (optional)").fill("0.34");
  await page.getByRole("button", { name: "Test this bridge" }).click();

  const stage = page.locator(".simulation-stage--bridge");
  await stage.waitFor();
  await page
    .locator('[data-simulation-phase="driving"]')
    .waitFor({ timeout: 12_000 });
  await clickPlaybackControl("Pause");
  await page.getByRole("button", { name: "Resume" }).waitFor();
  await positionStage();
  await stage.screenshot({
    path: `${outputDirectory}/wrong-bridge-before-failure.png`,
  });
  await clickPlaybackControl("Resume");

  await pauseWhenStageMatches("data-simulation-events", "peeling");
  await positionStage();
  await stage.screenshot({
    path: `${outputDirectory}/wrong-bridge-failure.png`,
  });
  await clickPlaybackControl("Resume");

  await pauseWhenStageMatches("data-simulation-phase", "splash");
  await positionStage();
  await stage.screenshot({
    path: `${outputDirectory}/wrong-bridge-water-impact.png`,
  });
  await clickPlaybackControl("Resume");
  await page.getByText("Result ready").waitFor({ timeout: 25_000 });
  await page.waitForTimeout(900);
  if (consoleErrors.length > 0) {
    throw new Error("R2 evidence capture emitted a browser console error");
  }
  const video = page.video();
  if (video === null) throw new Error("Playwright did not create an R2 video");
  await context.close();
  await video.saveAs(`${outputDirectory}/wrong-bridge-complete-run.webm`);
  console.info(
    JSON.stringify({
      screenshots: [
        `${outputDirectory}/wrong-bridge-before-failure.png`,
        `${outputDirectory}/wrong-bridge-failure.png`,
        `${outputDirectory}/wrong-bridge-water-impact.png`,
      ],
      status: "rescue-r2-evidence-captured",
      video: `${outputDirectory}/wrong-bridge-complete-run.webm`,
    }),
  );
} finally {
  await context.close().catch(() => undefined);
  await browser.close();
}
