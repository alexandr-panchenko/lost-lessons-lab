import { expect, test } from "@playwright/test";

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
  await expect(page.getByText(/shared operations saved/u)).toBeVisible();

  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByLabel("Fraction as a decimal (optional)").fill("0.34");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await expect(
    page.getByRole("heading", { name: "Bridge too short" }),
  ).toBeVisible();
  await expect(page.getByText("Result confirmed")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.locator(".simulation-card").first().locator("canvas"),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The visual renderer is unavailable. The verified result remains below.",
    ),
  ).toHaveCount(0);
  await expect(page.getByText(/4\.08 meter bridge ends before/u)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The World's Shortest Bridge" }),
  ).toBeVisible();

  const requestsBeforeReplay = apiRequests.length;
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.getByText("Result confirmed")).toBeVisible({
    timeout: 15_000,
  });
  expect(apiRequests).toHaveLength(requestsBeforeReplay);

  await page.getByRole("button", { name: "Apply prepared correction" }).click();
  await expect(
    page.getByRole("button", { name: "Run manual value" }),
  ).toBeEnabled();
  await page.getByLabel("Bridge length").fill("9");
  await page.getByLabel("Fraction as a decimal (optional)").fill("0.75");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await expect(
    page.getByRole("heading", { name: "Safe crossing" }),
  ).toBeVisible();
  await expect(
    page.locator(".simulation-card").nth(1).locator("canvas"),
  ).toBeVisible();
  await expect(page.getByText(/9 meter bridge spans/u)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fixed It" })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bridge too short" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Safe crossing" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Reset current task" }).click();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "The World's Shortest Bridge" }),
  ).toHaveCount(0);
  await expect(page.getByText(/shared operations saved/u)).toBeVisible();
});

test("manual bridge form rejects unsafe ranges without creating a run", async ({
  page,
}) => {
  await page.goto("/judge");
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page.getByLabel("Bridge length").fill("-2");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await expect(
    page.getByText(
      "Enter a bridge length greater than 0 and no more than 24 meters.",
    ),
  ).toBeVisible();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
});
