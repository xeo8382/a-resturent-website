# Ember & Table — customer website QA

Reviewed the existing working implementation and `docs/CUSTOMER-REDESIGN.md` in local Chromium, at desktop **1440 × 1000** and mobile **390 × 844**, DPR 1. The existing Next.js development server was reused after verifying `/api/menu` returned 200. This is a QA review, not a redesign, deployment or production-performance certification.

**Preservation:** application-file SHA-256 hashes match the pre-review baseline. No application/backend/schema/authentication/POS code or production settings were modified. Cart changes were confined to disposable browser contexts. **Zero `/api/orders` POST requests were made; no customer orders or staff accounts were created.** Final order submission, payment collection and staff workflows were deliberately not re-exercised in this review.

**Reference limitation:** `https://fragranciabd.com/` returned HTTP CONNECT 403 from the environment network policy. The reference was not visually inspected. No visual or motion equivalence is claimed.

## Findings, ordered by severity

No critical/high-severity defect was found in the tested read-only customer journey. This is not an assertion that the untested order-submission/deployment paths are defect-free.

| ID | Severity | Concrete issue and reproduction | Source and evidence | Suggested follow-up (not implemented) |
|---|---|---|---|---|
| QA-01 | Medium | Cart summary supporting text is 10px, `rgb(113,111,99)` on `rgb(230,226,213)`: **3.90:1 contrast**, below WCAG AA's 4.5:1 for normal text. Delivery/payment instructions are affected at both widths. | `src/app/customer.css:1014`, `src/app/customer.css:1031`, `src/app/globals.css:815`; cart screenshots and `detail-evidence.json:textContrast`. | Darken the supporting text and review checkout summary copy using the same styles. |
| QA-02 | Medium | At 390px, menu category labels are **8px**, descriptions **10px**, allergen notes **8px** and some decorative labels **6–7px**. The page fits but practical reading is difficult at normal zoom, particularly allergens. A small font is a usability issue here; size alone is not a standalone WCAG failure. | `src/app/customer.css:1653`, `src/app/customer.css:1683`, `src/app/customer.css:1693`; menu-mobile screenshot and `browser-evidence.json:devices[].pages[].smallText`. | Increase critical labels/body/allergen copy, then recheck wrapping and card height. |
| QA-03 | Medium, visual | The beef image's focal crop cuts much of the food off the left/top and leaves most of the card as empty white plate. Reproduced in homepage and menu at both widths. Pixels load correctly; composition is the problem. | `src/lib/customer-photos.ts:8`, `src/app/customer.css:469`, `src/app/customer.css:880`; homepage/menu screenshots. | Tune the crop/focal point or replace that photo with a better-composed licensed asset. |
| QA-04 | Medium, accessibility | Adding an item visibly changes the button to “Added to bag ✓”, but its accessible name remains “Add Fire-roasted chicken to bag”. There is no cart-success live announcement; the only detected live region was an empty assertive alert. The cart does update, but nonvisual confirmation is missing. | `src/components/menu-browser.tsx:30`, `src/components/menu-browser.tsx:46`, `src/components/header.tsx:54`; `detail-evidence.json:cartAnnouncement`. | Add a polite success announcement while preserving repeated-add functionality. |
| QA-05 | Low, visual | The literal ↗ character after **To checkout** and **Place order** renders as a missing-glyph box in this Linux Chromium/font environment. Both controls remain functional. This has not been reproduced on a physical Windows or Android device. | `src/components/cart-view.tsx:117`, `src/components/checkout-form.tsx:252`; cart/checkout screenshots. | Use the vector icon already used by the newer customer controls, or provide symbol-font coverage. |
| QA-06 | Low | Under `prefers-reduced-motion: reduce`, core parallax/typography/reveals stop correctly. A menu image still changes from `transform:none` to `matrix(1.055,0,0,1.055,0,0)` on hover; transitions are disabled, so it snaps rather than animates. Minor inconsistency with the documentation's blanket “removes transforms” wording. | `src/app/customer.css:892`, `src/app/customer.css:1806`; `browser-evidence.json:motion.reduced`. | Decide whether to retain an instantaneous hover state or suppress this enlargement as well. |
| QA-07 | Low | `/favicon.ico` returns **404**, producing the only confirmed failed browser resource request. No broken food photographs were found. | No icon asset/metadata is configured in `src/app/layout.tsx:6`; `detail-evidence.json:networkErrors`. | Supply a favicon/icon metadata asset. |
| QA-08 | Low, integration warning | Next.js warns that `<html>` uses smooth scrolling but lacks `data-scroll-behavior="smooth"`. Navigation succeeded, but the framework cannot explicitly disable that behavior during route transitions through its expected marker. | `src/app/layout.tsx:19`, `src/app/globals.css:16`; `browser-evidence.json:errors`. | Follow the installed Next.js guidance and retest scroll restoration. |

### Known visual/content limits

- Six menu dishes use stock serving-inspiration photos while the citrus drink retains the original SVG illustration (`src/lib/customer-photos.ts:32`). This is documented but creates a visibly inconsistent final card.
- Photos are not exact representations of the listed dishes: for example, the potato photo includes eggs and the cheese photo is a different presentation. Existing serving-inspiration disclaimers are present; actual dish photography is still needed before real restaurant use.
- The LCP observer logs a kitchen-image eager-loading warning. Inspection found the lead image uses `loading=auto`, and the reused kitchen image in the story is lazy. Both ultimately load; this warning alone does not prove a slow LCP or a broken hero. No production LCP benchmark was conducted.
- The Next.js development indicator is visible in screenshots. It can overlay page content in this local runtime and is not evidence of a production UI defect.

## Motion verification — observed in the browser

Actual animation-frame styles were sampled; this was not inferred solely from source declarations. See the JSON evidence files for timestamps and matrices.

| Behavior | Observation |
|---|---|
| Hero typography | Both masked lines move from positive vertical offsets to `transform:none`; distinct computed transforms were observed across ~66–67 frames, settling within the 1.6-second sample at both widths. Source delays are 50ms and 200ms. |
| Hero parallax | At desktop scrollY 400: background moves +48px and scales to 1.048; copy moves +26px; inset photo moves −34px. At 390px: background +56.87px/scale 1.05687, copy +30.81px, inset −40.28px. |
| Story parallax | Main image changed approximately +2.61px → −13.97px while the inset changed +3.26px → +14.32px over a 350px scroll. Opposing layer movement is active. |
| Staggered reveals | Fresh desktop entry: all three cards start opacity 0/+32px. Opacity first exceeded .01 at about 24ms, 120ms and 220ms; all settle to opacity 1/no transform by ~1.1s. At 390px, stacked offscreen cards appropriately wait for their own viewport entry. All were visible after the full capture scroll. |
| Menu filtering | Switching seven dishes to Small plates returns two cards. Existing cards visibly translate from their old positions (sampled +627.8px/+662.1px) to zero; final transforms settle within the 800ms observation window. |
| Menu route entry | Navigation from menu to chocolate detail produced intermediate opacity values down to 0 and back to 1, settling to no transform. The existing incoming-route fade works; no exit crossfade is implemented or claimed. |
| Reduced motion | Fresh reduced-motion context: hero lines, background, copy, inset and route wrapper are all visible at opacity 1 with `transform:none`. A 400px scroll does not introduce parallax. The remaining hover snap is QA-06. |

## Functional and responsive checks

Passed at both requested widths:

- Homepage → menu → populated cart → checkout navigation.
- Seven menu items; Small plates yields two; “chocolate” search yields one.
- Add two items through their actual menu buttons; browser-local cart persists on reload.
- Quantity increment updates bag count from 2 to 3; decrement restores the original quantities.
- Chicken BDT 680 + potatoes BDT 260 = **BDT 940 subtotal**.
- Delivery adds BDT 60 = **BDT 1,000**. Pickup removes the fee = **BDT 940**, hides the address field and shows the demo-location notice.
- Empty checkout submission is blocked by native required-field validation, with **no order POST**.
- Mobile navigation opens, closes with Escape, returns focus to its toggle, and follows its menu link.
- Across all eight required page captures: document scrollWidth equals viewport width (**1440/390 respectively**), and all captured image elements are loaded. No page JavaScript exceptions were observed.

Not tested: real payment/order submission, desktop Safari/Firefox, physical phone keyboard/input zoom, screen-reader software, slow-network/cold-device performance, production deployment or exhaustive accessibility compliance. The missing announcement is supported by DOM inspection, not a claim that a screen-reader session was run. No unit/build test rerun was necessary for this no-code-change review; all results above come from this browser session.

## Full-page screenshots

All were captured from the current running app, after scrolling to trigger lazy images and reveal animations, then returning to the top. Cart and checkout use sample browser-local items only; no real customer information is included.

| Page | Desktop 1440px | Mobile 390px |
|---|---|---|
| Homepage | [Open](homepage-desktop-1440.png) | [Open](homepage-mobile-390.png) |
| Menu | [Open](menu-desktop-1440.png) | [Open](menu-mobile-390.png) |
| Cart | [Open](cart-desktop-1440.png) | [Open](cart-mobile-390.png) |
| Checkout | [Open](checkout-desktop-1440.png) | [Open](checkout-mobile-390.png) |

Evidence: [browser measurements](browser-evidence.json) · [animation/contrast/loading detail](detail-evidence.json).
