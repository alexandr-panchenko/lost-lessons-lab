import { expect, test, type Page } from "@playwright/test";

async function drawStroke(
  page: Page,
  layer: "Student math solution" | "Teacher annotation",
  verticalOffset = 0.4,
): Promise<void> {
  const canvas = page.getByLabel(`${layer} drawing canvas`);
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("Canvas is not visible");
  await page.mouse.move(
    bounds.x + bounds.width * 0.25,
    bounds.y + bounds.height * verticalOffset,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.7,
    bounds.y + bounds.height * (verticalOffset + 0.1),
    { steps: 10 },
  );
  await page.mouse.up();
}

test("excludes teacher ink and exposes an honest manual fallback", async ({
  page,
}) => {
  const attemptBodies: unknown[] = [];
  await page.route("**/api/rooms/*/attempts", async (route) => {
    attemptBodies.push(route.request().postDataJSON());
    await route.fulfill({
      body: JSON.stringify({ error: "ai_disabled", fallback: "manual" }),
      contentType: "application/json",
      status: 503,
    });
  });

  await page.goto("/");
  await drawStroke(page, "Teacher annotation", 0.25);
  await expect(page.locator('[data-saved-strokes="1"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Try the lesson as a student" })
    .click();

  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByText(
      "Write a solution on the canvas before asking AI to read it.",
    ),
  ).toBeVisible();
  expect(attemptBodies).toHaveLength(0);

  await drawStroke(page, "Student math solution", 0.55);
  await expect(page.locator('[data-saved-strokes="2"]')).toBeVisible();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByText(
      "I couldn't read the handwriting this time. Your work is saved; enter your bridge measurement below.",
    ),
  ).toBeVisible();
  expect(attemptBodies).toHaveLength(1);
  expect(attemptBodies[0]).toMatchObject({
    mediaBase64: expect.any(String),
    previewAsStudent: false,
    sourceCanvasSeq: expect.any(Number),
  });
  expect((attemptBodies[0] as { contentHash: string }).contentHash).toMatch(
    /^[a-f0-9]{64}$/u,
  );
  expect(
    (attemptBodies[0] as { mediaBase64: string }).mediaBase64.startsWith(
      "iVBORw0KGgo",
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Test this bridge" }),
  ).toBeEnabled();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByRole("button", { name: "Test this bridge" }).click();
  await expect(
    page.getByRole("heading", { name: "Bridge test in progress" }),
  ).toBeVisible();
  await page.getByLabel("Bridge length").fill("9");
  await page.getByRole("button", { name: "Test this bridge" }).click();
  await expect(
    page.getByRole("heading", { name: "Safe crossing" }),
  ).toBeVisible();
  await expect(page.locator('[data-saved-strokes="2"]')).toBeVisible();
});
