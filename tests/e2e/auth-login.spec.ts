import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { digest, hashPassword } from "../../src/lib/crypto";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const email = `login-regression-${randomUUID()}@example.test`;
const password = `test-only-${randomUUID()}`;
const localOrigin = process.env.APP_ORIGIN || "http://localhost:3000";
// A second real Next server simulates Codespaces TLS termination. No requests
// are sent to GitHub: Playwright forwards this synthetic HTTPS host locally.
const port = 3321;
const upstream = `http://127.0.0.1:${port}`;
const publicOrigin = `https://ember-login-regression-${port}.app.github.dev`;
let server: ChildProcess | undefined;
let userId: string;

test.beforeAll(async () => {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { slug: "ember-table" },
  });
  userId = (
    await db.user.create({
      data: {
        restaurantId: restaurant.id,
        email,
        name: "Login regression fixture",
        passwordHash: hashPassword(password),
        role: "STAFF",
      },
    })
  ).id;
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_ORIGIN: `http://localhost:${port}`,
        PORT: String(port),
        CODESPACES: "true",
        CODESPACE_NAME: "ember-login-regression",
        GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      },
      stdio: "ignore",
    },
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Local proxy-regression server exited before readiness.");
    try {
      if ((await fetch(`${upstream}/pos/login`)).ok) return;
    } catch {
      /* wait for server */
    }
    await delay(200);
  }
  throw new Error("Local proxy-regression server did not become ready.");
});
test.afterAll(async () => {
  server?.kill("SIGTERM");
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.loginThrottle.deleteMany({ where: { key: digest(email) } });
  await db.$disconnect();
});

for (const proxy of [false, true]) {
  for (const mobile of [false, true]) {
    test(`${proxy ? "Codespaces HTTPS proxy" : "configured desktop origin"}: ${mobile ? "390px mobile" : "1440px desktop"} persists login, authorizes staff and logs out`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: mobile ? 390 : 1440, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
        userAgent: mobile
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
          : undefined,
      });
      const page = await context.newPage();
      const origin = proxy ? publicOrigin : localOrigin;
      if (proxy) {
        await page.route(`${publicOrigin}/**`, async (route) => {
          const incoming = route.request();
          const url = new URL(incoming.url());
          const response = await route.fetch({
            url: `${upstream}${url.pathname}${url.search}`,
            headers: {
              ...incoming.headers(),
              host: `127.0.0.1:${port}`,
              "x-forwarded-host": new URL(publicOrigin).host,
              "x-forwarded-proto": "https",
            },
            maxRedirects: 0,
          });
          await route.fulfill({ response });
        });
      }
      try {
        await page.goto(`${origin}/pos/login`);
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password", { exact: true }).fill(password);
        const login = page.waitForResponse(
          (response) =>
            response.url() === `${origin}/api/auth/login` &&
            response.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Open the kitchen" }).click();
        expect((await login).status()).toBe(200);
        await expect(
          page.getByRole("heading", { name: "Incoming orders" }),
        ).toBeVisible();
        const cookie = (await context.cookies(origin)).find(
          (item) => item.name === "ember_session",
        );
        expect(cookie).toMatchObject({
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
          domain: new URL(origin).hostname,
          path: "/",
        });
        const session = await db.session.findUnique({
          where: { tokenHash: digest(cookie!.value) },
        });
        expect(session?.userId).toBe(userId);
        expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());
        await page.reload();
        await expect(
          page.getByRole("heading", { name: "Incoming orders" }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            async () => (await fetch("/api/pos/orders")).status,
          ),
        ).toBe(200);
        expect(
          await page.evaluate(
            async () =>
              (await fetch("/api/auth/logout", { method: "POST" })).status,
          ),
        ).toBe(200);
        expect(
          await db.session.findUnique({
            where: { tokenHash: digest(cookie!.value) },
          }),
        ).toBeNull();
        expect(
          await page.evaluate(
            async () => (await fetch("/api/pos/orders")).status,
          ),
        ).toBe(401);
      } finally {
        // The POS opens a long-lived SSE request. Stop forwarding callbacks
        // before disposing the context, without treating stream cancellation
        // during teardown as a login failure.
        await page.unrouteAll({ behavior: "ignoreErrors" });
        await context.close();
      }
    });
  }
}

test("public proxy rejects sibling Codespace/port and spoofed forwarding headers before writing any session", async () => {
  const sessions = await db.session.count({ where: { userId } });
  for (const origin of [
    "https://attacker.test",
    publicOrigin.replace("-3321.", "-3322."),
    "https://other-3321.app.github.dev",
  ]) {
    const result = await fetch(`${upstream}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        "x-forwarded-host": new URL(origin).host,
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({ email, password }),
    });
    expect(result.status).toBe(403);
  }
  expect(await db.session.count({ where: { userId } })).toBe(sessions);
});

test("public proxy rejects incorrect passwords with 401 and creates no session", async () => {
  const result = await fetch(`${upstream}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: publicOrigin,
      "x-forwarded-host": new URL(publicOrigin).host,
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({ email, password: "incorrect-test-password" }),
  });
  expect(result.status).toBe(401);
  expect(await db.session.count({ where: { userId } })).toBe(0);
});
