import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const productionOrigin = new URL(
  process.env.PRODUCTION_URL ?? "https://lost-lessons-lab.sanocks.workers.dev",
);
const outputDirectory = "docs/evidence/r0";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  reducedMotion: "reduce",
  viewport: { height: 900, width: 1280 },
});
const page = await context.newPage();
const consoleErrors: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push("console-error");
});

function requireViewportPlacement(
  bounds: { height: number; y: number } | null,
  label: string,
): void {
  if (bounds === null || bounds.y < 0 || bounds.y + bounds.height > 900) {
    throw new Error(`${label} is not fully visible in the desktop viewport`);
  }
}

try {
  await mkdir(outputDirectory, { recursive: true });
  await page.goto(new URL("/judge", productionOrigin).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Live room connected", { exact: true }).waitFor({
    timeout: 15_000,
  });
  const teacherUrl = page.url();
  const roomPath = new URL(teacherUrl).pathname;
  const studentLink = await page.getByLabel("Student link").inputValue();
  const operationsBefore = await page
    .getByText(/shared operations saved/u)
    .innerText();
  const launch = page.getByRole("button", {
    name: "Try the lesson as a student",
  });
  requireViewportPlacement(await launch.boundingBox(), "Judge launch action");
  requireViewportPlacement(
    await page
      .getByRole("heading", { name: "What does your learner struggle with?" })
      .boundingBox(),
    "Teacher context",
  );
  for (const hiddenScenario of [
    "Water and volume",
    "Speed and collision",
    "Structure and load",
  ]) {
    if ((await page.getByText(hiddenScenario).count()) !== 0) {
      throw new Error(`${hiddenScenario} remains in public navigation`);
    }
  }
  await page.screenshot({
    path: `${outputDirectory}/judge-first-screen.png`,
  });

  const pageCount = context.pages().length;
  await launch.click();
  await page.getByText("Student view", { exact: true }).waitFor();
  await page.getByText("Live room connected", { exact: true }).waitFor({
    timeout: 15_000,
  });
  if (
    page.url() !== studentLink ||
    new URL(page.url()).pathname !== roomPath ||
    context.pages().length !== pageCount
  ) {
    throw new Error("Judge launch did not reuse the same real room and tab");
  }
  if (
    (await page
      .getByRole("heading", {
        name: "What does your learner struggle with?",
      })
      .count()) !== 0 ||
    (await page.getByLabel("Student link").count()) !== 0
  ) {
    throw new Error("Student view exposed private teacher setup");
  }
  requireViewportPlacement(
    await page
      .getByRole("heading", { name: "Fractions and the bridge" })
      .boundingBox(),
    "Learner task",
  );
  requireViewportPlacement(
    await page.getByRole("button", { name: "Run my solution" }).boundingBox(),
    "Run my solution action",
  );
  await page.screenshot({
    path: `${outputDirectory}/student-same-tab.png`,
  });

  await page.getByRole("button", { name: "Teacher view" }).click();
  await page
    .getByRole("heading", { name: "What does your learner struggle with?" })
    .waitFor();
  if (page.url() !== teacherUrl) {
    throw new Error("Teacher view did not restore the teacher capability");
  }
  await page.getByText(operationsBefore).waitFor();

  for (const path of ["/water", "/speed", "/structure"] as const) {
    const response = await fetch(new URL(path, productionOrigin), {
      redirect: "manual",
    });
    if (response.status !== 302 || response.headers.get("location") !== "/") {
      throw new Error(`${path} is still publicly enabled`);
    }
  }
  if (consoleErrors.length > 0) {
    throw new Error("R0 production flow emitted a browser console error");
  }

  console.info(
    JSON.stringify({
      capabilityFiltering: "passed",
      hiddenScenarios: ["water", "speed", "structure"],
      judgeLaunch: "same-tab-real-student-capability",
      screenshots: [
        `${outputDirectory}/judge-first-screen.png`,
        `${outputDirectory}/student-same-tab.png`,
      ],
      status: "rescue-r0-passed",
      teacherReturn: "same-room-state-preserved",
    }),
  );
} finally {
  await browser.close();
}
