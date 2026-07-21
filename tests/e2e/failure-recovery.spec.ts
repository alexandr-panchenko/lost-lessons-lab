import { expect, test } from "@playwright/test";

test("an unsupported topic keeps the room and offers supported alternatives", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Describe the specific gap")
    .fill("quadratic equations");
  await page.getByRole("button", { name: "Use the bridge sample" }).click();
  await expect(
    page.getByText(
      "That topic is not available in this rescue build. Try Fractions.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Water and volume")).toHaveCount(0);
  await expect(page.getByText("Speed and collision")).toHaveCount(0);
  await expect(page.getByText("Structure and load")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Fractions and the bridge" }),
  ).toBeVisible();
});

test("an upload failure preserves ink and exposes an explicit retry", async ({
  page,
}) => {
  await page.route("**/api/rooms/*/attempts", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ error: "media_storage", fallback: "manual" }),
      contentType: "application/json",
      status: 503,
    });
  });
  await page.goto("/judge");
  await page.getByRole("button", { name: "Load sample mistake" }).click();
  await expect(page.locator("[data-saved-strokes]")).toHaveAttribute(
    "data-saved-strokes",
    /^[1-9]\d*$/u,
  );
  const savedBefore = await page
    .locator("[data-saved-strokes]")
    .getAttribute("data-saved-strokes");
  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByRole("button", { name: "Retry upload" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your drawing is intact", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("[data-saved-strokes]")).toHaveAttribute(
    "data-saved-strokes",
    savedBefore ?? "0",
  );
});

test("a renderer failure keeps the verified transcript and retry control", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__LOST_LESSONS_TEST_RENDERER_FAILURE__", true);
  });
  await page.route("**/api/rooms/*/attempts", (route) =>
    route.fulfill({
      body: JSON.stringify({ error: "ai_disabled", fallback: "manual" }),
      contentType: "application/json",
      status: 503,
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Student lesson" }).click();
  await page.getByRole("button", { name: "Load sample mistake" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByRole("button", { name: "Test this bridge" }).click();
  await expect(
    page.getByRole("heading", { name: "The bridge fell short." }),
  ).toBeVisible();
  await expect(
    page.getByText("The visual renderer is unavailable", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry simulation" }),
  ).toBeVisible();
  await expect(
    page.getByText("It was built from your answer: 4.08 m.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("constrained rendering stays quiet and leaves room controls usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 2,
    });
  });
  await page.route("**/api/rooms/*/attempts", (route) =>
    route.fulfill({
      body: JSON.stringify({ error: "ai_disabled", fallback: "manual" }),
      contentType: "application/json",
      status: 503,
    }),
  );
  await page.goto("/judge");
  await page.getByRole("button", { name: "Load sample mistake" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByRole("button", { name: "Test this bridge" }).click();

  await expect(
    page.getByText("Reduced decorative effects are active", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Teacher setup" }).click();
  await page.getByRole("button", { name: "Reset current task" }).click();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
});
