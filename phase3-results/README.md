# Phase 3 — Ember & Table POS

The existing application has been extended, not replaced. **No deployment was performed.** Customer styling, cinematic motion, cart/checkout implementation, public order API, authentication/session implementation and original status transition service are unchanged by source hash checks.

## Reference status

The supplied Figma prototype returned **HTTP CONNECT 403** from the environment network policy. Exported dashboard/order-panel/table screenshots were requested. They have not been supplied. This phase delivers **reference-independent functionality and provisional styling**, not a claimed exact Figma reproduction. Visual matching remains incomplete until the reference is available.

## What is implemented

- Dark responsive staff shell with active navigation and staff identity/role; service-staff New order navigation and admin/manager management controls; server-side role checks remain authoritative.
- `/pos`: categories, searchable real menu, availability states, separate staff draft, quantities, guest name, kitchen notes, dine-in/pickup mode and available-table selection. The tablet check scrolls independently while the Send action remains accessible. Draft/attempt storage is scoped to the staff user in the current tab.
- Server-priced staff orders via added POST `/api/pos/orders`. It accepts IDs and quantities, rejects client prices, and records STAFF source, creator and an ACCEPTED audit event. The explicit Send to kitchen action constitutes service acceptance. Existing customer orders retain ONLINE/PLACED behavior.
- Concurrency-safe table association: serializable transactions, table-row locks, idempotent requests and a PostgreSQL partial unique index enforce one active check per table. Completed/cancelled checks release the claim atomically. The floor updates every five seconds and links available tables to new checks and occupied tables to their orders.
- Combined online/staff incoming queue with source/table labels, status filters, live SSE and polling fallback. Kitchen users can start preparation and mark ready, but cannot create orders, collect cash, read receipts or edit menus.
- Explicit cash confirmation at completion; pending/paid/void states remain real database records. Protected receipt/ticket views use consistent database snapshots and printable layout. Pending tickets are never labelled as paid.
- Admin/manager menu creation and editing of name, description, category, allergens, price and availability. New dishes use a placeholder illustration. Original administrator-only staff creation remains available.
- Loading, error, retry and empty states. Direct-request tests cover authentication, role restrictions, same-origin enforcement, idempotent retries, table conflicts and receipt authorization.

## Tablet captures — 1280×800

All screenshots are of real local workflows using test-owned sample users/orders/tables, which were cleaned up after the run. No persistent demo password was added. The Next.js development indicator may be visible.

| Screen | Capture |
|---|---|
| New staff order and current check | [Open](pos-order-entry-1280x800.png) |
| Online and staff orders together | [Open](pos-incoming-orders-1280x800.png) |
| Kitchen preparation | [Open](pos-kitchen-1280x800.png) |
| Occupied/available tables | [Open](pos-tables-1280x800.png) |
| Paid cash receipt | [Open](pos-cash-receipt-1280x800.png) |
| Menu administration | [Open](pos-menu-management-1280x800.png) |
| Browser print layout | [Open](receipt-print-layout.png) |

The viewport screenshots can crop below-fold content; the receipt also has a full print-layout capture. Physical printer output is not verified.

## Validation

- Lint, TypeScript and production build: **passed**.
- Unit tests: **32 passed**.
- PostgreSQL integration tests: **16 passed**.
- Full browser suite: **13 passed**, including the original customer checkout → staff/kitchen → cash completion → live customer tracking workflow and new tablet POS workflows.
- Final POS-specific browser reruns pass, with [no captured page errors or warnings](browser-diagnostics.json). Responsive composer smoke checks also pass at 768px and 390px without document overflow.
- Tests demonstrate concurrent same-key retries create one order, different keys cannot double-claim a table, tenants cannot claim each other's tables or read receipts, kitchen permissions are enforced, and cash stays pending until a valid completion. Cancellation voids payment; completion pays it; both release the table.
- The final tablet path creates a BDT 1,470 dine-in check, prepares it in a separate kitchen session, confirms cash in the service session, reads the PAID receipt and verifies the table has no active check afterward.
- The additive migration was applied locally. No dependency declarations or external-service credentials were added. [Preservation evidence](preservation.json).

Full inventory, API/migration details and setup: [docs/PHASE-3-POS.md](../docs/PHASE-3-POS.md).

## Setup for another checkout

Use the existing README instructions. For an existing database, run `npm run db:generate` and `npm run db:migrate` before starting the new source. Migration `20261030000000_staff_pos` adds order provenance and the active-table constraint. It preserves existing orders as ONLINE. Pre-existing duplicate active table checks must be reconciled before the unique index can be applied; the migration fails transactionally instead of deleting data. Existing staff accounts continue to work; if none exist, securely configure the documented seed administrator credentials and run `npm run db:seed`.

For portable screenshot tests use `npm run test:e2e`; captures default to `test-results/phase3-pos`. `POS_SCREENSHOT_DIR` can redirect captures in this cloud task. Tests should run only on sample/test data.

## What remains incomplete

Exact Figma matching; physical floor-plan/capacity editing; reservations; moving/merging/splitting checks or tables; multiple active checks per table; partial/upfront/split payments; taxes, tips, refunds, discounts and inventory; staff role/password lifecycle; category CRUD; menu deletion and photo uploads; thermal printer/cash-drawer/fiscal compliance. Staff order entry supports dine-in and pickup, not delivery; the public delivery workflow is preserved. The queue retains its existing 200-order bound. Availability polling does not replace the server's final table/price checks.

There is no production deployment/security/performance certification. Existing customer-photo LCP, Vitest configuration-loader and pg adapter deprecation advisories may appear outside the final POS browser run; all required checks passed with the installed pinned dependencies. The source is provided on a separate review branch; main is unchanged.
