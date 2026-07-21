import { expect, test, type Page } from "@playwright/test";

async function drawStroke(page: Page): Promise<void> {
  const canvas = page.getByLabel("Student math solution drawing canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("Canvas is not visible");
  await page.mouse.move(
    bounds.x + bounds.width * 0.2,
    bounds.y + bounds.height * 0.35,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.4,
    bounds.y + bounds.height * 0.55,
    {
      steps: 8,
    },
  );
  await page.mouse.move(
    bounds.x + bounds.width * 0.7,
    bounds.y + bounds.height * 0.4,
    {
      steps: 8,
    },
  );
  await page.mouse.up();
}

test("manual wrong and correct values drive persisted bridge physics", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      apiRequests.push(request.url());
    }
  });

  await page.goto("/judge");
  await page.getByRole("button", { name: "Preview as student" }).click();
  await drawStroke(page);
  await expect(page.getByText("1 shared operations saved")).toBeVisible();

  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByLabel("Fraction as a decimal (optional)").fill("0.34");
  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByRole("heading", { name: "Bridge too short" }),
  ).toBeVisible();
  await expect(page.getByText("Result confirmed")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/4\.08 meter bridge ends before/u)).toBeVisible();

  const requestsBeforeReplay = apiRequests.length;
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.getByText("Result confirmed")).toBeVisible({
    timeout: 15_000,
  });
  expect(apiRequests).toHaveLength(requestsBeforeReplay);

  await page.getByLabel("Bridge length").fill("9");
  await page.getByLabel("Fraction as a decimal (optional)").fill("0.75");
  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByRole("heading", { name: "Safe crossing" }),
  ).toBeVisible();
  await expect(page.getByText(/9 meter bridge spans/u)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bridge too short" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Safe crossing" }),
  ).toBeVisible();
});

test("manual bridge form rejects unsafe ranges without creating a run", async ({
  page,
}) => {
  await page.goto("/judge");
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page.getByLabel("Bridge length").fill("-2");
  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(
    page.getByText(
      "Enter a bridge length greater than 0 and no more than 24 meters.",
    ),
  ).toBeVisible();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
});
