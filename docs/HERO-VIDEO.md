# Cinematic cooking video

The homepage hero now plays a local cooking film within the existing Motion entrance/parallax layer. Typography, food content, section layout, inset photography, dark gradient overlay, and all original animation timings are preserved. The backend, schema, authentication, cart/checkout, and POS have no changes.

## Media and license

The footage is _Person Cutting Parsley Leaves_ by Pressmaster, [Pexels 3191888](https://www.pexels.com/video/person-cutting-parsley-leaves-3191888/), under the [Pexels License](https://www.pexels.com/license/) (free commercial website use/modification; attribution not required, but provided). It is not licensed under the other repository's code license or CC0.

Pexels/Mixkit and their CDNs are blocked by this environment's destination policy. The MP4 was obtained from an independent public copy with explicit creator/original-video attribution. The original provider listing and license could not be accessed live here. [Credits, pinned retrieval URL, checksums, and licensing/access details](../public/videos/CREDITS.md) preserve that distinction.

The original 4K, 17.2MB clip is not shipped. The desktop MP4 is approximately 984KiB; the portrait mobile MP4 is approximately 589KiB. Both are H.264/yuv420p, 24fps, 9.375 seconds, contain no audio track, and have fast-start metadata. A 0.625s end-to-start crossfade makes the last frames lead naturally into the first. Matching JPEG posters are provided for both sizes.

## Playback and accessibility

- Uses `autoPlay`, `muted`, `loop`, `playsInline`, and full-frame `object-fit: cover`. The existing dark overlay stays above the film.
- SSR includes a poster and no MP4 source; loading starts only after the visible hero mounts. `preload="none"` avoids speculative video loading before that decision. No remote runtime embed/CDN request or new dependency is needed.
- Viewports up to 760px choose the smaller portrait clip once. Resizing/rotation does not download a second video.
- Reduced-motion and supported browser data-saver preferences show the poster without requesting an MP4. A live reduced-motion change pauses/unloads the video. All existing reduced-motion animation styles remain.
- Scrolling the hero offscreen or hiding the tab pauses playback. Returning resumes unless the user explicitly paused.
- A stationary, keyboard-accessible pause/play control sits outside the decorative Motion layer. State follows actual media events. The film has no audio and is hidden from assistive technology; headings and navigation carry the content.
- Autoplay rejection or a media error leaves the poster visible. Once metadata is available, the play control allows a user gesture when autoplay is denied. Ordering/navigation remain independent of media loading.

## Verification

Production Chromium checks at 1440×900 and touch/mobile 390×844 confirm actual playback: advancing media timestamps, decoded frame counts, and 16 sampled frames with changing pixel hashes. Tests also check local responsive sources, full hero coverage, mute/loop/inline attributes, pause/resume, automatic loop wrap, offscreen pause, live reduced-motion unloading, and HTTP 206 byte ranges. The reduced-motion/data-saver tests request no MP4. A forced video 404 verifies the readable poster and customer navigation.

Build, lint, typecheck, 32 unit tests and 16 PostgreSQL integration tests pass. The 17 existing browser regressions (including hero animation, checkout-to-POS handling, kitchen transitions, cash collection, authorization and table concurrency) pass, along with seven video-specific checks. The fallback test's initial ambiguous navigation selector was scoped to the hero and retested; no application change was required for that test correction.

Screenshots and sampled playback data are in `hero-video-results/`. The browser assertions are in [hero-video.spec.ts](../tests/e2e/hero-video.spec.ts). Static screenshots are not the playback proof; the changing decoded frames and media-time/loop assertions are.

No deployment was performed. Physical Android/iOS, Safari autoplay, low-power modes, and external hosting bandwidth/performance are unverified. Browser policies can still block autoplay, so a poster fallback remains necessary. Existing Vite configuration and PostgreSQL queued-query warnings are unchanged.
