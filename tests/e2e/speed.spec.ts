import { expect, test } from "@playwright/test";

test("speed values drive short, collision, and correct motion scenes", async ({
  page,
}) => {
  const attemptRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /\/api\/rooms\/[^/]+\/attempts$/u.test(new URL(request.url()).pathname)
    ) {
      attemptRequests.push(request.url());
    }
  });
  await page.goto("/");
  const speedSkill = page.getByRole("link", { name: "Speed and collision" });
  await expect(speedSkill).toHaveAttribute("href", "/speed");
  await speedSkill.click();
  await expect(
    page.getByRole("heading", { name: "Guide the lab shuttle" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview as student" }).click();

  await page.getByLabel("Final travel distance").fill("12");
  await page.getByRole("button", { name: "Run shuttle value" }).click();
  await expect(
    page.getByRole("heading", { name: "Shuttle stopped short" }),
  ).toBeVisible();
  await expect(page.getByText(/12 meters stops before/u)).toBeVisible();

  await page.getByLabel("Final travel distance").fill("36");
  await page.getByRole("button", { name: "Run shuttle value" }).click();
  await expect(
    page.getByRole("heading", { name: "Soft bumper boop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bumper Boop" }).last(),
  ).toBeVisible();
  await expect(
    page.locator(".simulation-card").nth(1).locator("canvas"),
  ).toBeVisible();

  const requestsBeforeReplay = attemptRequests.length;
  await page.getByRole("button", { name: "Replay" }).nth(1).click();
  expect(attemptRequests).toHaveLength(requestsBeforeReplay);

  await page.getByLabel("Final travel distance").fill("24");
  await page.getByRole("button", { name: "Run shuttle value" }).click();
  await expect(
    page.getByRole("heading", { name: "Shuttle arrived on target" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Route Corrected" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Shuttle stopped short" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Soft bumper boop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Shuttle arrived on target" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Reset current task" }).click();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
  await expect(page.locator(".achievement-card")).toHaveCount(0);
});
