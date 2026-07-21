import { expect, test } from "@playwright/test";

test("creates a guided teacher room and survives reload", async ({ page }) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));

  await page.goto("/judge");
  await expect(page).toHaveURL(/\/r\/rm_[A-Za-z0-9_-]+#token=/u);
  const roomUrl = page.url();

  await expect(
    page.getByRole("heading", { name: "Make the math move." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "What does your learner struggle with?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fractions and the bridge" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Live room connected");
  expect(requestedUrls.every((url) => !url.includes("#token="))).toBe(true);

  await page.reload();
  await expect(page).toHaveURL(roomUrl);
  await expect(
    page.getByRole("heading", { name: "Fractions and the bridge" }),
  ).toBeVisible();
});

test("teacher preview and learner capability hide private setup", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  const studentLink = await page.getByLabel("Student link").inputValue();

  await page.getByRole("button", { name: "Preview as student" }).click();
  await expect(page.getByText("Student view", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "What does your learner struggle with?",
    }),
  ).toHaveCount(0);

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto(studentLink);
  await expect(
    studentPage.getByText("Student view", { exact: true }),
  ).toBeVisible();
  await expect(studentPage.getByLabel("Student link")).toHaveCount(0);
  await expect(
    studentPage.getByRole("heading", {
      name: "What does your learner struggle with?",
    }),
  ).toHaveCount(0);
  await expect(
    studentPage.getByRole("heading", { name: "Fractions and the bridge" }),
  ).toBeVisible();
  await studentContext.close();
});

test("each judge visit is isolated and invalid capability reveals no room", async ({
  browser,
  page,
}) => {
  await page.goto("/judge");
  const firstRoom = new URL(page.url()).pathname;

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await secondPage.goto("/judge");
  expect(new URL(secondPage.url()).pathname).not.toBe(firstRoom);
  await secondContext.close();

  await page.goto(
    `${new URL(page.url()).origin}${firstRoom}#token=invalid-capability-value-that-is-long-enough`,
  );
  await expect(
    page.getByRole("heading", { name: "Room unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fractions and the bridge" }),
  ).toHaveCount(0);
});
