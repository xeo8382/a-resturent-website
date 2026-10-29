# Phase 3 POS scope and inventory

Figma access attempt: the supplied prototype returned HTTP CONNECT 403 under the environment's network policy. Exported screenshots have been requested. Any UI changes in this phase are reference-independent and provisional; no exact visual match is claimed.

Existing: PostgreSQL/Prisma menu and online orders; role-backed staff sessions; incoming order SSE plus polling fallback; expected-state transitions; kitchen preparation restrictions; cash attestation on completion; audited events; read-only table overview; menu price/availability updates and administrator staff creation.

Missing at the start: staff order composer, authenticated menu endpoint scoped to the staff restaurant, dine-in table claiming, order provenance, receipts, an operational floor view, and menu content creation/editing.

Dependencies: existing Next.js App Router, React/TypeScript, Prisma 6 with the PostgreSQL JavaScript adapter, Zod, local PostgreSQL, opaque server sessions and same-origin mutation checks. No new external service or dependency is needed. Existing customer API requests and styles are preserved. Database migrations use the existing transactional SQL runner, not prisma migrate deploy.

Planned invariants: service staff/managers/admins can create orders; kitchen staff can prepare but cannot create/collect cash. Prices are loaded in the server transaction. An idempotency key cannot be reused across actors or payloads. Dine-in requires a table in the same restaurant. A row lock and partial unique index allow one active check per table; cancellation/completion releases the claim atomically. Staff orders enter ACCEPTED after explicit Send to kitchen, online orders retain PLACED. Cash remains PENDING until the validated completion transition records PAID. Receipts accurately distinguish pending/paid/void.

## Implemented

- `/pos` now lives in the existing authenticated staff route group and serves the service-staff composer. Kitchen users are redirected to `/pos/kitchen`. The dark shell shows role-appropriate links; server authorization remains authoritative.
- Categories, search, availability indicators, a separate staff draft, table selection, quantities, kitchen notes and a permanently accessible tablet Send action. Staff drafts/attempt keys are tab-local, scoped by user, with an in-memory fallback if browser storage is unavailable. The customer cart is not used or changed.
- `POST /api/pos/orders` is added alongside the existing GET. It accepts item IDs/quantities, DINE_IN/PICKUP, table/guest/notes and an idempotency key. Client prices and unsupported fields are rejected. Staff dine-in phone numbers are not required; the database stores an empty phone for those checks.
- `GET /api/pos/menu` and `GET /api/pos/tables` use the signed-in user's restaurant. Existing `/api/menu` and `/api/orders` public contracts remain unchanged.
- `Order.source` and `createdById` identify staff vs online orders. Online orders retain PLACED; explicit staff Send to kitchen creates an ACCEPTED order with an actor audit event and pending cash payment. Combined incoming orders retain SSE and polling, with source and table labels.
- Table locks, serializable retries, a unique idempotency key and the partial unique index prevent duplicate active checks. Completion/cancellation releases the claim in the existing order/payment transaction. A table is available here when it has no active check; this is not a reservation/seating scheduler.
- Kitchen users can start preparation and mark ready. They cannot create checks, access receipts, confirm payments or change menu data. The existing status endpoint is unchanged.
- `GET /api/pos/orders/[id]/receipt` and `/pos/receipts/[id]` enforce service roles and tenant isolation. Receipt reads use a repeatable-read snapshot. PAID receipts show collected cash and timestamp; PENDING/VOID are clearly marked. Browser print CSS is included.
- `/api/admin/menu` keeps its existing PATCH price/availability fields and adds optional content fields. POST creates a menu item. Admins/managers are authorized server-side and categories must belong to their restaurant. Existing staff account creation remains administrator-only.

## Local setup

No dependency change or additional secret is required. On an existing database, run `npm run db:generate` and `npm run db:migrate` before starting the new code. The additive migration `20261030000000_staff_pos` adds order provenance and one-active-check-per-table enforcement. It preserves existing records with source ONLINE. If a database already has multiple active checks assigned to the same table, the unique-index migration fails transactionally; reconcile those checks rather than deleting data to bypass it. Do not use `prisma migrate deploy` with this project's separate SQL migration ledger.

## Validation

Lint, TypeScript, production build, 32 unit tests, 16 PostgreSQL integration tests and 13 browser tests pass locally. Coverage includes concurrent same-key retries and different-key table claims, cross-restaurant tables and receipts, kitchen/service permissions, unavailable and forged-price items, pending/paid/void payment states, table release, manager menu controls and the original customer checkout-to-POS workflow.

The 1280×800 browser flow creates sample staff and online orders, prepares them with a separate kitchen session, attests cash collection, views the paid receipt and verifies the table is free. Test-owned data is cleaned up. Tablet captures cover order entry, incoming orders, kitchen, tables, cash receipt and administration; an additional print-layout capture is included. The recorded customer styling/motion/public-order/session source hashes are unchanged.

## Remaining limitations

Figma matching remains blocked pending exported screenshots. No exact visual reproduction is claimed. Table layout/capacity editing, table moves/merges, multiple active checks per table, reservations, split tenders, upfront partial payments, tips, refunds, tax/discount rules, inventory deductions, category CRUD, menu deletion, image uploads and staff password/role lifecycle management are not implemented. Receipts are browser-printable; physical thermal printers, fiscal/tax compliance, cash drawers and external deployment have not been verified. The queue retains the existing 200-order recent/active limit. Table availability refreshes every five seconds; the server always rechecks on creation. Staff-created delivery orders are not supported; the public website retains delivery and pickup.

Existing development advisories may appear for the customer kitchen photograph's LCP detection, Vitest's future configuration loader, and pg's queued-query deprecation with the installed Prisma adapter. All checks pass with the pinned current dependencies; no production performance or security certification is claimed. No deployment was performed.
