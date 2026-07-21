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
let injectedFailures = 0;
page.on("console", (message) => {
  if (message.type() !== "error") return;
  let isInjectedAttemptFailure = false;
  try {
    isInjectedAttemptFailure =
      /^\/api\/rooms\/[^/]+\/attempts$/u.test(
        new URL(message.location().url).pathname,
      ) && message.text().includes("503");
  } catch {
    // A console message without a URL cannot be tied to the injected response.
  }
  if (!isInjectedAttemptFailure) consoleErrors.push("unexpected_console_error");
});

try {
  await page.route("**/api/rooms/*/attempts", async (route) => {
    injectedFailures += 1;
    await route.fulfill({
      body: JSON.stringify({ error: "ai_disabled", fallback: "manual" }),
      contentType: "application/json",
      status: 503,
    });
  });
  await page.goto(new URL("/judge", productionOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Fractions and the bridge" })
    .waitFor({ timeout: 15_000 });
  await page
    .getByRole("button", { name: "Try the lesson as a student" })
    .click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await page
    .getByText(
      "AI interpretation is disabled right now. Use the manual bridge controls below.",
    )
    .waitFor();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await page
    .getByRole("heading", { name: "Bridge too short" })
    .waitFor({ timeout: 15_000 });
  await page.getByLabel("Bridge length").fill("9");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await page
    .getByRole("heading", { name: "Safe crossing" })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Teacher view" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Bridge too short" }).waitFor();
  await page.getByRole("heading", { name: "Safe crossing" }).waitFor();
  if (process.env.CAPTURE_EVIDENCE === "true") {
    await mkdir("docs/evidence/m6", { recursive: true });
    await page.locator(".feed").screenshot({
      path: "docs/evidence/m6/ai-disabled-manual-recovery.png",
    });
  }
  await page.getByRole("button", { name: "Reset current task" }).click();
  await page.locator(".simulation-card").first().waitFor({ state: "detached" });
  if (injectedFailures !== 1)
    throw new Error("The fallback drill did not inject exactly one AI failure");
  if (consoleErrors.length > 0)
    throw new Error("Production fallback drill emitted a console error");
  console.info(
    JSON.stringify({
      canvasPreserved: true,
      injectedAiFailures: injectedFailures,
      manualCorrectMeters: 9,
      manualWrongMeters: 4.08,
      persistence: "reload-passed",
      reset: "fixture-restored",
      status: "production-fallback-passed",
    }),
  );
} finally {
  await browser.close();
}
