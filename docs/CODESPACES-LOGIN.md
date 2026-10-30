# Codespaces POS origin validation

## What rejects the request

`POST /api/auth/login` calls `checkOrigin()` **before** reading the body, querying the login throttle/user, or creating a session. HTTP 403 `Invalid request origin.` therefore comes from the origin guard, not PostgreSQL or password verification.

The previous guard compared a raw `Origin` string with canonical allowed origins. It rejected either a missing header or a non-matching string without logging which condition failed. Two reproduced cases are now handled:

1. Equivalent HTTP(S) origin representations (host/protocol case, default port and optional trailing `/`) normalize identically before comparison. Credentials, paths, queries, fragments, origin lists, opaque `null` and missing origins remain invalid.
2. HTTPS forwarding that rewrites the browser's public Origin to its HTTP loopback destination. The old proxy regression preserved Origin and did not cover this case. Recovery is narrowly constrained as described below; it does not allow arbitrary proxy-supplied origins.

The **actual phone's incoming Origin has not been observed from this environment**. The known public URL is blocked by this execution environment's network policy, and the running Codespace's server logs are not available here. Do not treat a simulated proxy reproduction as confirmation of the live failure's cause. The new log identifies its exact rejection condition on the next attempt.

## Apply in the existing Codespace

Stop the existing Next process with Ctrl+C in its terminal first. From the repository root, run:

```bash
git fetch origin
git switch fix/codespaces-pos-login-20261030
git pull --ff-only origin fix/codespaces-pos-login-20261030
export APP_ORIGIN='https://petrifying-spooky-crypt-5gjj5xx9prxjcvv65-3000.app.github.dev'
npm run dev -- --port 3000
```

If the phone currently uses a different Codespaces hostname, use **that exact HTTPS origin** instead. Do not append `/pos/login` or another path. An explicit command environment takes precedence over `.env`, `.env.local` and mode-specific environment files. Restarting alone cannot correct an exported setting that overrides an edited file. For future restarts, keep the same correct value in the privately managed server environment. Do not commit `.env`.

If this Codespace uses `next start`, replace the last command with:

```bash
npm run build
npm run start -- --port 3000
```

Always use the rebuilt output for `next start`. Verify that the process actually listens on 3000. An old process serving 3000 while a new dev server retries another port can leave the phone on old code. Do not kill unrelated processes, reset accounts or reseed the database. The patch adds no dependencies or migrations. If `git pull --ff-only` reports conflicts or divergence, preserve local work and resolve that before restarting; do not use `git reset --hard`.

For a credential-free origin check, run this from a second terminal (the expected result is HTTP **400** for the empty login body, accompanied by an **accepted** origin diagnostic):

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' \
  http://127.0.0.1:3000/api/auth/login \
  -H 'Origin: https://petrifying-spooky-crypt-5gjj5xx9prxjcvv65-3000.app.github.dev' \
  -H 'Content-Type: application/json' --data '{}'
```

Then open `/pos/login` on the phone and try normal login. Read the `Origin validation:` entry in the server terminal. Do not share full browser headers, passwords, session cookies or network traces.

## Safe diagnostics

Every login origin check logs only canonical HTTP(S) origins, fixed reason codes and boolean header-presence flags. Rejected mutations also log the guard decision. No raw configuration value, raw header, request body, email, password, cookie, token, Referer, query string or exception stack is logged by these diagnostics. Inputs containing credentials, paths, query strings or fragments are represented as `requestOrigin: null` rather than echoed.

The fields are `result`, `reason`, `requestOrigin`, `configuredOrigin`, `acceptedOrigin`, `codespacesOrigin`, `codespacesReason`, `proxyReason`, `hasForwardedHost` and `hasForwardedProto`.

| Field/reason                                                           | Meaning and next step                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `missing_origin` / `opaque_origin` / `invalid_origin`                  | The Origin header is missing, `null`, or not a single valid HTTP(S) origin. No Referer or forwarding-header fallback is permitted.                                                                                                      |
| `origin_not_allowed`                                                   | The normalized request origin matches neither the configured/provider origin nor the narrowly validated proxy-rewrite case. Compare the logged origins; fix stale origin/port configuration instead of adding wildcards.                |
| `invalid_configuration` / `missing_configuration`                      | The running process's `APP_ORIGIN` is invalid or absent; response is 503. No raw setting is logged.                                                                                                                                     |
| `codespacesReason: enabled`                                            | Valid server-owned provider metadata supplied the exact public Codespaces origin.                                                                                                                                                       |
| Other `codespacesReason` values                                        | `not_codespaces`, `invalid_codespace_name`, `unsupported_forwarding_domain` or `invalid_runtime_port` explains why provider-origin derivation was unavailable. An exact explicit `APP_ORIGIN` still works for unchanged browser Origin. |
| `proxyReason: forwarded_host_not_exact_codespace`                      | Rewritten loopback Origin was seen, but X-Forwarded-Host did not match this server's exact known public host. Fail closed.                                                                                                              |
| `proxyReason: fetch_site_not_same_origin` / `fetch_mode_not_supported` | Rewritten loopback recovery lacks the required browser Fetch Metadata. Cross-site, same-site, navigation, no-cors and missing metadata cannot authorize recovery.                                                                       |
| `proxyReason: not_runtime_loopback_origin` / `not_applicable`          | Origin was not the current loopback port, or provider metadata/Origin was unavailable. The normal exact-origin check applies.                                                                                                           |
| `codespaces_origin_rewrite`                                            | Accepted after all proxy-rewrite conditions passed; `acceptedOrigin` is the known public HTTPS origin.                                                                                                                                  |
| `origin_allowed`                                                       | Accepted by exact comparison after origin normalization.                                                                                                                                                                                |

A normal mismatch is 403, not 500. Unexpected post-validation exceptions retain the earlier credential-free `Request failed:` diagnostic with operation `login`, stage (`body`, `throttle`, `user`, `password`, `session`) and restricted machine code. Genuine database/session failures still fail; they cannot produce mock login success.

## Security boundary

- `APP_ORIGIN` supplies one exact trusted origin, with no credentials, path, query or fragment.
- The only additional provider origin is `https://<CODESPACE_NAME>-<PORT>.app.github.dev`, derived from valid **server** environment values `CODESPACES=true`, `CODESPACE_NAME`, `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN=app.github.dev` and Next's actual `PORT`.
- Proxy-rewrite recovery applies only to `http://localhost:<PORT>` or `http://127.0.0.1:<PORT>` at that exact runtime port. It also requires a **single exact** X-Forwarded-Host matching the already known provider host, `Sec-Fetch-Site: same-origin` and `Sec-Fetch-Mode: cors` or `same-origin`. Browsers control these Fetch Metadata headers; cross-site scripts cannot set them. A matching forwarded header by itself never authorizes recovery. Missing/opaque/malformed Origin cannot be recovered.
- Host/Forwarded headers never extend the allowlist; X-Forwarded-Proto cannot choose cookie security. The recovered origin is always the known HTTPS provider origin. This supports TLS termination without trusting an arbitrary proxy origin or adding all loopback/`*.app.github.dev` origins.
- Modern browser Fetch Metadata is required when Origin is rewritten. Older browsers/proxies that omit it fail closed and need their forwarding behavior corrected; there is no permissive compatibility fallback.
- Password verification, database-backed login throttling, hashed-token persistence, role authorization and host-only HttpOnly/SameSite=Lax cookies remain intact. Secure cookies are used in production and for validated public HTTPS origins, including recovery in development.

## Tests and verification limits

Unit regressions cover canonicalization, every origin rejection reason, privacy of diagnostics, Codespaces metadata, loopback recovery, missing/cross-site Fetch Metadata, spoofed/multiple forwarding hosts, sibling ports, missing/null/arbitrary origins and desktop/mobile session behavior. Browser tests use real PostgreSQL and a real production Next server with **public APP_ORIGIN**, at 1440px and 390px, through both Origin-preserving and loopback-rewriting local proxy simulations. A real browser cross-site POST remains blocked even when the proxy rewrites its Origin. The tests verify persistent sessions, Secure cookies, reload, staff reads and logout. No proxy-simulation request goes to GitHub; fixture accounts are removed afterward.

Mobile coverage is Chromium emulation, not an actual phone or iOS Safari. The live phone's exact rejection condition remains unverified until its sanitized diagnostic is collected. No deployment or database migration is performed by this patch.

Final local verification on 2026-10-30: lint, typecheck, production build, all 103 unit tests, 29 PostgreSQL integration tests and all 42 browser tests passed. An earlier interrupted run left one identified test reservation; removing only that run's owned fixture restored the clean full-suite result. No existing staff accounts were reset. Non-failing Vite config-loader, pg deprecation and terminal-color warnings remain outside this patch.
