# Ember & Table cooking-video QA

[Implementation and test report](../docs/HERO-VIDEO.md) · [Footage source/license and retrieval details](../public/videos/CREDITS.md)

| View | Playing hero | Actual playback data |
| --- | --- | --- |
| Desktop 1440px | [Screenshot](playback/playing-1440.png) | [Decoded-frame samples](playback/playback-1440.json) |
| Mobile 390px | [Screenshot](playback/playing-390.png) | [Decoded-frame samples](playback/playback-390.json) |

The browser checks prove real playback through advancing media time, decoded frame counts and changing pixel hashes, plus pause/resume and loop-wrap assertions. Poster-only reduced-motion/data-saver checks made no MP4 requests. A forced media failure preserved the poster and working navigation.

[Desktop MP4](../public/videos/restaurant-hero.mp4) · [Mobile MP4](../public/videos/restaurant-hero-mobile.mp4)

[Media metadata](media.json) · [Check summary](checks.json) · [Protected-file comparison](preservation.json)

Build, lint, typecheck, 32 unit tests, 16 PostgreSQL integration tests, 17 existing browser regressions and seven new video checks passed. Existing animations and backend/POS logic are preserved. No deployment or physical-device certification is claimed.

Footage: Pressmaster, Pexels video 3191888, under the standard Pexels License (free commercial use). The original provider hosts are blocked here; the asset was retrieved from an independent public copy explicitly crediting that clip. The original provider listing/license could not be re-read live in this environment; see the linked provenance details.
