import { mkdir, rm } from "node:fs/promises";

import { chromium } from "@playwright/test";

import { RoomBootstrapSchema } from "../src/shared/protocol";

const productionOrigin = new URL(
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev",
);
const outputDirectory = ".tmp/submission-video/raw";

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const created = await fetch(new URL("/judge", productionOrigin), {
  redirect: "manual",
});
if (created.status !== 302) {
  throw new Error(`Production /judge returned ${created.status}`);
}
const teacherUrl = new URL(
  created.headers.get("location") ?? "",
  productionOrigin,
);
const roomId = teacherUrl.pathname.split("/").at(-1);
const teacherToken = new URLSearchParams(teacherUrl.hash.slice(1)).get("token");
if (roomId === undefined || teacherToken === null) {
  throw new Error("Production /judge returned an invalid room redirect");
}

const bootstrapResponse = await fetch(
  new URL(`/api/rooms/${roomId}/bootstrap`, productionOrigin),
  { headers: { Authorization: `Bearer ${teacherToken}` } },
);
if (!bootstrapResponse.ok) {
  throw new Error(`Production bootstrap returned ${bootstrapResponse.status}`);
}
const bootstrap = RoomBootstrapSchema.parse(await bootstrapResponse.json());
if (bootstrap.studentCapability === undefined) {
  throw new Error("Teacher bootstrap omitted the learner capability");
}

const studentUrl = new URL(`/r/${roomId}`, productionOrigin);
studentUrl.hash = new URLSearchParams({
  token: bootstrap.studentCapability,
}).toString();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  colorScheme: "light",
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outputDirectory,
    size: { height: 720, width: 1280 },
  },
  reducedMotion: "reduce",
  viewport: { height: 720, width: 1280 },
});
const page = await context.newPage();
const consoleErrors: string[] = [];
let attemptRequests = 0;

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push("browser-console-error");
});
page.on("request", (request) => {
  if (/\/api\/rooms\/[^/]+\/attempts$/u.test(new URL(request.url()).pathname)) {
    attemptRequests += 1;
  }
});

async function hold(milliseconds: number): Promise<void> {
  await page.waitForTimeout(milliseconds);
}

async function feature(
  locator: ReturnType<typeof page.locator>,
  holdMs = 3500,
) {
  await locator.scrollIntoViewIfNeeded();
  await hold(holdMs);
}

try {
  await page.goto(studentUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.getByText("Prepared judge sample").waitFor({ timeout: 15_000 });
  await page.addStyleTag({
    content: `
      html { scroll-behavior: smooth; }
      body { overflow-x: hidden; }
      .room-header { position: static !important; }
    `,
  });
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await hold(3500);

  await feature(
    page.getByRole("heading", { name: "Fractions and the bridge" }),
  );
  await feature(
    page.getByRole("heading", { name: "Work it out by hand" }),
    4500,
  );
  await feature(
    page.getByRole("heading", { name: "Let the math control the bridge" }),
    2500,
  );

  await page.getByRole("button", { name: "Run my solution" }).click();
  await hold(2500);
  const wrongAnalysis = page.locator(".analysis-card").filter({
    hasText: "Interpretation complete",
  });
  await wrongAnalysis.waitFor({ state: "visible", timeout: 30_000 });
  await feature(wrongAnalysis, 5500);

  const shortBridge = page.locator(".simulation-card").filter({
    has: page.getByRole("heading", { name: "Bridge too short" }),
  });
  await shortBridge.waitFor({ state: "visible", timeout: 20_000 });
  await feature(shortBridge, 6500);

  const correction = page.getByRole("button", {
    name: "Apply prepared correction",
  });
  await correction.scrollIntoViewIfNeeded();
  await hold(2000);
  await correction.click();
  await feature(
    page.getByRole("heading", { name: "Work it out by hand" }),
    4000,
  );

  await feature(
    page.getByRole("heading", { name: "Let the math control the bridge" }),
    1500,
  );
  await page.getByRole("button", { name: "Run my solution" }).click();
  await hold(2500);
  const analyses = page.locator(".analysis-card").filter({
    hasText: "Interpretation complete",
  });
  await analyses.nth(1).waitFor({ state: "visible", timeout: 30_000 });
  await feature(analyses.nth(1), 5000);

  const safeBridge = page.locator(".simulation-card").filter({
    has: page.getByRole("heading", { name: "Safe crossing" }),
  });
  await safeBridge.waitFor({ state: "visible", timeout: 20_000 });
  await feature(safeBridge, 6500);
  await feature(page.getByRole("heading", { name: "Fixed It" }), 3500);

  const replay = safeBridge.getByRole("button", { name: "Replay" });
  await replay.click();
  await hold(3500);

  if (attemptRequests !== 2) {
    throw new Error(
      `Expected two analysis requests; observed ${attemptRequests}`,
    );
  }
  if (consoleErrors.length > 0) {
    throw new Error("Production capture emitted a browser console error");
  }
} finally {
  await page.close();
  await context.close();
  await browser.close();
}

console.info(
  JSON.stringify({
    attemptRequests,
    outputDirectory,
    privacy: "page-only-recording-with-student-capability-never-rendered",
    status: "submission-video-capture-passed",
  }),
);
