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
  await expect(
    page.getByRole("button", { name: "Try the lesson as a student" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Live room connected");
  expect(requestedUrls.every((url) => !url.includes("#token="))).toBe(true);

  await page.reload();
  await expect(page).toHaveURL(roomUrl);
  await expect(
    page.getByRole("heading", { name: "Fractions and the bridge" }),
  ).toBeVisible();
});

test("judge switches the same tab to the real student capability and back", async ({
  context,
  page,
}) => {
  await page.goto("/judge");
  const teacherUrl = page.url();
  const roomPath = new URL(teacherUrl).pathname;
  const studentLink = await page.getByLabel("Student link").inputValue();
  const operationsBefore = await page
    .getByText(/shared operations saved/u)
    .innerText();
  const pageCount = context.pages().length;

  await page
    .getByRole("button", { name: "Try the lesson as a student" })
    .click();
  await expect(page).toHaveURL(studentLink);
  expect(context.pages()).toHaveLength(pageCount);
  expect(new URL(page.url()).pathname).toBe(roomPath);
  await expect(page.getByText("Student view", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Student view" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Run my solution" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "What does your learner struggle with?",
    }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Student link")).toHaveCount(0);

  await page.getByRole("button", { name: "Teacher view" }).click();
  await expect(page).toHaveURL(teacherUrl);
  expect(context.pages()).toHaveLength(pageCount);
  await expect(page.getByText("Teacher view", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "What does your learner struggle with?",
    }),
  ).toBeVisible();
  await expect(page.getByText(operationsBefore)).toBeVisible();
  await expect(page.getByLabel("Student link")).toHaveValue(studentLink);
});

test("a separately opened learner capability cannot reveal teacher setup", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  const studentLink = await page.getByLabel("Student link").inputValue();

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto(studentLink);
  await expect(
    studentPage.getByText("Student view", { exact: true }),
  ).toBeVisible();
  await expect(studentPage.getByLabel("Student link")).toHaveCount(0);
  await expect(
    studentPage.getByRole("button", { name: "Teacher view" }),
  ).toHaveCount(0);
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
