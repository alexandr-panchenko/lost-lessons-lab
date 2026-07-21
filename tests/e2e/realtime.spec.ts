import {
  expect,
  test,
  type Locator,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";

async function draw(
  canvas: Locator,
  page: Page,
  offset: number,
): Promise<void> {
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("Canvas is not visible");
  await page.mouse.move(
    bounds.x + bounds.width * (0.2 + offset),
    bounds.y + bounds.height * 0.3,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * (0.55 + offset),
    bounds.y + bounds.height * 0.6,
    { steps: 12 },
  );
  await page.mouse.up();
}

test("student and teacher layers synchronize across clean contexts", async ({
  browser,
  page: teacherPage,
}) => {
  await teacherPage.goto("/");
  const studentLink = await teacherPage.getByLabel("Student link").inputValue();
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto(studentLink);

  await draw(
    studentPage.getByLabel("Student math solution drawing canvas"),
    studentPage,
    0,
  );
  await expect(studentPage.locator('[data-saved-strokes="1"]')).toBeVisible();
  await expect(teacherPage.locator('[data-saved-strokes="1"]')).toBeVisible();

  await draw(
    teacherPage.getByLabel("Teacher annotation drawing canvas"),
    teacherPage,
    0.08,
  );
  await expect(teacherPage.locator('[data-saved-strokes="2"]')).toBeVisible();
  await expect(studentPage.locator('[data-saved-strokes="2"]')).toBeVisible();
  await expect(
    studentPage.getByRole("heading", {
      name: "What does your learner struggle with?",
    }),
  ).toHaveCount(0);

  await studentPage.reload();
  await expect(studentPage.locator('[data-saved-strokes="2"]')).toBeVisible();
  await studentContext.close();
});

test("an offline stroke reconciles once without duplication", async ({
  browser,
  page: teacherPage,
}) => {
  await teacherPage.goto("/");
  const studentLink = await teacherPage.getByLabel("Student link").inputValue();
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  let firstSocket: WebSocketRoute | null = null;
  let connectionCount = 0;
  let releaseReconnect: () => void = () => {};
  const reconnectGate = new Promise<void>((resolve) => {
    releaseReconnect = resolve;
  });
  await studentPage.routeWebSocket(
    /\/api\/rooms\/.*\/socket/u,
    async (route) => {
      connectionCount += 1;
      if (connectionCount === 1) {
        firstSocket = route;
        route.connectToServer();
        return;
      }
      await reconnectGate;
      route.connectToServer();
    },
  );
  await studentPage.goto(studentLink);
  await expect(studentPage.getByRole("status").first()).toContainText(
    "Live room connected",
  );

  if (firstSocket === null) throw new Error("WebSocket route was not captured");
  await (firstSocket as WebSocketRoute).close({
    code: 1012,
    reason: "E2E reconnect test",
  });
  await expect(studentPage.getByRole("status").first()).toContainText(
    "Reconnecting",
    { timeout: 10_000 },
  );
  await draw(
    studentPage.getByLabel("Student math solution drawing canvas"),
    studentPage,
    0,
  );
  await expect(
    studentPage.getByText(/new strokes will send after reconnect/u),
  ).toBeVisible();

  releaseReconnect();
  await expect(studentPage.getByRole("status").first()).toContainText(
    "Live room connected",
    { timeout: 15_000 },
  );
  await expect(studentPage.locator('[data-saved-strokes="1"]')).toBeVisible();
  await expect(teacherPage.locator('[data-saved-strokes="1"]')).toBeVisible();

  await studentPage.reload();
  await expect(studentPage.locator('[data-saved-strokes="1"]')).toBeVisible();
  await studentContext.close();
});
