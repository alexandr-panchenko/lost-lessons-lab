import { expect, test } from "@playwright/test";

test("water values drive bounded underfill, overflow, and correct scenes", async ({
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
  const waterSkill = page.getByRole("link", { name: "Water and volume" });
  await expect(waterSkill).toHaveAttribute("href", "/water");
  await waterSkill.click();
  await expect(
    page.getByRole("heading", { name: "Fill the aquarium" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview as student" }).click();

  await page.getByLabel("Final water volume").fill("8");
  await page.getByRole("button", { name: "Run water value" }).click();
  await expect(
    page.getByRole("heading", { name: "Tank underfilled" }),
  ).toBeVisible();
  await expect(
    page.getByText(/8 liters leaves the level below/u),
  ).toBeVisible();

  await page.getByLabel("Final water volume").fill("24");
  await page.getByRole("button", { name: "Run water value" }).click();
  await expect(
    page.getByRole("heading", { name: "Tank overflow" }),
  ).toBeVisible();
  await expect(
    page.getByText(/24 liters exceeds the 20 liter capacity/u),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tidal Surprise" }).last(),
  ).toBeVisible();
  await expect(
    page.locator(".simulation-card").nth(1).locator("canvas"),
  ).toBeVisible();

  const requestsBeforeReplay = attemptRequests.length;
  await page.getByRole("button", { name: "Replay" }).nth(1).click();
  expect(attemptRequests).toHaveLength(requestsBeforeReplay);

  await page.getByLabel("Final water volume").fill("15");
  await page.getByRole("button", { name: "Run water value" }).click();
  await expect(
    page.getByRole("heading", { name: "Water level on target" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Level Adjusted" }),
  ).toBeVisible();
  await expect(page.getByText(/15 liters fills the tank/u)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tank underfilled" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tank overflow" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Water level on target" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Reset current task" }).click();
  await expect(page.locator(".simulation-card")).toHaveCount(0);
  await expect(page.locator(".achievement-card")).toHaveCount(0);
});
