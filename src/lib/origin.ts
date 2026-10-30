import { HttpError } from "./errors";

export type ParsedOrigin = {
  origin: string | null;
  reason: "valid" | "missing_origin" | "opaque_origin" | "invalid_origin";
};

/** Canonicalize only a single HTTP(S) origin, never a URL containing private data. */
export function parseOrigin(value: string | null | undefined): ParsedOrigin {
  const input = value?.trim();
  if (!input) return { origin: null, reason: "missing_origin" };
  if (input === "null") return { origin: null, reason: "opaque_origin" };
  if (input.length > 2048 || !/^https?:\/\/[^/?#\\\s,]+\/?$/i.test(input))
    return { origin: null, reason: "invalid_origin" };
  try {
    const url = new URL(input);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return { origin: null, reason: "invalid_origin" };
    return { origin: url.origin, reason: "valid" };
  } catch {
    return { origin: null, reason: "invalid_origin" };
  }
}

/** Trust server configuration only, never a client-supplied Host/Forwarded header. */
export function originPolicy() {
  const configured = process.env.APP_ORIGIN?.trim();
  if (!configured) throw new HttpError(503, "Server origin is not configured.");

  const app = parseOrigin(configured);
  if (!app.origin) {
    // Do not echo configuration values, which could contain credentials.
    throw new HttpError(503, "Server origin configuration is invalid.");
  }

  const origins = new Set([app.origin]);
  const name = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  // Next sets PORT to its actual listening port for both next dev and next start.
  const port = process.env.PORT;
  const codespacesReason =
    process.env.CODESPACES !== "true"
      ? "not_codespaces"
      : !name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
        ? "invalid_codespace_name"
        : domain !== "app.github.dev"
          ? "unsupported_forwarding_domain"
          : !port || !/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535
            ? "invalid_runtime_port"
            : "enabled";
  const codespacesOrigin =
    codespacesReason === "enabled" ? `https://${name}-${port}.${domain}` : null;
  if (codespacesOrigin) origins.add(codespacesOrigin);
  return {
    origins,
    configuredOrigin: app.origin,
    codespacesOrigin,
    codespacesReason,
  };
}

export function allowedRequestOrigins(): Set<string> {
  return originPolicy().origins;
}

/**
 * Codespaces can rewrite the browser's Origin to its HTTP loopback target.
 * Recover only the exact server-owned public origin, with browser Fetch Metadata
 * proving this was a same-origin fetch. A Host/Forwarded header alone is never proof.
 */
export function codespacesProxyDecision(
  request: Request,
  requestOrigin: string | null,
  policy: ReturnType<typeof originPolicy>,
) {
  if (!policy.codespacesOrigin || !requestOrigin)
    return { origin: null, reason: "not_applicable" };
  const port = new URL(policy.codespacesOrigin).hostname.match(
    /-(\d+)\.app\.github\.dev$/,
  )?.[1];
  const loopbacks = [
    new URL(`http://localhost:${port}`).origin,
    new URL(`http://127.0.0.1:${port}`).origin,
  ];
  if (!loopbacks.includes(requestOrigin))
    return { origin: null, reason: "not_runtime_loopback_origin" };
  const expectedHost = new URL(policy.codespacesOrigin).host;
  if (request.headers.get("x-forwarded-host")?.toLowerCase() !== expectedHost)
    return { origin: null, reason: "forwarded_host_not_exact_codespace" };
  if (request.headers.get("sec-fetch-site") !== "same-origin")
    return { origin: null, reason: "fetch_site_not_same_origin" };
  if (
    !["cors", "same-origin"].includes(
      request.headers.get("sec-fetch-mode") ?? "",
    )
  )
    return { origin: null, reason: "fetch_mode_not_supported" };
  return { origin: policy.codespacesOrigin, reason: "origin_rewritten" };
}
