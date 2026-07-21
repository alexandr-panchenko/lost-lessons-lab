import { expect, test } from "@playwright/test";

const viewports = [
  { height: 900, label: "desktop", width: 1280 },
  { height: 1024, label: "tablet", width: 768 },
  { height: 844, label: "phone", width: 390 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.label} keeps one usable feed without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/judge");
    await page.getByRole("button", { name: "Preview as student" }).click();
    await expect(page.getByLabel("Learning room feed")).toBeVisible();
    await expect(
      page.getByRole("toolbar", { name: "Drawing tools" }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
}

test("reduced motion reaches the same text result without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/judge");
  await page.getByRole("button", { name: "Preview as student" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await expect(page.getByText("Result confirmed")).toBeVisible();
  await expect(page.getByText(/4\.08 meter bridge ends before/u)).toBeVisible();
});
