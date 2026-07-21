import { expect, test } from "@playwright/test";

test("load values drive underload, collapse, and stable structure scenes", async ({
  page,
}) => {
  const attemptRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/rooms\/[^/]+\/attempts$/u.test(new URL(request.url()).pathname))
      attemptRequests.push(request.url());
  });
  await page.goto("/structure");
  await expect(
    page.getByRole("heading", { name: "Balance the cargo platform" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page.getByLabel("Final total load").fill("30");
  await page.getByRole("button", { name: "Run platform value" }).click();
  await expect(
    page.getByRole("heading", { name: "Platform load undercounted" }),
  ).toBeVisible();
  await page.getByLabel("Final total load").fill("90");
  await page.getByRole("button", { name: "Run platform value" }).click();
  await expect(
    page.getByRole("heading", { name: "Breakaway platform collapse" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { exact: true, name: "Platform Pancake" }).last(),
  ).toBeVisible();
  await expect(
    page.locator(".simulation-card").nth(1).locator("canvas"),
  ).toBeVisible();
  const requestsBeforeReplay = attemptRequests.length;
  await page.getByRole("button", { name: "Replay" }).nth(1).click();
  expect(attemptRequests).toHaveLength(requestsBeforeReplay);
  await page.getByLabel("Final total load").fill("60");
  await page.getByRole("button", { name: "Run platform value" }).click();
  await expect(
    page.getByRole("heading", { name: "Platform load balanced" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Support Restored" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Platform load undercounted" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Breakaway platform collapse" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Platform load balanced" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset current task" }).click();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
  await expect(page.locator(".achievement-card")).toHaveCount(0);
});
