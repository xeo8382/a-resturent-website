import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkOrigin, errorResponse } from "../src/lib/http";
import { digest, hashPassword } from "../src/lib/crypto";
import { createSession } from "../src/lib/auth";
import { POST } from "../src/app/api/auth/login/route";

const mocks = vi.hoisted(() => ({
  throttleDelete: vi.fn(),
  throttleUpsert: vi.fn(),
  userFind: vi.fn(),
  sessionCreate: vi.fn(),
  cookieSet: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({
  db: {
    loginThrottle: {
      deleteMany: mocks.throttleDelete,
      upsert: mocks.throttleUpsert,
    },
    user: { findUnique: mocks.userFind },
    session: { create: mocks.sessionCreate },
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));

const publicOrigin =
  "https://petrifying-spooky-crypt-5gjj5xx9prxjcvv65-3000.app.github.dev";
const password = "unit-only-correct-password";
const user = {
  id: "test-user",
  active: true,
  passwordHash: hashPassword(password),
};
function request(
  origin: string | null = "http://localhost:3000",
  extra: Record<string, string> = {},
  body = { email: "staff@example.test", password },
) {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin === null ? {} : { origin }),
      ...extra,
    },
    body: JSON.stringify(body),
  });
}
function codespaces() {
  vi.stubEnv("CODESPACES", "true");
  vi.stubEnv("CODESPACE_NAME", "petrifying-spooky-crypt-5gjj5xx9prxjcvv65");
  vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev");
  vi.stubEnv("PORT", "3000");
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubEnv("CODESPACES", undefined);
  vi.stubEnv("CODESPACE_NAME", undefined);
  vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", undefined);
  vi.stubEnv("PORT", undefined);
  vi.stubEnv("NODE_ENV", "test");
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.throttleDelete.mockResolvedValue({ count: 0 });
  mocks.throttleUpsert.mockResolvedValue({ attempts: 1 });
  mocks.userFind.mockResolvedValue(user);
  mocks.sessionCreate.mockResolvedValue({});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("exact origin policy behind the Codespaces HTTPS proxy", () => {
  it("keeps configured desktop login and accepts only this Codespace's actual forwarded port", () => {
    codespaces();
    expect(checkOrigin(request())).toBe("http://localhost:3000");
    expect(
      checkOrigin(
        request(publicOrigin, {
          "x-forwarded-proto": "https",
          "x-forwarded-host": new URL(publicOrigin).host,
        }),
      ),
    ).toBe(publicOrigin);
  });
  it.each([
    null,
    "null",
    "https://attacker.test",
    "https://other-3000.app.github.dev",
    publicOrigin.replace("-3000.", "-3001."),
    `${publicOrigin}.attacker.test`,
  ])(
    "rejects untrusted Origin %s despite matching spoofed proxy headers",
    (origin) => {
      codespaces();
      expect(() =>
        checkOrigin(
          request(origin, {
            host: "attacker.test",
            "x-forwarded-host": origin || "attacker.test",
            "x-forwarded-proto": "https",
            forwarded: `host=${origin};proto=https`,
          }),
        ),
      ).toThrow("Invalid request origin.");
    },
  );
  it.each([
    `${publicOrigin}/`,
    `${publicOrigin}:443`,
    `${publicOrigin}:443/`,
    publicOrigin.toUpperCase(),
  ])(
    "normalizes the same trusted HTTPS origin %s without adding an origin",
    async (origin) => {
      codespaces();
      expect(checkOrigin(request(origin))).toBe(publicOrigin);
      expect((await POST(request(origin))).status).toBe(200);
      expect(mocks.cookieSet.mock.calls[0][2].secure).toBe(true);
    },
  );
  it.each([
    [null, "missing_origin"],
    ["null", "opaque_origin"],
    ["https://attacker.test", "origin_not_allowed"],
    ["https://staff:private-password@example.test", "invalid_origin"],
    [`${publicOrigin}/path?token=private-token`, "invalid_origin"],
    [`${publicOrigin}, https://attacker.test`, "invalid_origin"],
    [`${publicOrigin} https://attacker.test`, "invalid_origin"],
    [publicOrigin.replace("https:", "http:"), "origin_not_allowed"],
  ])(
    "diagnoses rejection %s as %s before touching the database",
    async (origin, reason) => {
      codespaces();
      const response = await POST(
        request(origin, {
          cookie: "ember_session=private-cookie",
          authorization: "Bearer private-token",
          referer: `${publicOrigin}/pos/login?token=private-token`,
          "x-forwarded-host": "private-token@attacker.test",
          forwarded: "private-password",
        }),
      );
      expect(response.status).toBe(403);
      expect(console.warn).toHaveBeenCalledWith(
        "Origin validation:",
        expect.objectContaining({
          operation: "login",
          result: "rejected",
          reason,
          configuredOrigin: "http://localhost:3000",
          codespacesOrigin: publicOrigin,
        }),
      );
      expect(mocks.throttleUpsert).not.toHaveBeenCalled();
      expect(mocks.sessionCreate).not.toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(
        /private-password|private-cookie|private-token|staff@example/,
      );
    },
  );
  it("logs canonical request/configured origins and provider metadata failure without trusting proxy headers", async () => {
    vi.stubEnv("APP_ORIGIN", "HTTP://LOCALHOST:3000/");
    vi.stubEnv("CODESPACES", "true");
    vi.stubEnv("CODESPACE_NAME", "petrifying-spooky-crypt-5gjj5xx9prxjcvv65");
    vi.stubEnv("PORT", "3000");
    expect(
      (
        await POST(
          request(publicOrigin, {
            "x-forwarded-host": new URL(publicOrigin).host,
            "x-forwarded-proto": "https",
          }),
        )
      ).status,
    ).toBe(403);
    expect(console.warn).toHaveBeenCalledWith("Origin validation:", {
      operation: "login",
      result: "rejected",
      reason: "origin_not_allowed",
      requestOrigin: publicOrigin,
      configuredOrigin: "http://localhost:3000",
      codespacesOrigin: null,
      codespacesReason: "unsupported_forwarding_domain",
      acceptedOrigin: null,
      proxyReason: "not_applicable",
      hasForwardedHost: true,
      hasForwardedProto: true,
    });
  });
  it("logs accepted origin checks without logging successful login credentials", async () => {
    codespaces();
    expect((await POST(request(publicOrigin))).status).toBe(200);
    expect(console.info).toHaveBeenCalledWith(
      "Origin validation:",
      expect.objectContaining({
        result: "accepted",
        reason: "origin_allowed",
        requestOrigin: publicOrigin,
        configuredOrigin: "http://localhost:3000",
        codespacesReason: "enabled",
      }),
    );
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      password,
    );
  });
  it.each(["localhost", "127.0.0.1"])(
    "recovers Codespaces-rewritten %s Origin only for a proven same-origin fetch",
    async (host) => {
      codespaces();
      vi.stubEnv("APP_ORIGIN", publicOrigin);
      const response = await POST(
        request(`http://${host}:3000`, {
          "x-forwarded-host": new URL(publicOrigin).host,
          "x-forwarded-proto": "http", // not used to determine public origin or cookie security
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
        }),
      );
      expect(response.status).toBe(200);
      expect(mocks.cookieSet.mock.calls[0][2].secure).toBe(true);
      expect(console.info).toHaveBeenCalledWith(
        "Origin validation:",
        expect.objectContaining({
          reason: "codespaces_origin_rewrite",
          requestOrigin: `http://${host}:3000`,
          configuredOrigin: publicOrigin,
          acceptedOrigin: publicOrigin,
          proxyReason: "origin_rewritten",
        }),
      );
    },
  );
  it.each([
    ["sec-fetch-site", "cross-site", "fetch_site_not_same_origin"],
    ["sec-fetch-site", "same-site", "fetch_site_not_same_origin"],
    ["sec-fetch-site", "", "fetch_site_not_same_origin"],
    ["sec-fetch-mode", "navigate", "fetch_mode_not_supported"],
    ["sec-fetch-mode", "no-cors", "fetch_mode_not_supported"],
    [
      "x-forwarded-host",
      "attacker-3000.app.github.dev",
      "forwarded_host_not_exact_codespace",
    ],
    [
      "x-forwarded-host",
      `${new URL(publicOrigin).host}, attacker.test`,
      "forwarded_host_not_exact_codespace",
    ],
    ["x-forwarded-host", "", "forwarded_host_not_exact_codespace"],
  ])(
    "rejects rewritten loopback with %s=%s (%s)",
    async (header, value, proxyReason) => {
      codespaces();
      vi.stubEnv("APP_ORIGIN", publicOrigin);
      const response = await POST(
        request("http://localhost:3000", {
          "x-forwarded-host": new URL(publicOrigin).host,
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
          [header]: value,
        }),
      );
      expect(response.status).toBe(403);
      expect(console.warn).toHaveBeenCalledWith(
        "Origin validation:",
        expect.objectContaining({
          result: "rejected",
          reason: "origin_not_allowed",
          proxyReason,
        }),
      );
      expect(mocks.sessionCreate).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    "null",
    "https://attacker.test",
    "http://localhost:3001",
    "http://localhost.attacker.test:3000",
  ])(
    "never substitutes the proxy origin for arbitrary/missing Origin %s",
    async (origin) => {
      codespaces();
      vi.stubEnv("APP_ORIGIN", publicOrigin);
      expect(
        (
          await POST(
            request(origin, {
              "x-forwarded-host": new URL(publicOrigin).host,
              "sec-fetch-site": "same-origin",
              "sec-fetch-mode": "cors",
            }),
          )
        ).status,
      ).toBe(403);
      expect(mocks.sessionCreate).not.toHaveBeenCalled();
    },
  );
  it("does not enable loopback recovery using forwarded headers without provider metadata", async () => {
    vi.stubEnv("APP_ORIGIN", publicOrigin);
    expect(
      (
        await POST(
          request("http://localhost:3000", {
            "x-forwarded-host": new URL(publicOrigin).host,
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "cors",
          }),
        )
      ).status,
    ).toBe(403);
  });
  it("does not trust forwarded headers without server-owned Codespaces metadata", () => {
    expect(() =>
      checkOrigin(
        request(publicOrigin, {
          "x-forwarded-host": new URL(publicOrigin).host,
        }),
      ),
    ).toThrow("Invalid request origin.");
  });
  it.each(["0", "65536", "3000.attacker.test", "03000"])(
    "does not derive a host from invalid runtime port %s",
    (port) => {
      codespaces();
      vi.stubEnv("PORT", port);
      expect(() => checkOrigin(request(publicOrigin))).toThrow(
        "Invalid request origin.",
      );
    },
  );
  it("accepts an explicitly configured public HTTPS origin without provider metadata", () => {
    vi.stubEnv("APP_ORIGIN", `${publicOrigin}/`);
    expect(checkOrigin(request(publicOrigin))).toBe(publicOrigin);
  });
  it.each([
    "not a URL",
    "https://staff:secret@example.test",
    "https://example.test/path",
    "https://example.test?token=secret",
    "https://example.test#secret",
    "ftp://example.test",
  ])(
    "returns a controlled 503 for invalid configuration instead of the old URL exception: %s",
    async (configured) => {
      vi.stubEnv("APP_ORIGIN", configured);
      const result = await POST(request());
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({
        error: "Server origin configuration is invalid.",
      });
      expect(mocks.throttleUpsert).not.toHaveBeenCalled();
    },
  );
  it("fails closed when configuration is missing", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    expect((await POST(request())).status).toBe(503);
  });
});

describe("desktop and mobile login persistence and cookies", () => {
  it.each(["desktop", "mobile"])(
    "authenticates %s through the same database-backed path",
    async (device) => {
      codespaces();
      const origin =
        device === "mobile" ? publicOrigin : "http://localhost:3000";
      const result = await POST(
        request(origin, {
          "user-agent":
            device === "mobile"
              ? "Mozilla/5.0 (iPhone)"
              : "Mozilla/5.0 Desktop",
          "x-forwarded-proto": device === "mobile" ? "https" : "http",
        }),
      );
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({ ok: true });
      expect(mocks.throttleUpsert).toHaveBeenCalledOnce();
      expect(mocks.userFind).toHaveBeenCalledWith({
        where: { email: "staff@example.test" },
      });
      const [name, token, options] = mocks.cookieSet.mock.calls[0];
      expect(name).toBe("ember_session");
      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(mocks.sessionCreate).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          tokenHash: digest(token),
          expiresAt: expect.any(Date),
        },
      });
      expect(options).toEqual({
        httpOnly: true,
        secure: device === "mobile",
        sameSite: "lax",
        path: "/",
        maxAge: 28800,
      });
    },
  );
  it("always uses Secure in production, including on an internal HTTP connection", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession(user.id, "http://localhost:3000");
    expect(mocks.cookieSet.mock.calls[0][2].secure).toBe(true);
  });
  it("does not let spoofed X-Forwarded-Proto downgrade an HTTPS cookie", async () => {
    codespaces();
    expect(
      (await POST(request(publicOrigin, { "x-forwarded-proto": "http" })))
        .status,
    ).toBe(200);
    expect(mocks.cookieSet.mock.calls[0][2].secure).toBe(true);
  });
  it.each(["incorrect", "inactive"])(
    "rejects %s credentials without creating a session",
    async (kind) => {
      if (kind === "inactive")
        mocks.userFind.mockResolvedValue({ ...user, active: false });
      const result = await POST(
        request(
          undefined,
          {},
          {
            email: "staff@example.test",
            password: kind === "incorrect" ? "wrong" : password,
          },
        ),
      );
      expect(result.status).toBe(401);
      expect(mocks.sessionCreate).not.toHaveBeenCalled();
      expect(mocks.cookieSet).not.toHaveBeenCalled();
    },
  );
  it("preserves the database login throttle", async () => {
    mocks.throttleUpsert.mockResolvedValue({ attempts: 11 });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it.each(["throttle", "user", "session"])(
    "reports a safe diagnostic at the %s failure without claiming login success",
    async (stage) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const failure = Object.assign(
        new Error("secret database URL and password"),
        { code: "P2021" },
      );
      if (stage === "throttle")
        mocks.throttleUpsert.mockRejectedValueOnce(failure);
      if (stage === "user") mocks.userFind.mockRejectedValueOnce(failure);
      if (stage === "session")
        mocks.sessionCreate.mockRejectedValueOnce(failure);
      const result = await POST(request());
      expect(result.status).toBe(500);
      expect(log).toHaveBeenCalledWith("Request failed:", "Error", {
        operation: "login",
        stage,
        code: "P2021",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
      expect(mocks.cookieSet).not.toHaveBeenCalled();
    },
  );
  it("does not log arbitrary exception codes or messages", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    errorResponse(
      Object.assign(new Error("password"), { code: "postgres://secret" }),
      { operation: "login", stage: "session" },
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /password|postgres:\/\//,
    );
  });
});
