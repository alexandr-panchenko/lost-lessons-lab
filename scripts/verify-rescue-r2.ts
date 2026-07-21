import { chromium, type Page } from "@playwright/test";

const reviewOrigin = new URL(
  process.env.R2_REVIEW_URL ??
    process.env.PRODUCTION_URL ??
    "https://lost-lessons-lab.sanocks.workers.dev",
);

async function enterWrongRun(page: Page): Promise<number> {
  await page.goto(new URL("/judge", reviewOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: "Try the lesson as a student" })
    .click();
  await page.getByText("Live room connected", { exact: true }).waitFor();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByLabel("Fraction as a decimal (optional)").fill("0.34");
  const startedAt = performance.now();
  await page.getByRole("button", { name: "Test this bridge" }).click();
  await page.locator(".simulation-stage--bridge").waitFor();
  return startedAt;
}

async function measureFrames(page: Page, durationMs: number) {
  return page.evaluate(async (duration) => {
    const deltas: number[] = [];
    const start = performance.now();
    let prior = start;
    await new Promise<void>((resolve) => {
      const sample = (time: number) => {
        deltas.push(time - prior);
        prior = time;
        if (time - start >= duration) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const sorted = [...deltas].sort((a, b) => a - b);
    const elapsed = deltas.reduce((total, delta) => total + delta, 0);
    return {
      averageFps: (deltas.length / elapsed) * 1000,
      frames: deltas.length,
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    };
  }, durationMs);
}

const browser = await chromium.launch({ headless: true });
const normalContext = await browser.newContext({
  reducedMotion: "no-preference",
  viewport: { height: 900, width: 1280 },
});
const normalPage = await normalContext.newPage();
const consoleErrors: string[] = [];
const mutationRequests: string[] = [];
normalPage.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push("browser-console-error");
});
normalPage.on("request", (request) => {
  if (
    /\/api\/rooms\/[^/]+\/(?:attempts|simulation-runs)$/u.test(request.url())
  ) {
    mutationRequests.push(request.method());
  }
});

try {
  const startedAt = await enterWrongRun(normalPage);
  const stage = normalPage.locator(".simulation-stage--bridge");
  await stage.waitFor();
  await normalPage
    .locator('[data-simulation-phase="driving"]')
    .waitFor({ timeout: 12_000 });
  const performanceResult = await measureFrames(normalPage, 1_200);
  if (performanceResult.averageFps < 20 || performanceResult.p95FrameMs > 70) {
    throw new Error(
      `Desktop frame budget missed: ${performanceResult.averageFps.toFixed(1)} fps, p95 ${performanceResult.p95FrameMs.toFixed(1)} ms`,
    );
  }
  await normalPage
    .locator('[data-simulation-events*="sagging"]')
    .waitFor({ timeout: 12_000 });
  await normalPage
    .locator('[data-simulation-events*="snapping"]')
    .waitFor({ timeout: 4_000 });
  await normalPage
    .locator('[data-simulation-events*="peeling"]')
    .waitFor({ timeout: 4_000 });
  await normalPage
    .locator('[data-simulation-events*="collision"]')
    .waitFor({ timeout: 4_000 });
  await normalPage
    .locator('[data-simulation-events*="falling"]')
    .waitFor({ timeout: 6_000 });
  await normalPage
    .locator('[data-simulation-events*="splash"]')
    .waitFor({ timeout: 6_000 });
  await normalPage
    .locator('[data-simulation-events*="aftermath"]')
    .waitFor({ timeout: 6_000 });
  await normalPage.getByText("Result ready").waitFor({ timeout: 25_000 });
  const durationSeconds = (performance.now() - startedAt) / 1000;
  if (durationSeconds < 14 || durationSeconds > 21) {
    throw new Error(
      `Wrong-run wall duration was ${durationSeconds.toFixed(2)}s`,
    );
  }
  const studentPresentation = await normalPage.locator("main").innerText();
  const studentAccessibilityText = await normalPage
    .locator("main")
    .evaluate((main) =>
      Array.from(main.querySelectorAll("[aria-label]"))
        .map((element) => element.getAttribute("aria-label") ?? "")
        .join(" "),
    );
  if (
    /0[.,]75|\b9\s*(?:m|meters?)\b/iu.test(
      `${studentPresentation} ${studentAccessibilityText}`,
    )
  ) {
    throw new Error(
      "The wrong-attempt learner view disclosed the correct answer",
    );
  }
  for (const diagnostic of [
    "Domain check",
    "Immutable attempt cutoff",
    "student canvas operation",
    "structured response",
    "deterministic validator",
  ]) {
    if (studentPresentation.includes(diagnostic)) {
      throw new Error(
        `The learner view exposed a raw diagnostic: ${diagnostic}`,
      );
    }
  }
  await normalPage.getByRole("button", { name: "Give me a hint" }).click();
  await normalPage.getByText(/What is one of four equal parts/u).waitFor();
  if (
    /0[.,]75|\b9\s*(?:m|meters?)\b/iu.test(
      await normalPage.locator("main").innerText(),
    )
  ) {
    throw new Error("The first hint disclosed the correct answer");
  }
  await normalPage
    .getByRole("button", { name: "Give me another hint" })
    .click();
  await normalPage.getByText("Now take three of those equal parts.").waitFor();
  const requestsBeforeReplay = mutationRequests.length;
  await normalPage.getByRole("button", { name: "Replay" }).click();
  await normalPage
    .locator('[data-simulation-phase="driving"]')
    .waitFor({ timeout: 12_000 });
  if (mutationRequests.length !== requestsBeforeReplay) {
    throw new Error("Replay made a new mutation or GPT-backed attempt request");
  }
  await normalPage.getByRole("button", { name: "Skip to result" }).click();
  await normalPage.getByText("Result ready").waitFor();

  const reducedContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { height: 900, width: 1280 },
  });
  const reducedPage = await reducedContext.newPage();
  try {
    await enterWrongRun(reducedPage);
    await reducedPage
      .getByText(
        /articulated bridge, vehicle tumble, moving water, and rescue/u,
      )
      .waitFor();
    await reducedPage
      .locator('[data-simulation-events*="splash"]')
      .waitFor({ timeout: 20_000 });
    await reducedPage.getByText("Result ready").waitFor({ timeout: 25_000 });
  } finally {
    await reducedContext.close();
  }

  if (consoleErrors.length > 0) {
    throw new Error("R2 production flow emitted a browser console error");
  }
  console.info(
    JSON.stringify({
      durationSeconds: Number(durationSeconds.toFixed(2)),
      performance: {
        averageFps: Number(performanceResult.averageFps.toFixed(1)),
        frames: performanceResult.frames,
        p95FrameMs: Number(performanceResult.p95FrameMs.toFixed(1)),
      },
      phases: [
        "deploying",
        "driving",
        "sagging",
        "snapping",
        "peeling",
        "collision",
        "falling",
        "splash",
        "aftermath",
      ],
      reducedMotion: "complete-semantic-sequence",
      replay: "no-new-request",
      status: "rescue-r2-passed",
    }),
  );
} finally {
  await normalContext.close();
  await browser.close();
}
