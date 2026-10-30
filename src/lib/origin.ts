import { HttpError } from "./errors";

/** Trust server configuration only, never a client-supplied Host/Forwarded header. */
export function allowedRequestOrigins(): Set<string> {
  const configured = process.env.APP_ORIGIN?.trim();
  if (!configured) throw new HttpError(503, "Server origin is not configured.");

  let app: URL;
  try {
    app = new URL(configured);
    if (
      !["http:", "https:"].includes(app.protocol) ||
      app.username ||
      app.password ||
      app.pathname !== "/" ||
      app.search ||
      app.hash
    )
      throw new Error("Invalid origin configuration");
  } catch {
    // Do not echo configuration values, which could contain credentials.
    throw new HttpError(503, "Server origin configuration is invalid.");
  }

  const origins = new Set([app.origin]);
  const name = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  // Next sets PORT to its actual listening port for both next dev and next start.
  const port = process.env.PORT;
  if (
    process.env.CODESPACES === "true" &&
    name &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) &&
    domain === "app.github.dev" &&
    port &&
    /^[1-9]\d{0,4}$/.test(port) &&
    Number(port) <= 65535
  ) {
    origins.add(`https://${name}-${port}.${domain}`);
  }
  return origins;
}
