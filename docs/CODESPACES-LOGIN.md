# Codespaces POS login

## Configuration

For the supplied public URL, the server setting is:

```dotenv
APP_ORIGIN="https://petrifying-spooky-crypt-5gjj5xx9prxjcvv65-3000.app.github.dev"
```

Set this privately in the Codespace's `.env` or server environment and restart the Next process. An exported environment variable takes precedence over `.env`. Do not commit `.env`, database credentials, account passwords, cookies or session tokens. No database reset, seed or account replacement is part of this fix.

`APP_ORIGIN` must be one HTTP(S) origin without credentials, path, query or fragment. A trailing `/` is accepted. Missing or malformed configuration fails closed with HTTP 503; it cannot throw the previous unhandled URL-parsing error.

For a Codespace, exact local desktop and public phone access to the same Next process also work with a local `APP_ORIGIN`. The additional allowed origin is derived only when all these **server environment** values are valid:

- `CODESPACES=true`
- `CODESPACE_NAME` identifies this Codespace
- `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN=app.github.dev`
- `PORT` is the actual Next listening port (Next sets it for both `next dev` and `next start`)

Only `https://<CODESPACE_NAME>-<PORT>.app.github.dev` is added. Other Codespaces, sibling ports and suffix lookalikes are rejected. Other hosting providers/custom domains must use their exact `APP_ORIGIN`. There is no wildcard trust and no origin inferred from `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` or `Forwarded`. The browser uses relative login requests and supplies its real Origin. The existing check applies to every protected mutation, including logout.

The session cookie remains host-only, HttpOnly, SameSite=Lax and valid for eight hours. It is Secure in production and whenever the **validated** browser origin is HTTPS, even when Codespaces forwards internally over HTTP during development. No cookie domain or cross-site cookie exception is added.

## Diagnose a remaining HTTP 500

An ordinary origin mismatch returns **403**, not 500. The old `new URL(APP_ORIGIN)` could throw and produce 500 when the setting was malformed, but that does not prove it caused the reported mobile failure. Login has no device-specific database path.

Unexpected login exceptions now log only an error class, fixed operation/stage and a restricted machine code, for example:

```text
Request failed: PrismaClientKnownRequestError { operation: 'login', stage: 'session', code: 'P2021' }
```

Stages distinguish `origin`, `body`, `throttle`, `user`, `password` and `session`. `session` covers both the database insertion and cookie write. No request body, email, password, database URL, token, error message or stack is logged by this diagnostic.

- `throttle`: PostgreSQL deletion/upsert of the account's login-attempt counter.
- `user`: lookup of the existing staff account.
- `password`: password verification; do not reset an account to hide a failure.
- `session`: insertion of a hashed-token session followed by the route-handler cookie write.

Use the stage and code from the running Codespace's terminal to investigate its actual database connection, applied schema, or session error. Keep unexpected failures as failures: there is no fallback session, mock login or successful response after a failed persistence operation. An invalid password/inactive account still returns 401; throttling still returns 429.

## Verification scope

`tests/auth.unit.test.ts` exercises origin/configuration rejection, trusted Codespaces metadata, desktop/mobile login, hashed sessions, Secure-cookie behavior in development and production, invalid credentials, throttling and safe database-failure diagnostics. `tests/e2e/auth-login.spec.ts` authenticates temporary staff accounts against real PostgreSQL at desktop 1440px and mobile 390px. It also starts a second production Next server and forwards a synthetic HTTPS Codespaces hostname to it locally, preserving the browser's Origin and cookies. It verifies persisted sessions, reload, protected staff reads, logout, wrong passwords and rejected spoofed hosts/ports. No request from that simulation goes to GitHub, and fixtures are removed afterward. Mobile coverage uses Chromium emulation, not an actual iOS Safari device.

The supplied live Codespaces URL was **not reachable from this execution environment** (network proxy rejected CONNECT with 403). Local proxy regression results do not prove the reported live exception has been eliminated. After updating the Codespace and restarting, verify desktop and phone login against the public HTTPS URL. If 500 remains, collect only the sanitized stage/error code from its server terminal.

Verified locally on 2026-10-30: `npm run lint`, `npm run typecheck`, `npm run build`, 74 unit tests, 29 PostgreSQL integration tests and all 39 Chromium browser tests passed. Existing non-failing Vite config-loader, pg concurrent-query deprecation and terminal-color warnings remain; they were not changed by this authentication patch. No database migration or production deployment was performed.
