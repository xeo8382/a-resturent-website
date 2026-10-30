import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const output =
  process.env.HOME_MOTION_ARTIFACT_DIR || "test-results/homepage-motion";
type Frame = {
  time: number;
  lines: number[];
  backdrop: number;
  inset: number;
  support: number;
  footer: number;
};
type RecordedWindow = Window & { homeFrames: Frame[] };
async function recordEntrance(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const recorded = window as unknown as RecordedWindow;
    recorded.homeFrames = [];
    let start: number | undefined;
    const sample = () => {
      const lines = [
        ...document.querySelectorAll<HTMLElement>(".word-window > span"),
      ];
      const backdrop = document.querySelector(".cinema-backdrop-entrance");
      const inset = document.querySelector(".hero-inset-entrance");
      const support = document.querySelector(".hero-support");
      const footer = document.querySelector(".cinema-hero-footer");
      if (lines.length === 2 && backdrop && inset && support && footer) {
        start ??= performance.now();
        recorded.homeFrames.push({
          time: performance.now() - start,
          lines: lines.map(
            (line) =>
              new DOMMatrixReadOnly(getComputedStyle(line).transform).m42 /
              line.getBoundingClientRect().height,
          ),
          backdrop: new DOMMatrixReadOnly(getComputedStyle(backdrop).transform)
            .m11,
          inset: Number(getComputedStyle(inset).opacity),
          support: Number(getComputedStyle(support).opacity),
          footer: Number(getComputedStyle(footer).opacity),
        });
      }
      if (start === undefined || performance.now() - start < 2100)
        requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

for (const width of [1440, 390]) {
  test.describe(`homepage motion at ${width}px`, () => {
    test.use({
      viewport: { width, height: width === 1440 ? 900 : 844 },
      hasTouch: width === 390,
    });
    test("entrance is staggered, parallax is bounded, reveals run once, and photography remains usable", async ({
      page,
    }) => {
      await mkdir(output, { recursive: true });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await recordEntrance(page);
      await page.goto("/");
      await page.waitForFunction(
        () =>
          ((window as unknown as RecordedWindow).homeFrames.at(-1)?.time ?? 0) >
          2000,
      );
      const frames = await page.evaluate(
        () => (window as unknown as RecordedWindow).homeFrames,
      );
      expect(frames.some((frame) => frame.lines[0] > 0.05)).toBe(true);
      expect(
        frames.some((frame) => frame.lines[0] + 0.03 < frame.lines[1]),
      ).toBe(true);
      expect(frames.some((frame) => frame.backdrop > 1.01)).toBe(true);
      expect(
        frames.some((frame) => frame.support > 0.1 && frame.footer < 0.05),
      ).toBe(true);
      expect(
        frames.some((frame) => frame.inset > 0.05 && frame.footer < 0.05),
      ).toBe(true);
      const final = frames.at(-1)!;
      expect(final.lines.every((value) => Math.abs(value) < 0.001)).toBe(true);
      expect(final.backdrop).toBeCloseTo(1, 3);
      expect(final.footer).toBeCloseTo(1, 3);
      await page.screenshot({ path: `${output}/hero-${width}.png` });

      const invitationFrames = await page.evaluate(async () => {
        const group = document.querySelector(".opening-note .reveal-group")!;
        const texts = [...group.querySelectorAll(".reveal-text")];
        scrollTo({
          top: group.getBoundingClientRect().top + scrollY - innerHeight * 0.3,
          behavior: "instant",
        });
        const frames: number[][] = [];
        const start = performance.now();
        while (performance.now() - start < 1100) {
          frames.push(
            texts.map((text) => Number(getComputedStyle(text).opacity)),
          );
          await new Promise(requestAnimationFrame);
        }
        return frames;
      });
      expect(
        invitationFrames.some((frame) => frame[0] > frame[1] + 0.025),
      ).toBe(true);
      expect(invitationFrames.at(-1)!.every((opacity) => opacity === 1)).toBe(
        true,
      );

      await page.evaluate(() =>
        window.scrollTo({ top: 350, behavior: "instant" }),
      );
      const heroTransform = () =>
        page.locator(".cinema-backdrop").evaluate((el) => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          return { y: matrix.m42, scale: matrix.m11 };
        });
      await expect
        .poll(async () => (await heroTransform()).y)
        .toBeGreaterThan(5);
      const hero = await heroTransform();
      expect(hero.y).toBeLessThan(width === 390 ? 33 : 83);
      expect(hero.scale).toBeLessThan(width === 390 ? 1.036 : 1.081);
      // Equal scroll distances should move the mobile backdrop substantially less.
      expect(hero.y).toBeLessThan(width === 390 ? 15 : 40);

      const philosophy = page.locator(".philosophy > .reveal").first();
      expect(
        await philosophy.evaluate((el) => getComputedStyle(el).opacity),
      ).toBe("0");
      await philosophy.scrollIntoViewIfNeeded();
      await expect(philosophy).toHaveCSS("opacity", "1");
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await expect(philosophy).toHaveCSS("opacity", "1");

      const storyTop = await page
        .locator("#story")
        .evaluate((el) => el.getBoundingClientRect().top + scrollY);
      await page.evaluate(
        (top) => window.scrollTo({ top, behavior: "instant" }),
        storyTop - 250,
      );
      const storyOffsets = () =>
        page
          .locator(".story-photo-main,.story-photo-detail")
          .evaluateAll((els) =>
            els.map(
              (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
            ),
          );
      await page.waitForTimeout(100);
      const before = await storyOffsets();
      await page.evaluate(() =>
        window.scrollBy({ top: 250, behavior: "instant" }),
      );
      await expect
        .poll(async () => (await storyOffsets())[0])
        .toBeLessThan(before[0]);
      const after = await storyOffsets();
      expect(after[1]).toBeGreaterThan(before[1]);
      expect(Math.abs(after[0])).toBeLessThanOrEqual(width === 390 ? 14 : 32);

      if (width === 1440) {
        const dish = page.locator(".editorial-dish").first();
        await dish.hover();
        await expect
          .poll(() =>
            dish
              .locator("img")
              .evaluate(
                (el) =>
                  new DOMMatrixReadOnly(getComputedStyle(el).transform).m11,
              ),
          )
          .toBeGreaterThan(1.03);
        await dish.focus();
        await expect(dish).toBeFocused();
      }
      await page.evaluate(async () => {
        for (
          let y = 0;
          y < document.body.scrollHeight;
          y += innerHeight * 0.7
        ) {
          scrollTo({ top: y, behavior: "instant" });
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      });
      await expect
        .poll(() =>
          page
            .locator("main img")
            .evaluateAll((images) =>
              images.every(
                (image) => (image as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      await page.waitForTimeout(1000);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: `${output}/homepage-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      expect(errors).toEqual([]);
      await writeFile(
        `${output}/motion-${width}.json`,
        JSON.stringify(
          {
            width,
            frames,
            invitationFrames,
            heroAt350px: hero,
            storyBefore: before,
            storyAfter: after,
            pageErrors: errors,
          },
          null,
          2,
        ),
      );
    });

    test("reduced motion is readable on first paint and responds to live preference changes without hydration errors", async ({
      page,
      browser,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const serverOnly = await browser.newContext({
        javaScriptEnabled: false,
        reducedMotion: "reduce",
        viewport: { width, height: width === 1440 ? 900 : 844 },
      });
      try {
        const firstPaint = await serverOnly.newPage();
        await firstPaint.goto(new URL("/", page.url()).href);
        for (const selector of [
          ".word-window > span",
          ".hero-entrance",
          ".reveal-text",
        ]) {
          for (const node of await firstPaint.locator(selector).all()) {
            await expect(node).toHaveCSS("opacity", "1");
            await expect(node).toHaveCSS("transform", "none");
          }
        }
      } finally {
        await serverOnly.close();
      }
      for (const selector of [
        ".word-window > span",
        ".cinema-backdrop-entrance",
        ".hero-entrance",
        ".hero-inset-entrance",
        ".reveal",
        ".reveal-text",
      ]) {
        for (const node of await page.locator(selector).all()) {
          await expect(node).toHaveCSS("opacity", "1");
          await expect(node).toHaveCSS("transform", "none");
        }
      }
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate(() =>
        window.scrollTo({ top: 350, behavior: "instant" }),
      );
      await expect
        .poll(() =>
          page
            .locator(".cinema-backdrop")
            .evaluate(
              (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
            ),
        )
        .toBeGreaterThan(5);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(".cinema-backdrop")).toHaveCSS(
        "transform",
        "none",
      );
      await page.waitForTimeout(100);
      const inline = await page
        .locator(".cinema-backdrop")
        .getAttribute("style");
      await page.evaluate(() =>
        window.scrollTo({ top: 600, behavior: "instant" }),
      );
      await page.waitForTimeout(150);
      expect(await page.locator(".cinema-backdrop").getAttribute("style")).toBe(
        inline,
      );
      await page.locator(".editorial-dish").first().focus();
      await expect(page.locator(".editorial-dish img").first()).toHaveCSS(
        "transform",
        "none",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      expect(errors).toEqual([]);
    });
  });
}
