import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const output = process.env.HERO_VIDEO_ARTIFACT_DIR || "test-results/hero-video";
for (const width of [1440, 390]) {
  test.describe(`cooking hero at ${width}px`, () => {
    test.use({
      viewport: { width, height: width === 1440 ? 900 : 844 },
      hasTouch: width === 390,
    });
    test("real frames play, pause, resume, loop, and stop offscreen with the responsive local source", async ({
      page,
      request,
    }) => {
      await mkdir(output, { recursive: true });
      const errors: string[] = [];
      const videos: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("request", (request) => {
        if (/\/videos\/.*\.mp4/.test(request.url()))
          videos.push(new URL(request.url()).pathname);
      });
      await page.goto("/");
      const video = page.locator("#restaurant-hero-video");
      await expect
        .poll(
          () => video.evaluate((el) => (el as HTMLVideoElement).currentTime),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0.1);
      await expect(video).toHaveCSS("opacity", "1");
      const attributes = await video.evaluate((el) => {
        const v = el as HTMLVideoElement;
        return {
          muted: v.muted,
          defaultMuted: v.defaultMuted,
          autoPlay: v.autoplay,
          loop: v.loop,
          playsInline: v.playsInline,
          source: new URL(v.currentSrc).pathname,
          duration: v.duration,
          width: v.videoWidth,
          height: v.videoHeight,
          decodedFrames: v.getVideoPlaybackQuality().totalVideoFrames,
          objectFit: getComputedStyle(v).objectFit,
        };
      });
      expect(attributes).toMatchObject({
        muted: true,
        defaultMuted: true,
        autoPlay: true,
        loop: true,
        playsInline: true,
        objectFit: "cover",
        source:
          width === 390
            ? "/videos/restaurant-hero-mobile.mp4"
            : "/videos/restaurant-hero.mp4",
      });
      expect(attributes.duration).toBeCloseTo(9.375, 2);
      expect(attributes.decodedFrames).toBeGreaterThan(0);
      const frames = await video.evaluate(
        (el) =>
          new Promise<{ time: number; hash: number }[]>((resolve) => {
            const v = el as HTMLVideoElement;
            const canvas = document.createElement("canvas");
            canvas.width = 48;
            canvas.height = 32;
            const context = canvas.getContext("2d", {
              willReadFrequently: true,
            })!;
            const frames: { time: number; hash: number }[] = [];
            const sample: VideoFrameRequestCallback = (_, metadata) => {
              context.drawImage(v, 0, 0, canvas.width, canvas.height);
              const pixels = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              ).data;
              let hash = 0;
              for (let i = 0; i < pixels.length; i++)
                hash = (Math.imul(hash, 31) + pixels[i]) >>> 0;
              frames.push({ time: metadata.mediaTime, hash });
              if (frames.length >= 16) resolve(frames);
              else v.requestVideoFrameCallback(sample);
            };
            v.requestVideoFrameCallback(sample);
          }),
      );
      expect(frames.at(-1)!.time - frames[0].time).toBeGreaterThan(0.5);
      expect(new Set(frames.map((frame) => frame.hash)).size).toBeGreaterThan(
        8,
      );
      const coverage = await video.evaluate((el) => {
        const v = el.getBoundingClientRect(),
          hero = el.closest(".cinema-hero")!.getBoundingClientRect();
        return (
          v.left <= hero.left &&
          v.top <= hero.top &&
          v.right >= hero.right &&
          v.bottom >= hero.bottom
        );
      });
      expect(coverage).toBe(true);
      await page.screenshot({ path: `${output}/playing-${width}.png` });
      await page
        .getByRole("button", { name: "Pause background video" })
        .click();
      await expect(
        page.getByRole("button", { name: "Play background video" }),
      ).toBeVisible();
      const pausedAt = await video.evaluate(
        (el) => (el as HTMLVideoElement).currentTime,
      );
      await page.waitForTimeout(300);
      expect(
        await video.evaluate((el) => (el as HTMLVideoElement).currentTime),
      ).toBeCloseTo(pausedAt, 2);
      await page.getByRole("button", { name: "Play background video" }).click();
      await expect
        .poll(() =>
          video.evaluate((el) => (el as HTMLVideoElement).currentTime),
        )
        .toBeGreaterThan(pausedAt + 0.1);
      await page.evaluate(() =>
        window.scrollTo({ top: 1500, behavior: "instant" }),
      );
      await expect
        .poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused))
        .toBe(true);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await expect
        .poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused))
        .toBe(false);
      await video.evaluate((el) => {
        const v = el as HTMLVideoElement;
        v.currentTime = v.duration - 0.25;
      });
      await expect
        .poll(() =>
          video.evaluate((el) => (el as HTMLVideoElement).currentTime),
        )
        .toBeLessThan(1.5);
      expect(
        await video.evaluate((el) => (el as HTMLVideoElement).paused),
      ).toBe(false);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(video).not.toHaveAttribute("src");
      await expect(video).toBeHidden();
      await expect(page.locator(".hero-video-control")).toBeHidden();
      const range = await request.get(attributes.source, {
        headers: { Range: "bytes=0-1023" },
      });
      expect(range.status()).toBe(206);
      expect(range.headers()["content-type"]).toContain("video/mp4");
      expect((await range.body()).byteLength).toBe(1024);
      expect(new Set(videos)).toEqual(new Set([attributes.source]));
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      expect(errors).toEqual([]);
      await writeFile(
        `${output}/playback-${width}.json`,
        JSON.stringify(
          {
            width,
            attributes,
            sampledFrames: frames,
            loopVerified: true,
            pauseVerified: true,
            offscreenPauseVerified: true,
            reducedMotionStoppedLoading: true,
            coverage,
            errors,
          },
          null,
          2,
        ),
      );
    });

    for (const preference of ["reduced-motion", "save-data"]) {
      test(`${preference} shows the poster without requesting an MP4`, async ({
        page,
      }) => {
        const requests: string[] = [];
        page.on("request", (request) => {
          if (/\.mp4/.test(request.url())) requests.push(request.url());
        });
        if (preference === "reduced-motion")
          await page.emulateMedia({ reducedMotion: "reduce" });
        else
          await page.addInitScript(() => {
            const connection = Object.assign(new EventTarget(), {
              saveData: true,
            });
            Object.defineProperty(navigator, "connection", {
              configurable: true,
              value: connection,
            });
          });
        await page.goto("/");
        await expect(
          page.getByRole("heading", {
            name: "Made by fire. Shared with love.",
          }),
        ).toBeVisible();
        await expect
          .poll(() =>
            page
              .locator(".hero-video-poster img")
              .evaluate((el) => (el as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        await page.waitForTimeout(350);
        await expect(
          page.locator("#restaurant-hero-video"),
        ).not.toHaveAttribute("src");
        await expect(page.locator(".hero-video-control")).toBeHidden();
        expect(requests).toEqual([]);
      });
    }
  });
}

test("an unavailable video leaves a readable poster and working customer navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/videos/*.mp4", (route) =>
    route.fulfill({
      status: 404,
      contentType: "text/plain",
      body: "Missing test video",
    }),
  );
  await page.goto("/");
  const video = page.locator("#restaurant-hero-video");
  await expect
    .poll(() =>
      video.evaluate((el) => (el as HTMLVideoElement).error?.code ?? 0),
    )
    .toBeGreaterThan(0);
  await expect(video).toHaveCSS("opacity", "0");
  await expect(page.locator(".hero-video-poster img")).toBeVisible();
  await expect(page.locator(".hero-video-control")).toBeHidden();
  await page
    .locator(".cinema-hero")
    .getByRole("link", { name: "Explore the menu", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add Fire-roasted chicken to bag" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
