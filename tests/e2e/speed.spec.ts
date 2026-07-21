import { expect, test } from "@playwright/test";

test("speed is absent from public navigation and its route returns to bridge", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Speed and collision")).toHaveCount(0);
  await page.goto("/speed");
  await expect(page).toHaveURL(/\/r\/rm_[A-Za-z0-9_-]+#token=/u);
  await expect(
    page.getByRole("heading", { name: "Fractions and the bridge" }),
  ).toBeVisible();
  await expect(page.getByText("Speed and collision")).toHaveCount(0);
});
