import { test, expect } from "@playwright/test";

test("customer hero has viewport scale, bounded scroll motion and usable menu interactions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const hero = page.locator(".cinema-hero");
  expect((await hero.boundingBox())!.height).toBeGreaterThanOrEqual(990);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Made by fire.",
  );
  await page.waitForTimeout(1200);
  const before = await page
    .locator(".cinema-backdrop")
    .evaluate((el) => getComputedStyle(el).transform);
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  await page.waitForTimeout(300);
  const after = await page
    .locator(".cinema-backdrop")
    .evaluate((el) => getComputedStyle(el).transform);
  expect(after).not.toBe(before);
  await page.goto("/menu");
  await page.getByRole("button", { name: "Small plates", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Small plates", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".menu-card")).toHaveCount(2);
  await page.getByRole("button", { name: "All plates", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search the menu" })
    .fill("chocolate");
  await expect(page.locator(".menu-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Dark chocolate moment" }),
  ).toBeVisible();
  const photo = page.locator(".menu-card-image img");
  await expect(photo).toHaveAttribute("src", /photos/);
  await photo.hover();
  await page.waitForTimeout(950);
  expect(await photo.evaluate((el) => getComputedStyle(el).transform)).not.toBe(
    "none",
  );
});

test("mobile navigation supports Escape and reduced motion presents static readable content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const selector of [
    ".cinema-backdrop",
    ".cinema-copy",
    ".hero-photo-layer",
    ".word-window > span",
    ".customer-route",
  ]) {
    for (const node of await page.locator(selector).all())
      expect(await node.evaluate((el) => getComputedStyle(el).transform)).toBe(
        "none",
      );
  }
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
  expect(
    await page
      .locator(".cinema-backdrop")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await toggle.click();
  await page.getByRole("link", { name: "The menu", exact: true }).click();
  await expect(page.locator(".menu-card")).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("customer visual scope never wraps the POS login", async ({ page }) => {
  await page.goto("/pos/login");
  await expect(page.locator(".customer-site")).toHaveCount(0);
  await expect(page.locator(".site-header")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Arial");
  expect(
    await page
      .locator(".login-page")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(247, 244, 237)");
});
