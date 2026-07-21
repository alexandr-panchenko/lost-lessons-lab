import { expect, test } from "@playwright/test";

test("loads the accessible pre-implementation shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Lost Lessons Lab" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Cloudflare Worker runtime is healthy.",
  );
  await expect(
    page.getByText("not part of this environment milestone yet"),
  ).toBeVisible();
});

test("exposes the Worker health endpoint", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    service: "lost-lessons-lab",
    status: "ok",
  });
});
