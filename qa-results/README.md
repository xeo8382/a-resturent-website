# Ember & Table — QA-01–QA-08 fixes and verification

All eight requested QA findings are addressed. The cinematic composition and normal animation timing are retained. API contracts, database schema, ordering/authentication logic and POS components are unchanged. **No deployment or production configuration change was made.**

## Before / after

Before captures are from the latest read-only QA review; its source-file hashes matched the starting implementation. After captures repeat the same Chromium viewport sizes and two-item sample cart. Each is a full-page image, captured after scrolling through reveals and lazy images.

| Page | Desktop 1440px before | Desktop after | Mobile 390px before | Mobile after |
|---|---|---|---|---|
| Homepage | [Before](before/homepage-desktop-1440.png) | [After](after/homepage-desktop-1440.png) | [Before](before/homepage-mobile-390.png) | [After](after/homepage-mobile-390.png) |
| Menu | [Before](before/menu-desktop-1440.png) | [After](after/menu-desktop-1440.png) | [Before](before/menu-mobile-390.png) | [After](after/menu-mobile-390.png) |
| Cart | [Before](before/cart-desktop-1440.png) | [After](after/cart-desktop-1440.png) | [Before](before/cart-mobile-390.png) | [After](after/cart-mobile-390.png) |
| Checkout | [Before](before/checkout-desktop-1440.png) | [After](after/checkout-desktop-1440.png) | [Before](before/checkout-mobile-390.png) | [After](after/checkout-mobile-390.png) |

## Resolution by finding

| Finding | Change | Observed result |
|---|---|---|
| QA-01 | Scoped customer-summary muted text changes from `#716f63` to `#535548`, preserving the background `#e6e2d5`. | Actual cart text contrast increases **3.90:1 → 5.87:1**, exceeding 4.5:1. The shared customer summary styles cover checkout too. POS colors are unaffected. |
| QA-02 | Mobile menu categories/actions/allergens increased to at least **12px**, descriptions **14px**, search **16px**. Menu introductory and dish-detail allergen copy also increased. Flexible wrapping accommodates larger labels. | Computed styles meet the minimums; all seven cards remain usable at 390px, with no document overflow. |
| QA-03 | Existing CC0 beef photo uses a top-left static **190% crop frame** on homepage, menu, dish detail and cart. Next Image retains valid `fill` sizing inside that frame. | Food occupies substantially more of the frame; no source-image replacement or database-image mutation. Crop remains intact when reduced motion disables hover transforms. |
| QA-04 | A mounted, atomic `role=status`, `aria-live=polite` region announces item and quantity. Action name remains stable for repeated adds. | “Added Fire-roasted chicken to bag. Quantity 1.” and then “Quantity 2.” are exposed. At the cap, the message explains the maximum. Screen-reader hardware/software was not used; DOM accessibility semantics were verified. |
| QA-05 | Cart/checkout action arrows use decorative Lucide SVGs with `aria-hidden=true`, replacing unsupported glyphs. Empty-state arrows are covered too. | Cart and submit buttons render vector arrows; accessible names and ordering behavior remain intact. |
| QA-06 | Reduced-motion overrides now include hover/focus image, button and scroll-indicator transforms. | Normal hover still works; reduced-motion hover/focus stays at `transform:none`. Hero parallax, typography, reveals and route motion remain suppressed under the preference. Static crop dimensions are preserved. |
| QA-07 | Added original `src/app/favicon.ico` and `src/app/icon.svg` through the documented Next metadata file convention. | `/favicon.ico` returns **200** with valid ICO bytes; head metadata includes the icon. No favicon 404 remains. |
| QA-08 | Added `data-scroll-behavior=smooth` to `html`, following the installed Next.js 16 guide, section “Scroll Behavior Override”. | No missing-scroll-marker warning on route navigation; existing reduced-motion automatic scrolling remains intact. |

Implementation details and affected source files: [docs/QA-FIXES.md](../docs/QA-FIXES.md).

## Checks run

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed, including icon generation and server/client compilation.
- `npm test` — **22 passed**.
- `npm run test:integration` — **7 passed**, using the local PostgreSQL sample database.
- `npm run test:e2e` — **11 passed**, including the original customer checkout → authenticated POS → kitchen/preparation → dispatch → cash collection → live customer tracking flow, API/origin checks, staff authorization and session expiry.
- The final QA-fix-specific browser tests also cover the cart beef thumbnail after the visual consistency update.
- Repeated browser QA at **1440×1000** and **390×844**, DPR 1: homepage, menu, populated cart, delivery checkout; filters/search, quantity persistence, pickup toggle, validation, mobile Escape/focus behavior, and reduced motion.
- The sample cart still totals **BDT 940**; delivery total is **BDT 1,000** and pickup **BDT 940**. The screenshot/measurement run sent **zero order POSTs**. Separate lifecycle tests created and cleaned up their own sample accounts/orders.
- All eight requested after captures have document width equal to viewport width and all image elements loaded. No application JavaScript exceptions or failed resources were observed in the repeated capture run.
- Hash checks verify **42 protected files** unchanged, including API/POS/admin/schema/session/order logic and dependency declarations. Normal hero transforms, reveal delays and heading timing match the previous source. See [preservation evidence](preservation.json).

Browser evidence: [after measurements](after/browser-evidence.json) · [contrast/loading/announcement/motion details](after/detail-evidence.json).

## Remaining failures and limitations

**No remaining failure in QA-01–QA-08 or the required checks.**

Two pre-existing advisories remain outside those findings: the development LCP observer warns about the reused kitchen photograph, and Vitest warns about a future native-config-loader compatibility change. Neither is a failing test, missing image, or verified production performance defect. No unrelated performance/configuration rewrite was made.

Stock photographs remain serving inspiration rather than exact dishes; the citrus drink still uses its original illustration. Physical-device performance, Windows font rendering, live screen-reader announcements and external deployment were not certified. The Fragrancia reference was inaccessible (network-policy 403) in the source QA; no visual equivalence is claimed. No reference assets were copied. The Next development indicator is visible in screenshots and may overlay the page; this is not deployed product UI.
