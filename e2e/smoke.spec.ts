import { expect, test, type Page } from "@playwright/test";

/** The whole loop in one go: sign in, make a course and lecture, go live, a student reacts and asks, end, read the report. */
test("a teacher runs a lecture and a student takes part", async ({ page, browser }) => {
  const stamp = Date.now().toString(36);
  page.on("dialog", (d) => d.accept()); // "End the class for everyone?"

  // Sign in with the development login and skip first-time setup if it shows.
  await page.goto("/login");
  await page.getByText("Sign in as test teacher").click();
  await page.waitForURL(/\/(courses|welcome)/);
  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: "Skip setup" }).click();
    await page.waitForURL(/\/courses$/);
  }

  // A course and a lecture.
  await page.goto("/courses");
  await page.locator("#name").fill(`E2E course ${stamp}`);
  await page.getByRole("button", { name: /Create course/ }).click();
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: /New lecture/ }).first().click();
  await page.locator("#title").fill(`E2E lecture ${stamp}`);
  await page.getByRole("button", { name: /Create lecture/ }).click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}$/);
  const code = (await page.content()).match(/\/j\/([A-Z0-9]{6})/)?.[1];
  expect(code, "join code on the lecture page").toBeTruthy();

  // Go live.
  await page.getByRole("button", { name: /Go live/ }).click();
  await page.waitForURL(/\/live$/);
  await expect(page.getByText("LIVE", { exact: false }).first()).toBeVisible();

  // A student on a phone joins, reacts and asks.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const student = await phone.newPage();
  await student.goto(`/j/${code}`);
  await student.getByRole("button", { name: /Join anonymously/ }).click();
  await expect(student.getByText("How's it going?")).toBeVisible();
  await student.getByRole("button", { name: /Got it/ }).click();
  await student.getByRole("button", { name: /Got it/ }).click();
  await student.getByRole("button", { name: /Questions/ }).click();
  await student.getByLabel("Your question").fill("What is a page fault exactly?");
  await student.getByRole("button", { name: "Send question" }).click();
  await expect(student.getByText("Question sent")).toBeVisible();

  // The teacher sees them.
  await expect(kpi(page, "Students here")).toHaveText("1");
  await expect(page.getByText("What is a page fault exactly?").first()).toBeVisible();

  // End class: the teacher lands on the report, the student sees the thank-you screen.
  await page.getByRole("button", { name: "End class" }).click();
  await page.waitForURL(/\/report$/);
  await expect(student.getByText("Class ended")).toBeVisible();
  await expect(page.getByText("Session recap")).toBeVisible();
  // The workers write the report a few seconds after the class ends.
  await expect(page.getByRole("link", { name: /Plan the next lecture/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("What is a page fault exactly?").first()).toBeVisible();

  await phone.close();
});

/** The big number on a dashboard card, found by its label. */
function kpi(page: Page, label: string) {
  return page.locator(".card", { hasText: label }).locator(".poster").first();
}
