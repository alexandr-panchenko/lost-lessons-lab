import { expect, test } from "@playwright/test";

test("the first screen names the next action and exposes a keyboard skip path", async ({
  page,
}) => {
  await page.goto("/judge");

  const nextAction = page.getByRole("button", {
    name: "Try the lesson as a student",
  });
  await expect(nextAction).toBeVisible();
  const nextActionBox = await nextAction.boundingBox();
  expect(nextActionBox).not.toBeNull();
  expect(nextActionBox?.y).toBeLessThan(720);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Learning room feed" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", {
    name: "Skip to the learning feed",
  });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toHaveCSS("outline-style", "solid");
  await expect(skipLink).toHaveCSS("outline-width", "3px");
  await page.evaluate(() => {
    Reflect.set(window, "__LOST_LESSONS_HASH_BEFORE_SKIP__", location.hash);
  });
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Learning room feed" }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        location.hash ===
        Reflect.get(window, "__LOST_LESSONS_HASH_BEFORE_SKIP__"),
    ),
  ).toBe(true);

  await page
    .getByLabel("Describe the specific gap")
    .fill("quadratic equations");
  await page.getByRole("button", { name: "Use the bridge sample" }).click();
  const setupStatus = page.locator(".inline-status[aria-live='polite']");
  await expect(setupStatus).toContainText("not available in this rescue build");

  const preview = page.getByRole("button", {
    name: "Try the lesson as a student",
  });
  await preview.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Student view", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /drawing canvas/u }),
  ).toHaveAttribute("aria-describedby", "canvas-instructions");
  await expect(page.getByText("Student ink", { exact: true })).toBeVisible();
});

test("simulation sound is opt-in, synthesized locally, and muteable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__LOST_LESSONS_AUDIO_CONTEXTS__", 0);
    Reflect.set(window, "__LOST_LESSONS_TONES__", 0);
    class TestAudioContext {
      currentTime = 0;
      destination = {};
      state = "suspended";

      constructor() {
        const count = Number(
          Reflect.get(window, "__LOST_LESSONS_AUDIO_CONTEXTS__"),
        );
        Reflect.set(window, "__LOST_LESSONS_AUDIO_CONTEXTS__", count + 1);
      }

      close(): Promise<void> {
        this.state = "closed";
        return Promise.resolve();
      }

      createGain() {
        return {
          connect: () => undefined,
          gain: {
            exponentialRampToValueAtTime: () => undefined,
            setValueAtTime: () => undefined,
          },
        };
      }

      createOscillator() {
        return {
          connect: <T>(target: T): T => target,
          frequency: {
            linearRampToValueAtTime: () => undefined,
            setValueAtTime: () => undefined,
          },
          start: () => {
            const count = Number(Reflect.get(window, "__LOST_LESSONS_TONES__"));
            Reflect.set(window, "__LOST_LESSONS_TONES__", count + 1);
          },
          stop: () => undefined,
          type: "sine",
        };
      }

      resume(): Promise<void> {
        this.state = "running";
        return Promise.resolve();
      }
    }
    Reflect.set(window, "AudioContext", TestAudioContext);
  });

  await page.goto("/judge");
  await page
    .getByRole("button", { name: "Try the lesson as a student" })
    .click();
  await page.getByLabel("Bridge length").fill("4.08");
  await page.getByRole("button", { name: "Run manual value" }).click();
  await expect(
    page.getByRole("heading", { name: "Bridge too short" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(Reflect.get(window, "__LOST_LESSONS_AUDIO_CONTEXTS__")),
      ),
    )
    .toBe(0);

  const sound = page.getByRole("button", { name: "Turn sound on" });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await sound.click();
  await expect(
    page.getByRole("button", { name: "Mute sound" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(Reflect.get(window, "__LOST_LESSONS_TONES__")),
      ),
    )
    .toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Mute sound" }).click();
  await expect(
    page.getByRole("button", { name: "Turn sound on" }),
  ).toHaveAttribute("aria-pressed", "false");
});
