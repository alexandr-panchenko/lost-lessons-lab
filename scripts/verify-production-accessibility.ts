import { mkdir } from "node:fs/promises";

import { chromium, type Page } from "@playwright/test";

const productionOrigin =
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev";
const captureEvidence = process.env.CAPTURE_EVIDENCE === "true";
const browser = await chromium.launch({ headless: true });
const consoleErrors: string[] = [];

async function openStudentPreview(page: Page): Promise<void> {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push("console_error");
  });
  await page.goto(new URL("/judge", productionOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Fractions and the bridge" })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page.getByText("Student view", { exact: true }).waitFor();
  await page.getByText("Live room connected", { exact: true }).waitFor({
    timeout: 15_000,
  });
}

try {
  if (captureEvidence) await mkdir("docs/evidence/m7", { recursive: true });
  for (const viewport of [
    { height: 900, label: "desktop", width: 1280 },
    { height: 1024, label: "tablet", width: 768 },
    { height: 844, label: "phone", width: 390 },
  ] as const) {
    const page = await browser.newPage({ viewport });
    await openStudentPreview(page);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (dimensions.scrollWidth > dimensions.clientWidth)
      throw new Error(`${viewport.label} viewport has horizontal overflow`);
    if (captureEvidence) {
      await page.screenshot({
        path: `docs/evidence/m7/${viewport.label}-first-screen.png`,
      });
    }
    await page.close();
  }

  const keyboardPage = await browser.newPage({
    reducedMotion: "reduce",
    viewport: { height: 900, width: 1280 },
  });
  keyboardPage.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push("console_error");
  });
  await keyboardPage.goto(new URL("/judge", productionOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await keyboardPage
    .getByRole("heading", { name: "Fractions and the bridge" })
    .waitFor({ timeout: 15_000 });
  await keyboardPage.keyboard.press("Tab");
  const skipLink = keyboardPage.getByRole("link", {
    name: "Skip to the learning feed",
  });
  await skipLink.waitFor();
  if (
    !(await skipLink.evaluate((element) => element === document.activeElement))
  )
    throw new Error("Skip link was not first in keyboard focus order");
  await keyboardPage.evaluate(() => {
    Reflect.set(window, "__LOST_LESSONS_HASH_BEFORE_SKIP__", location.hash);
  });
  await keyboardPage.keyboard.press("Enter");
  const preservedCapability = await keyboardPage.evaluate(
    () =>
      location.hash ===
      Reflect.get(window, "__LOST_LESSONS_HASH_BEFORE_SKIP__"),
  );
  if (!preservedCapability)
    throw new Error("Keyboard skip changed the room capability fragment");
  await keyboardPage
    .getByRole("button", { name: "Preview as student" })
    .click();
  await keyboardPage.getByText("Student view", { exact: true }).waitFor();
  await keyboardPage.getByRole("button", { name: "Run manual value" }).click();
  await keyboardPage.getByText("Result confirmed").waitFor({
    timeout: 15_000,
  });
  await keyboardPage.getByText(/4\.08 meter bridge ends before/u).waitFor();
  if (captureEvidence) {
    await keyboardPage.locator(".simulation-card").screenshot({
      path: "docs/evidence/m7/reduced-motion-transcript.png",
    });
  }
  await keyboardPage.close();

  if (consoleErrors.length > 0)
    throw new Error(
      "Production accessibility verification saw a console error",
    );
  console.info(
    JSON.stringify({
      capabilityFragment: "preserved",
      keyboardSkip: "passed",
      reducedMotionTranscript: "passed",
      status: "production-accessibility-passed",
      viewports: ["desktop", "tablet", "phone"],
    }),
  );
} finally {
  await browser.close();
}
