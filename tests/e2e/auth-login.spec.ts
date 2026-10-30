import { test, expect, chromium, type Browser } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createServer, type Server } from "node:https";
import {
  request as upstreamRequest,
  createServer as createTunnelServer,
  type Server as TunnelServer,
} from "node:http";
import { connect as connectLoopback } from "node:net";
import type { Duplex } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { digest, hashPassword } from "../../src/lib/crypto";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const email = `login-regression-${randomUUID()}@example.test`;
const password = `test-only-${randomUUID()}`;
const localOrigin = process.env.APP_ORIGIN || "http://localhost:3000";
const port = 3321;
const upstream = `http://127.0.0.1:${port}`;
const publicOrigin = `https://ember-login-regression-${port}.app.github.dev`;
const publicHost = new URL(publicOrigin).host;
const attacker = "https://attacker.example.test";
let server: ChildProcess | undefined;
let proxyServer: Server | undefined;
let tunnelServer: TunnelServer | undefined;
const tunnelSockets = new Set<Duplex>();
let proxyBrowser: Browser | undefined;
let certificateDirectory: string | undefined;
let rewriteOrigin = false;
let userId: string;
let observedPost:
  | {
      originalOrigin?: string;
      forwardedOrigin?: string;
      fetchSite?: string;
      fetchMode?: string;
    }
  | undefined;

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
        APP_ORIGIN: publicOrigin,
        PORT: String(port),
        CODESPACES: "true",
        CODESPACE_NAME: "ember-login-regression",
        GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      },
      stdio: "ignore",
    },
  );
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Local proxy-regression server exited before readiness.");
    try {
      if ((await fetch(`${upstream}/pos/login`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* wait for server */
    }
    await delay(200);
  }
  if (!ready)
    throw new Error("Local proxy-regression server did not become ready.");

  // A real HTTPS socket is necessary: Playwright route interception occurs
  // before Chromium adds Sec-Fetch-* headers. Synthetic hosts terminate locally.
  certificateDirectory = await mkdtemp(join(tmpdir(), "ember-login-tls-"));
  const keyPath = join(certificateDirectory, "key.pem");
  const certificatePath = join(certificateDirectory, "cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-nodes",
      "-newkey",
      "rsa:2048",
      "-keyout",
      keyPath,
      "-out",
      certificatePath,
      "-subj",
      "/CN=localhost",
      "-days",
      "1",
    ],
    { stdio: "ignore" },
  );
  proxyServer = createServer(
    { key: await readFile(keyPath), cert: await readFile(certificatePath) },
    (incoming, outgoing) => {
      if (incoming.headers.host === new URL(attacker).host) {
        outgoing.writeHead(200, { "content-type": "text/html" });
        outgoing.end("<!doctype html><title>CSRF regression fixture</title>");
        return;
      }
      const headers = {
        ...incoming.headers,
        host: `127.0.0.1:${port}`,
        "x-forwarded-host": publicHost,
        "x-forwarded-proto": "https",
      };
      if (rewriteOrigin && incoming.headers.origin)
        headers.origin = `http://localhost:${port}`;
      if (incoming.method === "POST" && incoming.url === "/api/auth/login") {
        observedPost = {
          originalOrigin: incoming.headers.origin,
          forwardedOrigin: headers.origin,
          fetchSite: incoming.headers["sec-fetch-site"] as string | undefined,
          fetchMode: incoming.headers["sec-fetch-mode"] as string | undefined,
        };
      }
      const proxied = upstreamRequest(
        `${upstream}${incoming.url}`,
        { method: incoming.method, headers },
        (response) => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(outgoing);
          outgoing.once("close", () => response.destroy());
        },
      );
      proxied.on("error", () => {
        if (!outgoing.headersSent) outgoing.writeHead(502);
        outgoing.end();
      });
      outgoing.once("close", () => proxied.destroy());
      incoming.pipe(proxied);
    },
  );
  await new Promise<void>((resolve, reject) => {
    proxyServer!.once("error", reject);
    // Ephemeral loopback ports need no privileged-port permissions.
    proxyServer!.listen(0, "127.0.0.1", resolve);
  });
  const tlsPort = (proxyServer.address() as { port: number }).port;
  tunnelServer = createTunnelServer();
  tunnelServer.on("connect", (request, socket, head) => {
    // Only these synthetic test hosts can tunnel, and both terminate locally.
    // Never forward a CONNECT request to a real external destination.
    if (
      ![`${publicHost}:443`, `${new URL(attacker).host}:443`].includes(
        request.url ?? "",
      )
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    tunnelSockets.add(socket);
    socket.on("close", () => tunnelSockets.delete(socket));
    const target = connectLoopback(tlsPort, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) target.write(head);
      socket.pipe(target);
      target.pipe(socket);
    });
    socket.on("error", () => target.destroy());
    target.on("error", () => socket.destroy());
    socket.on("close", () => target.destroy());
  });
  await new Promise<void>((resolve, reject) => {
    tunnelServer!.once("error", reject);
    tunnelServer!.listen(0, "127.0.0.1", resolve);
  });
  const tunnelPort = (tunnelServer.address() as { port: number }).port;
  proxyBrowser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
    proxy: { server: `http://127.0.0.1:${tunnelPort}` },
  });
});

test.afterAll(async () => {
  await proxyBrowser?.close();
  for (const socket of tunnelSockets) socket.destroy();
  if (tunnelServer?.listening)
    await new Promise<void>((resolve) => tunnelServer!.close(() => resolve()));
  if (proxyServer?.listening) {
    proxyServer.closeAllConnections();
    await new Promise<void>((resolve) => proxyServer!.close(() => resolve()));
  }
  server?.kill("SIGTERM");
  if (certificateDirectory)
    await rm(certificateDirectory, { recursive: true, force: true });
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.loginThrottle.deleteMany({ where: { key: digest(email) } });
  await db.$disconnect();
});

for (const proxy of ["none", "preserved", "rewritten"] as const) {
  for (const mobile of [false, true]) {
    test(`${proxy === "none" ? "configured desktop origin" : `Codespaces HTTPS proxy (${proxy} Origin)`}: ${mobile ? "390px mobile" : "1440px desktop"} persists login, authorizes staff and logs out`, async ({
      browser,
    }) => {
      rewriteOrigin = proxy === "rewritten";
      observedPost = undefined;
      const context = await (
        proxy === "none" ? browser : proxyBrowser!
      ).newContext({
        viewport: { width: mobile ? 390 : 1440, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
        // Trust only the ephemeral test certificate, never production TLS.
        ignoreHTTPSErrors: proxy !== "none",
        userAgent: mobile
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
          : undefined,
      });
      const page = await context.newPage();
      const origin = proxy !== "none" ? publicOrigin : localOrigin;
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
        if (proxy !== "none")
          expect(observedPost).toEqual({
            originalOrigin: publicOrigin,
            forwardedOrigin: rewriteOrigin
              ? `http://localhost:${port}`
              : publicOrigin,
            fetchSite: "same-origin",
            fetchMode: "cors",
          });
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
      "x-forwarded-host": publicHost,
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({ email, password: "incorrect-test-password" }),
  });
  expect(result.status).toBe(401);
  expect(await db.session.count({ where: { userId } })).toBe(0);
});

test("a browser cross-site POST remains forbidden even if a proxy rewrites Origin to loopback", async () => {
  rewriteOrigin = true;
  observedPost = undefined;
  const context = await proxyBrowser!.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  try {
    await page.goto(attacker);
    const response = page.waitForResponse(`${publicOrigin}/api/auth/login`);
    await page.evaluate(
      async ({ url, email, password }) => {
        await fetch(url, {
          method: "POST",
          mode: "no-cors",
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
      },
      { url: `${publicOrigin}/api/auth/login`, email, password },
    );
    expect((await response).status()).toBe(403);
    expect(observedPost).toEqual({
      originalOrigin: attacker,
      forwardedOrigin: `http://localhost:${port}`,
      fetchSite: "cross-site",
      fetchMode: "no-cors",
    });
    expect(await db.session.count({ where: { userId } })).toBe(0);
  } finally {
    await context.close();
  }
});
