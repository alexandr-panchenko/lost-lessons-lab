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
      "That topic is not available in this demo. Try Fractions, Water and volume, or Speed and collision.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Water and volume" }),
  ).toHaveAttribute("href", "/water");
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
  await page.getByRole("button", { name: "Preview as student" }).click();
  const operationsBefore = await page
    .getByText(/shared operations saved/u)
    .innerText();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByRole("button", { name: "Retry upload" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your drawing is intact", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(operationsBefore)).toBeVisible();
});

test("a renderer failure keeps the verified transcript and retry control", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__LOST_LESSONS_TEST_RENDERER_FAILURE__", true);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await expect(
    page.getByRole("heading", { name: "Bridge too short" }),
  ).toBeVisible();
  await expect(
    page.getByText("The visual renderer is unavailable", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry simulation" }),
  ).toBeVisible();
  await expect(page.getByText(/4\.08 meter bridge ends before/u)).toBeVisible();
});
