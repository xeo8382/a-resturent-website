import { test, expect } from "@playwright/test";

function luminance(rgb: string) {
  const channels = rgb
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map(Number)
    .map((n) => n / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return channels.reduce(
    (sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i],
    0,
  );
}

test("cart updates are politely announced, including repeated additions; summary contrast and SVG actions pass", async ({
  page,
}) => {
  await page.goto("/menu");
  const add = page.getByRole("button", {
    name: "Add Fire-roasted chicken to bag",
  });
  await add.click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Added Fire-roasted chicken to bag. Quantity 1." }),
  ).toHaveAttribute("aria-live", "polite");
  await add.click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Added Fire-roasted chicken to bag. Quantity 2." }),
  ).toBeAttached();
  await page.getByRole("link", { name: "Bag, 2 items" }).click();
  await page.locator(".summary").waitFor();
  const colors = await page
    .locator(".summary p, .summary small")
    .evaluateAll((es) =>
      es.map((e) => ({
        foreground: getComputedStyle(e).color,
        background: getComputedStyle(e.closest(".summary")!).backgroundColor,
      })),
    );
  expect(colors.length).toBeGreaterThan(0);
  for (const pair of colors) {
    const [low, high] = [
      luminance(pair.foreground),
      luminance(pair.background),
    ].sort((a, b) => a - b);
    expect((high + 0.05) / (low + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
  const checkout = page.getByRole("link", { name: "To checkout" });
  await expect(checkout.locator("svg")).toHaveAttribute("aria-hidden", "true");
  expect(await checkout.innerText()).not.toContain("↗");
  await checkout.click();
  const place = page.getByRole("button", { name: "Place order" });
  await expect(place.locator("svg")).toHaveAttribute("aria-hidden", "true");
  expect(await place.innerText()).not.toContain("↗");
});

test("390px menu text is readable and the beef crop stays inside the card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu");
  await page.locator(".menu-card").first().waitFor();
  for (const [selector, minimum] of [
    [".category-tabs button", 12],
    [".food-tag", 12],
    [".menu-card-body > p", 14],
    [".menu-card-bottom .allergen-note", 12],
    [".menu-card-bottom .button", 12],
  ] as const) {
    for (const node of await page.locator(selector).all())
      expect(
        await node.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(minimum);
  }
  const card = page.locator(".menu-card").filter({
    has: page.getByRole("heading", { name: "The ember beef bowl" }),
  });
  const crop = await card.locator(".menu-card-image").evaluate((el) => {
    const image = el.querySelector("img")!;
    return {
      frameWidth: el.getBoundingClientRect().width,
      imageWidth: image.getBoundingClientRect().width,
      position: getComputedStyle(image).objectPosition,
      overflow: getComputedStyle(el).overflow,
    };
  });
  expect(crop.imageWidth / crop.frameWidth).toBeCloseTo(1.9, 1);
  expect(crop.position).toBe("0% 0%");
  expect(crop.overflow).toBe("hidden");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page
    .getByRole("button", { name: "Add The ember beef bowl to bag" })
    .click();
  await page.getByRole("link", { name: "Bag, 1 items" }).click();
  const thumbnail = page.locator(".cart-photo img");
  await thumbnail.waitFor();
  expect(
    await thumbnail.evaluate(
      (el) =>
        el.getBoundingClientRect().width /
        el.closest(".cart-photo")!.getBoundingClientRect().width,
    ),
  ).toBeCloseTo(1.9, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("reduced motion suppresses hover and keyboard-focus zoom while retaining static crop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/menu");
  const link = page.locator(".menu-card-image").first();
  const image = link.locator("img");
  await image.hover();
  expect(await image.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
  await link.focus();
  expect(await image.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
  const beef = page
    .locator(".menu-card")
    .filter({ has: page.getByRole("heading", { name: "The ember beef bowl" }) })
    .locator(".menu-card-image img");
  await beef.hover();
  expect(await beef.evaluate((el) => getComputedStyle(el).transform)).toBe(
    "none",
  );
  expect(
    await beef.evaluate(
      (el) =>
        el.getBoundingClientRect().width /
        el.closest(".menu-card-image")!.getBoundingClientRect().width,
    ),
  ).toBeCloseTo(1.9, 1);
});

test("favicon is served and Next.js smooth-scroll guidance is applied without route warnings", async ({
  page,
  request,
}) => {
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  const icon = await request.get("/favicon.ico");
  expect(icon.status()).toBe(200);
  const bytes = await icon.body();
  expect(bytes.readUInt16LE(2)).toBe(1);
  expect(bytes.readUInt16LE(4)).toBeGreaterThan(0);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-scroll-behavior",
    "smooth",
  );
  await expect(
    page.locator('link[rel="icon"][href*="favicon.ico"]'),
  ).toBeAttached();
  await page.getByRole("link", { name: "The menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Fire-roasted chicken to bag" })
    .waitFor();
  expect(
    warnings.filter(
      (m) =>
        m.includes("scroll-behavior") ||
        m.includes("missing-data-scroll-behavior"),
    ),
  ).toEqual([]);
});
