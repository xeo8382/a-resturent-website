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
    `${publicOrigin}/`,
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
