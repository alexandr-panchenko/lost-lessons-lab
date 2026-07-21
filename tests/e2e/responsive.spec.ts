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

test("reduced motion preserves the complete catastrophe with fewer effects", async ({
  page,
}) => {
  test.setTimeout(35_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/rooms/*/attempts", (route) =>
    route.fulfill({
      body: JSON.stringify({ error: "ai_disabled", fallback: "manual" }),
      contentType: "application/json",
      status: 503,
    }),
  );
  await page.goto("/judge");
  await page.getByRole("button", { name: "Load sample mistake" }).click();
  await page.getByRole("button", { name: "Run my solution" }).click();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByRole("button", { name: "Test this bridge" }).click();
  const stage = page.locator(".simulation-stage--bridge");
  await expect(stage).toHaveAttribute("data-simulation-events", /splash/u, {
    timeout: 20_000,
  });
  await expect(page.getByText("Result ready")).toBeVisible({
    timeout: 25_000,
  });
  await expect(
    page.getByText("It was built from your answer: 4.08 m.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(stage).toHaveAttribute(
    "data-simulation-events",
    /snapping.*falling.*collision.*splash.*aftermath/u,
  );
});
