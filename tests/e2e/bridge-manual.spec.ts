import { expect, test } from "@playwright/test";

test("manual wrong and correct values drive persisted bridge physics", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      apiRequests.push(request.url());
    }
  });

  await page.goto("/judge");
  await page
    .getByRole("button", { name: "Try the lesson as a student" })
    .click();
  await expect(page.getByText("Your work is saved")).toBeVisible();

  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByLabel("Fraction as a decimal (optional)").fill("0.34");
  await page.getByRole("button", { name: "Test this bridge" }).click();
  await expect(
    page.getByRole("heading", { name: "Bridge test in progress" }),
  ).toBeVisible();
  const wrongStage = page.locator(".simulation-stage--bridge").first();
  await expect(wrongStage).toHaveAttribute(
    "data-simulation-phase",
    /deploying|driving/u,
  );
  await expect(wrongStage).toHaveAttribute(
    "data-simulation-events",
    /sagging/u,
    {
      timeout: 20_000,
    },
  );
  await expect(wrongStage).toHaveAttribute(
    "data-simulation-events",
    /sagging.*snapping.*peeling.*collision.*falling.*splash/u,
    { timeout: 15_000 },
  );
  await expect(page.getByText("Result ready")).toBeVisible({
    timeout: 25_000,
  });
  await expect(
    page.locator(".simulation-card").first().locator("canvas"),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The visual renderer is unavailable. Your result remains below.",
    ),
  ).toHaveCount(0);
  await expect(
    page.getByText("The bridge was built from your answer: 4.08 m.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The bridge fell short." }),
  ).toBeVisible();
  await expect(page.getByText(/0\.75|\b9\s*m\b/iu)).toHaveCount(0);
  await expect(
    page.locator('[aria-label*="0.75"], [aria-label*="9 m"]'),
  ).toHaveCount(0);
  for (const diagnostic of [
    "Domain check",
    "Immutable attempt cutoff",
    "student canvas operation",
    "structured response",
    "deterministic validator",
  ]) {
    await expect(page.getByText(diagnostic, { exact: false })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Give me a hint" }).click();
  await expect(
    page.getByText(/What is one of four equal parts/u),
  ).toBeVisible();
  await expect(page.getByText(/Now take three/u)).toHaveCount(0);
  await expect(page.getByText(/0\.75|\b9\s*m\b/iu)).toHaveCount(0);
  await page.getByRole("button", { name: "Give me another hint" }).click();
  await expect(
    page.getByText(/Now take three of those equal parts/u),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The World's Shortest Bridge" }),
  ).toBeVisible();

  const requestsBeforeReplay = apiRequests.length;
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(wrongStage).toHaveAttribute(
    "data-simulation-phase",
    /deploying|driving/u,
  );
  await expect(page.getByText("Result ready")).toBeVisible({
    timeout: 25_000,
  });
  expect(apiRequests).toHaveLength(requestsBeforeReplay);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("button", { name: "Test this bridge" }),
  ).toBeEnabled();
  await page.getByLabel("Bridge length").fill("9");
  await page.getByLabel("Fraction as a decimal (optional)").fill("0.75");
  await page.getByRole("button", { name: "Test this bridge" }).click();
  await expect(
    page.getByRole("heading", { name: "Safe crossing" }),
  ).toBeVisible();
  await expect(
    page.locator(".simulation-card").nth(1).locator("canvas"),
  ).toBeVisible();
  await page
    .locator(".simulation-card")
    .nth(1)
    .getByRole("button", { name: "Skip to result" })
    .click();
  await expect(page.getByText(/9 meter bridge spans/u)).toBeVisible();
  await expect(
    page.getByText(/Each quarter is 3 meters\. Three quarters is 9 meters/u),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fixed It" })).toBeVisible();

  await page.getByRole("button", { name: "Teacher view" }).click();
  await page.reload();
  await page
    .locator(".simulation-card")
    .first()
    .getByRole("button", { name: "Skip to result" })
    .click();
  await expect(
    page.getByText(
      "Likely misconception: the learner treated the numerator and denominator as decimal digits.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Safe crossing" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Student view" }).click();
  await page
    .locator(".simulation-card")
    .first()
    .getByRole("button", { name: "Skip to result" })
    .click();
  await expect(
    page.getByRole("heading", { name: "The bridge fell short." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Teacher view" }).click();

  await page.getByRole("button", { name: "Reset current task" }).click();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "The World's Shortest Bridge" }),
  ).toHaveCount(0);
  await expect(page.getByText("Teacher notes are saved")).toBeVisible();
});

test("manual bridge form rejects unsafe ranges without creating a run", async ({
  page,
}) => {
  await page.goto("/judge");
  await page
    .getByRole("button", { name: "Try the lesson as a student" })
    .click();
  await page.getByLabel("Bridge length").fill("-2");
  await page.getByRole("button", { name: "Test this bridge" }).click();
  await expect(
    page.getByText(
      "Enter a bridge length greater than 0 and no more than 24 meters.",
    ),
  ).toBeVisible();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
});
