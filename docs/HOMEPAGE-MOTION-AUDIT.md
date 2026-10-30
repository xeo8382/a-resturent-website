# Homepage motion audit and implementation

Reviewed on 30 October 2026 (Asia/Dhaka). The starting implementation already had a viewport-height hero, two masked heading lines, individual section fades, hero/story parallax, and CSS image hovers. The audit did not find a hydration error in the starting production build at 1440px or 390px with either motion preference. The Fragrancia reference remains inaccessible under this environment's network policy; this work makes no claim of visual equivalence.

## Gaps addressed

| Existing behavior                                                                                                                        | Change                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero text entered, but the background, inset photograph, and footer appeared independently; a route fade also moved the entire homepage. | A coordinated, one-time hero entrance controls background settling, heading lines, supporting copy, inset photograph, and footer. The homepage bypasses the extra route transform; other customer routes retain their 0.42s entry.                                   |
| Hero parallax used the same 120px maximum and 1.12 scale on mobile and desktop.                                                          | Maximum backdrop translation is 82px desktop / 32px mobile, with scale capped at 1.08 / 1.035. Copy and inset use smaller, opposing offsets. Story photographs move in opposite directions, capped at 32px / 14px for the main photograph.                           |
| Invitation copy appeared as a single block; story/closing photographs had no viewport entrance.                                          | Invitation eyebrow, heading, and supporting text stagger by 0.11s desktop / 0.07s mobile. Story and closing photographs reveal once on entering the viewport. Existing dish/philosophy staggered reveals remain.                                                     |
| Reduced-motion state came from the installed Motion hook's initial snapshot.                                                             | A subscribed media-query hook responds to preference changes without a reload. `useSyncExternalStore` provides the same server and first hydration snapshot. CSS makes all animated content immediately readable under reduced motion, including below-fold content. |
| Homepage image hovers scaled to 1.06 and interpolated a filter; the mobile hero image requested a 400vw resource.                        | Homepage dish images use a quieter 1.045 zoom on fine-pointer hover and keyboard focus. Filters no longer animate. The hero uses a 160vw mobile image size matching its existing backdrop frame.                                                                     |

## Entrance and scrolling

The background settles from scale 1.045 over 1.35s. Heading lines rise through their existing masks over 1.1s, starting at 0.12s and 0.28s. Supporting copy starts at 0.46s, the inset at 0.54s, and the footer at 0.72s. Everything settles within approximately 1.44s. The palette, typography, images, restaurant text, section geometry, and navigation are retained.

Only transform and opacity animate. Scrolling remains native: no scroll hijacking, perpetual animation loop, or React state updates per scroll frame. Motion values drive bounded parallax. Mobile/coarse-pointer devices use shorter distances, and viewport reveals run once. Section changes use the existing editorial layout with timed copy/photo reveals; this does not add a page-exit crossfade.

## Verification

- `npm run build`: passed with Next.js 16.4.3 and Prisma 6.19.3. A restricted-sandbox CSS worker initially could not bind its local IPC port. Moving aside that generated Turbopack cache and running the build with the authorized local networking capability resolved it. No application workaround or production configuration change was needed.
- `npm run lint`, `npm run typecheck`: passed.
- Unit tests: **32 passed**. PostgreSQL integration tests: **16 passed**.
- Production Chromium browser suite: **17 passed**, including four new motion checks and all existing customer, cart, checkout, authorization, POS, kitchen, table, and receipt workflows.
- New tests sample real animation frames to check heading stagger, background settling, delayed inset/footer, invitation stagger, bounded parallax, opposite story offsets, one-time reveals, image loading, hover/focus, and reduced-motion changes.
- At a 350px scroll, measured backdrop movement was **31.89px desktop** and **13.27px mobile**. Both viewports had no horizontal overflow, browser page errors, console errors, or hydration errors in these checks.
- Hash comparison against the task-start snapshot: **53 protected files unchanged**, including APIs, database models/migrations, session/authentication code, cart/checkout state, POS, and ordering logic. Existing deployment-preparation files were preserved.

Evidence is saved under `homepage-motion-results/`: baseline hero screenshots and audit JSON, updated hero/full-page screenshots at 1440px and 390px, sampled motion metrics, preservation results, and POS regression screenshots. The automated checks live in [homepage-motion.spec.ts](../tests/e2e/homepage-motion.spec.ts).

## Limits

Chromium desktop and touch/mobile emulation were checked; physical Android/iOS devices and low-end hardware were not. Screenshots show settled appearance; motion verification comes from sampled frames and browser assertions. No formal FPS, battery, Core Web Vitals, or screen-reader certification is claimed. Existing Vitest/Vite future-configuration and PostgreSQL queued-query deprecation warnings remain. No deployment was performed.
