# Ember & Table homepage motion evidence

Production Chromium QA at desktop **1440px** and touch/mobile **390px**, with normal and reduced motion. No deployment was performed.

[Read the audit and implementation report](../docs/HOMEPAGE-MOTION-AUDIT.md).

| View | Before | After |
| --- | --- | --- |
| Desktop hero | [Open image](before/hero-1440.png) | [Open image](after/hero-1440.png) |
| Mobile hero | [Open image](before/hero-390.png) | [Open image](after/hero-390.png) |
| Full desktop homepage | — | [Open image](after/homepage-1440.png) |
| Full mobile homepage | — | [Open image](after/homepage-390.png) |

The photographs, typography, palette, content, and layout are preserved. Static images show the settled appearance. Real animation behavior was checked by sampling rendered frames: [desktop data](after/motion-1440.json), [mobile data](after/motion-390.json).

[Check results](checks.json) · [Protected-file comparison](preservation.json) · [Baseline audit](before/audit.json)

Build, lint, typecheck, 32 unit tests, 16 integration tests, and 17 production browser tests passed. The four expanded motion tests also passed after adding invitation-stagger and JavaScript-disabled reduced-motion assertions. No hydration errors or horizontal overflow were observed. Physical-device performance remains unverified.
