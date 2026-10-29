# QA-01–QA-08 follow-up

This patch addresses the existing customer QA findings without changing API routes, the database schema, ordering/session logic, POS components, dependency declarations or normal-motion timings.

- **QA-01:** The customer summary scopes its muted color to `#535548`. Browser measurement against `#e6e2d5` is **5.87:1**, up from 3.90:1. It covers cart/checkout supporting text without recoloring POS screens.
- **QA-02:** At mobile widths, menu categories/actions/allergens are at least 12px; menu descriptions are 14px and search input text is 16px. Menu introduction and dish allergen notes are also increased. Wrapping accommodates the larger text.
- **QA-03:** A presentation-only, static 190% top-left frame emphasizes the existing licensed beef photograph. It is applied to the homepage, menu, detail and cart thumbnail. The original image and database image fields are preserved. A containing frame maintains Next Image's required 100% fill sizing. Static cropping is separate from hover transforms, so reduced motion does not undo the composition.
- **QA-04:** Each AddButton has a mounted, atomic, polite status region. It announces the item and resulting quantity; repeated additions produce updated messages. The action's accessible name remains stable. The quantity cap announces its maximum instead of announcing an addition that did not happen.
- **QA-05:** Cart and checkout navigation/submit arrows use decorative Lucide SVG icons instead of unsupported text glyphs. Submission and busy behavior are unchanged.
- **QA-06:** Customer reduced-motion styles suppress image/button/scroll-indicator hover and focus transforms, in addition to the existing parallax/reveal/route suppression. Default motion durations/delays remain unchanged.
- **QA-07:** An original Ember mark is provided as `src/app/icon.svg` and a PNG-backed `src/app/favicon.ico`. Next's metadata file convention registers the icons; `/favicon.ico` returns 200.
- **QA-08:** `html` declares `data-scroll-behavior="smooth"`, following the installed Next.js 16 upgrade guide's “Scroll Behavior Override” section. In-page smooth scrolling remains available; Next can override it during route navigation. The existing reduced-motion CSS still requests automatic scrolling.

Regression coverage is in `tests/e2e/qa-fixes.spec.ts`: measured contrast, repeated polite announcements, SVG actions, readable mobile styles, static crops, reduced-motion hover/focus behavior, favicon validity and framework scroll-warning absence. Existing customer motion and end-to-end order/POS tests remain in place.

Remaining limits: stock photographs remain serving inspiration, the citrus drink retains its original illustration, and physical-device/screen-reader/external-deployment performance is not certified. The pre-existing development LCP observer advisory for the reused kitchen photo is outside QA-01–08; no LCP performance failure has been demonstrated. The Vitest configuration also emits its pre-existing future-native-config compatibility advisory. Neither is a failed test. No deployment is performed.
