# Ember & Table

An original restaurant concept built with Next.js App Router, TypeScript, Tailwind CSS, Motion for React, PostgreSQL, Prisma and Zod. Phase 1 implements a real customer-order-to-staff workflow. All menu copy, prices and restaurant details are sample content. Customer photography is licensed serving inspiration, not exact dish photography. No real restaurant is configured; use sample customer information.

## Run locally

Requirements: Node.js 24, npm, Docker Compose (or an existing PostgreSQL 17 database).

```sh
npm ci
cp .env.example .env
# Edit .env: use your own database URL if needed, set APP_ORIGIN,
# and supply SEED_ADMIN_EMAIL plus a unique SEED_ADMIN_PASSWORD (12+ characters).
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The development app listens on port 3000. The database is bound only to loopback with development-only credentials in `compose.yaml`. Change them outside local development. No API keys or external services are required. Keep `.env` out of version control. An initial admin account is created **only** when both seed variables are supplied; there is no default password. Existing seed accounts and edited menu records are never overwritten. Remove the seed password from `.env` after creating the account. If an account already exists, changing the seed password does not reset it.

Use the existing checkout in isolated cloud tasks; do not create a Git worktree unless explicitly requested. Live processes do not survive environment restoration: restart PostgreSQL if necessary and run `npm run dev`.

## What works

- `/`: viewport-height photographic homepage, editorial typography, layered imagery, coordinated scroll parallax/reveals, route-entry transitions, accessible mobile navigation and reduced-motion support.
- `/menu`, `/menu/[slug]`: database menu, categories, search, dish details, allergen notes, availability and cart controls.
- `/cart`, `/checkout`: browser-persisted quantities, delivery or pickup, server validation and cash-only payment. Delivery is BDT 60; pickup is free. No online payment is collected.
- `/orders/[id]#<private-token>`: private receipt, totals, payment state and live status timeline. Save the complete link; there is no customer account or recovery flow.
- `/pos/login`, `/pos`, `/pos/orders`: staff sessions, a searchable/category-based staff order composer, dine-in/pickup orders, a combined online/staff queue, validated status updates and explicit cash-collection confirmation.
- `/pos/kitchen`: kitchen queue. Kitchen users can start preparation and mark ready; they cannot accept, cancel, dispatch or complete orders.
- `/admin`: managers/admins create menu items and edit content, categories, allergen lists, prices and availability. New items receive a placeholder illustration. Admins can create service, kitchen and manager accounts. Staff listing is read-only.
- `/pos/tables`: live active-check overview with table selection and order links. One active check per table is enforced in PostgreSQL; completed/cancelled checks release the table. Reservations and table reassignment are not implemented.
- `/pos/receipts/[id]`: protected printable cash receipts or clearly labelled unpaid/void order tickets.

## Order integrity and authorization

The browser submits only menu item IDs and integer quantities. Unknown input fields (including client prices) are rejected. A serializable database transaction loads current available menu prices, calculates totals in integer poisha (100 = BDT 1), snapshots names/prices, and creates the order, payment and initial event atomically. A unique checkout key plus a request hash makes retries idempotent and rejects conflicting reuse. The checkout saves the exact attempt and private token before sending it, so a lost response can be safely retried.

Staff authorization is checked on the server for every protected page, read and mutation. Restaurant IDs come from the authenticated user. Passwords use salted scrypt hashes. Sessions use random 256-bit opaque tokens; only their SHA-256 digests are stored. Cookies are HttpOnly, SameSite=Lax, Secure in production, and expire after 8 hours. Expired sessions and inactive users are rejected. Login attempts are throttled per normalized email in PostgreSQL (10 per 15 minutes). Mutation endpoints enforce the configured exact origin; set `APP_ORIGIN` to the browser origin, including port, with no path.

Tracking uses a separate random 256-bit capability token whose hash is stored in the database. The URL fragment keeps the token out of initial page requests; the browser sends it to the private JSON/SSE endpoints. Tracking responses exclude contact details and addresses. Anyone holding the complete link can read the order. Do not log tracking URLs, query strings, or customer data in your reverse proxy. Referrer policy is `no-referrer`.

Status graph:

```text
PLACED → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → COMPLETED
                                  └→ COMPLETED (pickup)
PLACED or ACCEPTED → CANCELLED
```

Staff must confirm collecting cash to complete an order. Completion marks payment PAID; cancellation marks it VOID. Terminal states cannot change. Each transition checks the expected current state and writes an audit event in the same transaction. Already-placed orders retain their price snapshots when menu prices change.

## Live transport

`/api/pos/stream` and `/api/orders/[id]/stream` use SSE backed by PostgreSQL reads every 1.5 seconds. Connections end after 25 seconds and EventSource reconnects after 2 seconds. There is no in-memory pub/sub, process affinity or standalone socket server. Staff credentials/customer tokens are revalidated on each read. Clients show connection state and also poll every 10 seconds as a fallback.

Requires a **Node runtime supporting streaming and requests lasting at least 30 seconds**. Disable proxy response buffering. The 30-second route duration is declared but has not been verified on an external deployment. For a larger workload, replace frequent reads with a managed event transport and appropriate connection pooling. No delivery-time estimate or automatic staff acceptance is simulated.

## Database and migrations

Models: Restaurant, User, MenuCategory, MenuItem, Order, OrderItem, Payment, Table and Reservation; plus Session, LoginThrottle and OrderEvent for authentication/audit.

The runtime uses Prisma 6's JavaScript query engine and official PostgreSQL adapter. Native Prisma engine downloads are blocked in this cloud environment. `prisma.config.ts` opts into Prisma 6's experimental JavaScript **schema** engine for generation/diff commands. Its migrate-deploy path hit an unsupported PostgreSQL catalog type, so the checked-in Prisma-generated SQL is applied by `scripts/migrate.ts` instead. The application query adapter is separate from that schema tooling.

`npm run db:migrate` executes ordered migration directories with a PostgreSQL advisory lock, one transaction per migration, and SHA-256 checksums in `_ember_migrations`. Repeating it verifies checksums and skips applied migrations. Never modify an applied migration. Do not mix this runner with `prisma migrate deploy`; migration ledgers differ. For new schema changes, generate/review a new SQL migration with Prisma diff against the previous schema or a development database, then apply it with this runner. Back up data before schema changes. Current migrations do not delete data.

Seeding is repeatable and uses upserts that preserve edits. It creates seven sample dishes and eight sample tables. Reservations are modeled only; booking is not implemented. Phase 3 adds table association at staff order creation. See `docs/PHASE-3-POS.md` for the additive migration, permissions and table concurrency policy.

## Verify

Run against a dedicated local/test database, not a real restaurant database:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm run test:e2e
```

- Unit tests: totals, invalid quantities, hostile cart prices, checkout validation, transitions, cash confirmation, password verification and request origins.
- PostgreSQL integration tests: atomic persistence, snapshots, idempotent concurrent retries, tracking-token access, unavailable items, cross-restaurant isolation, kitchen restrictions, stale changes and cash/void payment states. Tests clean up their own records.
- Chromium tests: real browser checkout → login → POS lifecycle → live tracking, API access/origin checks and mobile/reduced-motion layouts. Playwright starts the production server after a build. It uses `/usr/bin/chromium` by default in this environment; set `CHROMIUM_PATH` to your executable elsewhere. Test accounts have random credentials and are removed after the run.

Screenshots/traces are local ignored outputs in `test-results`. `npm run format` formats source. An override updates Prisma tooling's transitive `deepmerge-ts` to the patched major version; client generation, build and test checks cover the integration.

## Design references and limits

The requested Fragrancia website and Figma prototype returned network-policy denials; neither was visually inspected. The public site uses original restaurant content and an independent editorial design based on the requested cinematic direction. The tablet POS is a functional **provisional** console, not a claimed Figma reproduction. Exported POS screenshots are needed for visual matching. No reference branding, assets or proprietary code were copied. The customer redesign now uses locally hosted CC0 food/kitchen photography with credits in `public/photos/CREDITS.txt` and `docs/asset-licenses/`. Photographs are serving inspiration; the citrus drink retains its original illustration. Database and POS artwork are unchanged. See `docs/CUSTOMER-REDESIGN.md` for frontend scope, motion and limits.

## Not production-ready

Verified locally only. Before real service: replace sample content/contact/location and fulfillment rules, verify HTTPS cookies/origin/streaming on your deployment, configure database TLS/backups/pooling, add deployment-level abuse protection and monitoring, complete a security/accessibility review, and test operational recovery. Current login throttling is per account; it does not replace edge/IP rate limiting or prevent account lockout abuse. Public checkout has no anti-spam/anti-bot controls. Stream and order retention policies, session/throttle cleanup, CSP, password reset, staff deactivation/role editing, menu item deletion/image uploads, category editing, reservations/table reassignment, taxes, discounts, refunds, stock, notifications, online payments and production observability are not implemented. Status completion records a staff cash attestation, not a bank-verified payment. The queue shows at most 200 recent/active orders; high-volume pagination is future work.
