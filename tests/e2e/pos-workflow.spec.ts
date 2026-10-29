import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { hashPassword, newToken } from "../../src/lib/crypto";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const run = randomUUID();
const password = `POS-${randomUUID()}`;
const email = `pos-browser-${run}@example.test`;
const kitchenEmail = `pos-kitchen-${run}@example.test`;
let userId: string, kitchenId: string, tableId: string, restaurantId: string;
const orderIds: string[] = [];
const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const screenshots = process.env.POS_SCREENSHOT_DIR || "test-results/phase3-pos";
test.beforeAll(async () => {
  await mkdir(screenshots, { recursive: true });
  restaurantId = (
    await db.restaurant.findUniqueOrThrow({ where: { slug: "ember-table" } })
  ).id;
  userId = (
    await db.user.create({
      data: {
        restaurantId,
        email,
        passwordHash: hashPassword(password),
        role: "MANAGER",
        name: "Tablet service manager",
      },
    })
  ).id;
  kitchenId = (
    await db.user.create({
      data: {
        restaurantId,
        email: kitchenEmail,
        passwordHash: hashPassword(password),
        role: "KITCHEN",
        name: "Tablet kitchen team",
      },
    })
  ).id;
  tableId = (
    await db.table.create({
      data: {
        restaurantId,
        label: `QA-${run.slice(0, 4).toUpperCase()}`,
        seats: 4,
      },
    })
  ).id;
});
test.afterAll(async () => {
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  if (tableId) await db.table.delete({ where: { id: tableId } });
  await db.user.deleteMany({
    where: { id: { in: [userId, kitchenId].filter(Boolean) } },
  });
  await db.$disconnect();
});
test("tablet staff order reaches kitchen, releases table on cash completion and produces a paid receipt", async ({
  page,
  browser,
}) => {
  const pageErrors: string[] = [];
  const warnings: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error") warnings.push(m.text());
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/pos/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open the kitchen" }).click();
  await expect(
    page.getByRole("heading", { name: "Incoming orders" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "New order", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();
  await page.getByRole("button", { name: /From the fire/ }).click();
  await expect(page.locator(".pos-food-card")).toHaveCount(3);
  await page.getByRole("textbox", { name: "Search POS menu" }).fill("chicken");
  await expect(page.locator(".pos-food-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search POS menu" }).fill("");
  await page
    .getByRole("button", { name: "Add Fire-roasted chicken to POS order" })
    .click();
  await page
    .getByRole("button", { name: "Add The ember beef bowl to POS order" })
    .click();
  await page
    .getByRole("combobox", { name: "Select table" })
    .selectOption(tableId);
  await page
    .getByRole("textbox", { name: "Guest name" })
    .fill("Tablet sample guests");
  await page
    .getByRole("textbox", { name: "Kitchen note" })
    .fill("Sample check — no special requests.");
  await page.screenshot({
    path: `${screenshots}/pos-order-entry-1280x800.png`,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1280,
  );
  await page.getByRole("button", { name: "Send to kitchen" }).click();
  await expect(page).toHaveURL(/\/pos\/orders\?order=/);
  const id = new URL(page.url()).searchParams.get("order")!;
  orderIds.push(id);
  await expect(
    page.getByRole("button", { name: "Start preparing", exact: true }),
  ).toBeVisible();
  const saved = await db.order.findUniqueOrThrow({ where: { id } });
  expect(saved.total).toBe(147000);
  expect(saved.source).toBe("STAFF");
  expect(saved.tableId).toBe(tableId);
  // Add a real online sample order through the unchanged customer endpoint.
  const chicken = await db.menuItem.findUniqueOrThrow({
    where: { slug: "fire-roasted-chicken" },
  });
  const online = await page.request.post("/api/orders", {
    headers: { Origin: origin },
    data: {
      customerName: "Tablet online sample",
      phone: "01700000000",
      fulfillment: "PICKUP",
      address: "",
      items: [{ menuItemId: chicken.id, quantity: 1 }],
      idempotencyKey: randomUUID(),
      trackingToken: newToken(),
    },
  });
  expect(online.status()).toBe(201);
  const onlineId = (await online.json()).id;
  orderIds.push(onlineId);
  await page.getByRole("textbox", { name: "Search orders" }).fill("Tablet");
  await expect(page.getByText("Online order", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/Staff order/)).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/pos-incoming-orders-1280x800.png`,
  });
  const cookContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const cook = await cookContext.newPage();
  await cook.goto("/pos/login");
  await cook.getByLabel("Email").fill(kitchenEmail);
  await cook.getByLabel("Password", { exact: true }).fill(password);
  await cook.getByRole("button", { name: "Open the kitchen" }).click();
  await expect(
    cook.getByRole("heading", { name: "Incoming orders" }),
  ).toBeVisible();
  await expect(
    cook.getByRole("link", { name: "New order", exact: true }),
  ).toHaveCount(0);
  await cook.goto(`/pos/kitchen?order=${id}`);
  await cook.getByRole("textbox", { name: "Search orders" }).fill("Tablet");
  await cook
    .getByRole("button", { name: "Start preparing", exact: true })
    .click();
  await expect(
    cook.getByRole("button", { name: "Mark ready", exact: true }),
  ).toBeVisible();
  await cook.screenshot({ path: `${screenshots}/pos-kitchen-1280x800.png` });
  await cook.getByRole("button", { name: "Mark ready", exact: true }).click();
  await cookContext.close();
  await expect(
    page.getByRole("button", { name: "Complete order", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("button", { name: "Complete order", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Tables", exact: true }).click();
  await expect(
    page.locator(".floor-table").filter({ hasText: "Tablet sample guests" }),
  ).toBeVisible();
  await page.screenshot({ path: `${screenshots}/pos-tables-1280x800.png` });
  await page.goto(`/pos/orders?order=${id}`);
  await page.getByLabel(/I have collected/).check();
  await page
    .getByRole("button", { name: "Complete order", exact: true })
    .click();
  await expect(page.getByText("Cash · paid")).toBeVisible();
  await page.getByRole("link", { name: "View receipt / order ticket" }).click();
  await expect(
    page.getByText("PAID · Cash collected", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/pos-cash-receipt-1280x800.png`,
  });
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: `${screenshots}/receipt-print-layout.png`,
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  const tableResponse = await page.request.get("/api/pos/tables");
  expect(
    (await tableResponse.json()).find((t: { id: string }) => t.id === tableId)
      .orders,
  ).toHaveLength(0);
  await page.getByRole("link", { name: "Manage", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Restaurant management" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/pos-menu-management-1280x800.png`,
  });
  for (const [width, height] of [
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/pos");
    await page
      .getByRole("button", { name: "Add Fire-roasted chicken to POS order" })
      .waitFor();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await writeFile(
    `${screenshots}/browser-diagnostics.json`,
    JSON.stringify(
      {
        viewport: { width: 1280, height: 800 },
        pageErrors,
        warnings,
        responsiveWidthsChecked: [1280, 768, 390],
        referenceAccessible: false,
      },
      null,
      2,
    ),
  );
  expect(pageErrors).toEqual([]);
});
test("POS HTTP permissions and table conflict protect against direct requests", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/pos/orders", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(401);
  expect((await request.get("/api/pos/tables")).status()).toBe(401);
  expect((await request.get("/api/pos/menu")).status()).toBe(401);
  await request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { email: kitchenEmail, password },
  });
  expect(
    (
      await request.post("/api/pos/orders", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/pos/orders/unknown/receipt")).status()).toBe(
    403,
  );
  await request.post("/api/auth/logout", { headers: { Origin: origin } });
  await request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { email, password },
  });
  const item = await db.menuItem.findUniqueOrThrow({
    where: { slug: "fire-roasted-chicken" },
  });
  const data = {
    fulfillment: "DINE_IN",
    tableId,
    items: [{ menuItemId: item.id, quantity: 1 }],
    idempotencyKey: randomUUID(),
  };
  const a = await request.post("/api/pos/orders", {
    headers: { Origin: origin },
    data,
  });
  expect(a.status()).toBe(201);
  const id = (await a.json()).id;
  orderIds.push(id);
  const b = await request.post("/api/pos/orders", {
    headers: { Origin: origin },
    data,
  });
  expect((await b.json()).id).toBe(id);
  expect(
    (
      await request.post("/api/pos/orders", {
        headers: { Origin: origin },
        data: { ...data, idempotencyKey: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post("/api/pos/orders", {
        headers: { Origin: "https://attacker.test" },
        data,
      })
    ).status(),
  ).toBe(403);
  expect((await request.get(`/api/pos/orders/${id}/receipt`)).status()).toBe(
    200,
  );
});
