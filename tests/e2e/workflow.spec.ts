import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../../src/lib/crypto";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const email = `browser-${randomUUID()}@example.test`;
const password = `Browser-${randomUUID()}`;
let userId: string;
const extraUserIds: string[] = [];
const orderIds: string[] = [];
test.beforeAll(async () => {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { slug: "ember-table" },
  });
  const user = await db.user.create({
    data: {
      restaurantId: restaurant.id,
      email,
      name: "Browser test administrator",
      passwordHash: hashPassword(password),
      role: "ADMIN",
    },
  });
  userId = user.id;
});
test.afterAll(async () => {
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.user.deleteMany({ where: { id: { in: extraUserIds } } });
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});
test("customer checkout reaches POS, staff prepares and collects cash, tracking updates live", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Made by fire. Shared with love." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore the menu" }).first().click();
  await page
    .getByRole("button", { name: "Add Fire-roasted chicken to bag" })
    .click();
  await page.getByRole("link", { name: "Bag, 1 items" }).click();
  await expect(
    page.getByRole("heading", { name: "Fire-roasted chicken" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "To checkout" }).click();
  await page.getByLabel("Your name").fill("Browser sample guest");
  await page.getByLabel("Phone number").fill("01700000000");
  await page.getByLabel("Delivery address").fill("Sample address 123, Dhaka");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  orderIds.push(id);
  await expect(
    page.getByRole("heading", { name: "Order received" }),
  ).toBeVisible();
  await expect(page.getByText("Payment pending")).toBeVisible();
  const persisted = await db.order.findUniqueOrThrow({ where: { id } });
  expect(persisted.total).toBe(74000);
  const staff = await browser.newContext();
  const pos = await staff.newPage();
  await pos.goto("/pos/orders");
  await expect(pos).toHaveURL(/\/pos\/login/);
  await pos.getByLabel("Email").fill(email);
  await pos.getByLabel("Password", { exact: true }).fill(password);
  await pos.getByRole("button", { name: "Open the kitchen" }).click();
  await expect(
    pos.getByRole("heading", { name: "Incoming orders" }),
  ).toBeVisible();
  await pos
    .getByRole("button")
    .filter({ hasText: `#${id.slice(-6).toUpperCase()}` })
    .click();
  for (const action of [
    "Accept order",
    "Start preparing",
    "Mark ready",
    "Send for delivery",
  ])
    await pos.getByRole("button", { name: action, exact: true }).click();
  await pos.getByLabel(/I have collected/).check();
  await pos
    .getByRole("button", { name: "Complete order", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Served with love" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Collected by staff/)).toBeVisible();
  const complete = await db.order.findUniqueOrThrow({
    where: { id },
    include: { payment: true },
  });
  expect(complete.status).toBe("COMPLETED");
  expect(complete.payment?.status).toBe("PAID");
  await pos.getByRole("button", { name: "Sign out" }).click();
  await expect(pos).toHaveURL(/\/pos\/login/);
  await staff.close();
});
test("HTTP authorization, origin checks, and private tracking are enforced", async ({
  request,
}) => {
  expect((await request.get("/api/pos/orders")).status()).toBe(401);
  expect((await request.get("/api/pos/stream")).status()).toBe(401);
  expect(
    (
      await request.patch("/api/admin/menu", {
        headers: { Origin: process.env.APP_ORIGIN || "http://localhost:3000" },
        data: { id: "x", price: 1, available: true },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/orders", {
        headers: { Origin: "https://attacker.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/orders/missing")).status()).toBe(404);
  expect((await request.get("/api/orders/missing/stream")).status()).toBe(404);
});
test("mobile navigation, detail page, and reduced-motion layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "The menu", exact: true }).click();
  await page
    .getByRole("link", { name: "Fire-roasted chicken", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fire-roasted chicken" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-detail.png",
    fullPage: true,
  });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
});

test("admin edits are persisted, kitchen authorization is enforced, and expired sessions fail", async ({
  request,
}) => {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  const cookies = (await request.storageState()).cookies;
  const session = cookies.find((c) => c.name === "ember_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  const item = await db.menuItem.findFirstOrThrow();
  try {
    expect(
      (
        await request.patch("/api/admin/menu", {
          headers: { Origin: origin },
          data: { id: item.id, price: item.price + 100, available: false },
        })
      ).status(),
    ).toBe(200);
    const saved = await db.menuItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(saved.price).toBe(item.price + 100);
    expect(saved.available).toBe(false);
  } finally {
    await db.menuItem.update({
      where: { id: item.id },
      data: { price: item.price, available: item.available },
    });
  }
  const kitchenEmail = `kitchen-${randomUUID()}@example.test`;
  const kitchenPassword = randomUUID();
  expect(
    (
      await request.post("/api/admin/staff", {
        headers: { Origin: origin },
        data: {
          name: "Sample kitchen tester",
          email: kitchenEmail,
          password: kitchenPassword,
          role: "KITCHEN",
        },
      })
    ).status(),
  ).toBe(201);
  const kitchen = await db.user.findUniqueOrThrow({
    where: { email: kitchenEmail },
  });
  extraUserIds.push(kitchen.id);
  await request.post("/api/auth/logout", { headers: { Origin: origin } });
  expect((await request.get("/api/pos/orders")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { email: kitchenEmail, password: kitchenPassword },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.patch("/api/admin/menu", {
        headers: { Origin: origin },
        data: { id: item.id, price: item.price, available: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/admin/staff", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await db.session.updateMany({
    where: { userId: kitchen.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  expect((await request.get("/api/pos/orders")).status()).toBe(401);
});
