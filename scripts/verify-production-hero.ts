import { chromium } from "@playwright/test";

const productionOrigin =
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  reducedMotion: "reduce",
  viewport: { height: 900, width: 1280 },
});
const attemptRequests: string[] = [];
const consoleErrors: string[] = [];
page.on("request", (request) => {
  if (/\/api\/rooms\/[^/]+\/attempts$/u.test(new URL(request.url()).pathname))
    attemptRequests.push(request.method());
});
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push("browser-console-error");
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
  await page.getByRole("button", { name: "Teacher setup" }).click();
  await page.getByRole("button", { name: "Reset current task" }).click();
  await page.locator(".analysis-card").first().waitFor({ state: "detached" });
  await page.locator('[data-saved-strokes="0"]').waitFor();

  if (attemptRequests.length !== 2)
    throw new Error(`Expected two GPT attempts, saw ${attemptRequests.length}`);
  if (consoleErrors.length > 0)
    throw new Error("Production hero emitted a browser console error");
  console.info(
    JSON.stringify({
      aiAttempts: 2,
      directStudentEntry: true,
      persistence: "reload-passed",
      replay: "no-new-gpt-request",
      reset: "empty-canvas-restored",
      status: "production-final-bridge-hero-passed",
    }),
  );
} finally {
  await browser.close();
}
