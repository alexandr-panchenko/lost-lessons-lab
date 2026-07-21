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
  await expect(page.getByText("1 shared operations saved")).toBeVisible();
  await page.getByRole("button", { name: "Preview as student" }).click();

  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByText(
      "Write a solution on the canvas before asking AI to read it.",
    ),
  ).toBeVisible();
  expect(attemptBodies).toHaveLength(0);

  await drawStroke(page, "Student math solution", 0.55);
  await expect(page.getByText("2 shared operations saved")).toBeVisible();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByText(
      "AI interpretation is disabled right now. Use the manual bridge controls below.",
    ),
  ).toBeVisible();
  expect(attemptBodies).toHaveLength(1);
  expect(attemptBodies[0]).toMatchObject({
    mediaBase64: expect.any(String),
    previewAsStudent: true,
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
    page.getByRole("button", { name: "Run manual value" }),
  ).toBeEnabled();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await expect(
    page.getByRole("heading", { name: "Bridge too short" }),
  ).toBeVisible();
  await page.getByLabel("Bridge length").fill("9");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await expect(
    page.getByRole("heading", { name: "Safe crossing" }),
  ).toBeVisible();
  await expect(page.getByText("2 shared operations saved")).toBeVisible();
});
