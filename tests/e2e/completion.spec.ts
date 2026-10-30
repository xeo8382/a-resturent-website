import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { hashPassword } from "../../src/lib/crypto";
import { businessSchema } from "../../src/lib/business-config";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const output = process.env.COMPLETION_ARTIFACT_DIR || "test-results/completion";
const run = randomUUID(),
  password = randomUUID();
const emails = {
  ADMIN: `qa-admin-${run}@example.test`,
  KITCHEN: `qa-kitchen-${run}@example.test`,
  STAFF: `qa-service-${run}@example.test`,
};
const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const config = businessSchema.parse({
  legalName: "Automated QA operator",
  address: "Automated QA venue — not a real restaurant address",
  phone: "01700000000",
  timeZone: "UTC",
  hours: Array.from({ length: 7 }, (_, day) => ({
    day,
    opens: "09:00",
    closes: "22:00",
  })),
  reservationsEnabled: true,
  maxPartySize: 50,
  leadMinutes: 0,
  earlySeatingMinutes: 60,
});
let restaurantId: string, tableId: string;
let original: {
  businessSettings: unknown;
  businessVersion: number;
  deliveryFee: number;
};
const userIds: string[] = [],
  bookingIds: string[] = [],
  orderIds: string[] = [];
async function configure() {
  await db.restaurant.update({
    where: { id: restaurantId },
    data: { businessSettings: config },
  });
}
async function login(
  request: APIRequestContext,
  role: keyof typeof emails = "ADMIN",
) {
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { email: emails[role], password },
      })
    ).status(),
  ).toBe(200);
}
async function fillBooking(page: Page, name: string, time: string) {
  await page.getByLabel("Guests", { exact: true }).fill("40");
  await page.getByLabel("Date", { exact: true }).fill(date);
  await page.getByLabel("Time", { exact: false }).selectOption(time);
  await page.getByLabel("Customer name").fill(name);
  await page.getByLabel("Phone", { exact: true }).fill("01700000000");
  await page.getByLabel("Email", { exact: false }).fill("guest@example.test");
  await page
    .getByLabel("Notes", { exact: false })
    .fill("Automated QA fixture. No real booking or notifications.");
}
test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  const r = await db.restaurant.findUniqueOrThrow({
    where: { slug: "ember-table" },
  });
  restaurantId = r.id;
  original = {
    businessSettings: r.businessSettings,
    businessVersion: r.businessVersion,
    deliveryFee: r.deliveryFee,
  };
  for (const role of ["ADMIN", "KITCHEN", "STAFF"] as const)
    userIds.push(
      (
        await db.user.create({
          data: {
            restaurantId,
            role,
            email: emails[role],
            name: `QA ${role}`,
            passwordHash: hashPassword(password),
          },
        })
      ).id,
    );
  tableId = (
    await db.table.create({
      data: { restaurantId, seats: 50, label: `QA-${run.slice(0, 8)}` },
    })
  ).id;
});
test.afterAll(async () => {
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.reservation.deleteMany({ where: { id: { in: bookingIds } } });
  if (tableId) await db.table.delete({ where: { id: tableId } });
  if (restaurantId)
    await db.restaurant.update({
      where: { id: restaurantId },
      data: {
        businessSettings:
          original.businessSettings === null
            ? Prisma.DbNull
            : (original.businessSettings as Prisma.InputJsonValue),
        businessVersion: original.businessVersion,
        deliveryFee: original.deliveryFee,
      },
    });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

test("public desktop/mobile links lead to real pages, hide staff links and retain noindex with unconfigured bookings closed", async ({
  page,
}) => {
  await db.restaurant.update({
    where: { id: restaurantId },
    data: { businessSettings: {} },
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto("/");
    if (width === 390)
      await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Find your table" })
      .click();
    await expect(page).toHaveURL(/\/reservations$/);
    await expect(
      page.getByText("Reservations are not open yet.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm reservation" }),
    ).toBeDisabled();
    await expect(page.locator(".customer-route")).toHaveCSS("opacity", "1");
    await expect(page.locator(".reservation-intro")).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: `${output}/reservations-unconfigured-${width}.png`,
      fullPage: true,
    });
    for (const path of [
      "/reservations",
      "/menu",
      "/cart",
      "/checkout",
      "/contact",
      "/privacy",
      "/terms",
    ]) {
      await page.goto(path);
      await expect(
        page.locator('a[href^="/pos"],a[href^="/admin"]'),
      ).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
    }
    await page.goto("/contact");
    await expect(
      page.getByText("Address not configured.", { exact: false }),
    ).toBeVisible();
    await expect(page.locator(".customer-route")).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: `${output}/contact-unconfigured-${width}.png`,
      fullPage: true,
    });
  }
});

test("authenticated operator can save real operating configuration and table capacity through the staff UI", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/pos/login");
  await page.getByLabel("Email", { exact: true }).fill(emails.ADMIN);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open the kitchen" }).click();
  await page.getByRole("link", { name: "Business", exact: true }).click();
  await page
    .getByLabel("Restaurant address", { exact: true })
    .fill(config.address);
  await page.getByLabel("Contact phone", { exact: true }).fill(config.phone);
  await page.getByLabel("Legal operator name").fill(config.legalName);
  await page
    .getByLabel("Restaurant timezone (IANA)", { exact: true })
    .fill("UTC");
  for (const day of [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]) {
    const group = page.getByRole("group", { name: day, exact: true });
    await group.getByLabel("Closed", { exact: true }).uncheck();
    await group.getByLabel(`${day} opens`).fill("09:00");
    await group.getByLabel(`${day} closes`).fill("22:00");
  }
  await page.getByLabel("Maximum online party size").fill("50");
  await page.getByLabel("Minimum booking lead time (minutes)").fill("0");
  await page.getByLabel("Allow seating early by (minutes)").fill("60");
  await page.getByLabel("Open online reservations").check();
  await page.getByRole("button", { name: "Save business settings" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Business configuration saved" }),
  ).toBeVisible();
  expect(
    (await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId } }))
      .businessSettings,
  ).toMatchObject({ reservationsEnabled: true, timeZone: "UTC" });
  const tableForm = page.locator(".table-settings form").filter({
    has: page.locator(`input[name="label"][value="QA-${run.slice(0, 8)}"]`),
  });
  await tableForm.getByLabel("Seats", { exact: true }).fill("45");
  await tableForm.getByRole("button", { name: "Save table" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Table saved" }),
  ).toBeVisible();
  expect(
    (await db.table.findUniqueOrThrow({ where: { id: tableId } })).seats,
  ).toBe(45);
  await page.screenshot({
    path: `${output}/staff-business-1280.png`,
    fullPage: true,
  });
});

test("desktop booking persists before confirmation and service staff cancellation updates the private link", async ({
  page,
  browser,
}) => {
  await configure();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/reservations");
  await fillBooking(page, "QA Reservation desktop", "18:00");
  await page.screenshot({
    path: `${output}/reservation-form-1440.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page).toHaveURL(/\/reservations\/[^/#]+#/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  bookingIds.push(id);
  await expect(
    page.getByRole("heading", { name: "Your table is confirmed." }),
  ).toBeVisible();
  expect(
    await db.reservation.findUniqueOrThrow({ where: { id } }),
  ).toMatchObject({
    status: "CONFIRMED",
    tableId,
    name: "QA Reservation desktop",
    email: "guest@example.test",
  });
  await expect(
    page.getByText("No email or SMS was sent.", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: `${output}/reservation-confirmation-1440.png`,
    fullPage: true,
  });
  const staff = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1280, height: 800 },
  });
  await login(staff.request, "STAFF");
  const pos = await staff.newPage();
  await pos.goto("/pos/reservations");
  await pos.getByLabel("Booking date").fill(date);
  const card = pos
    .locator(".staff-reservation-card")
    .filter({ hasText: "QA Reservation desktop" });
  await expect(card).toBeVisible();
  await pos.screenshot({
    path: `${output}/staff-reservations-1280.png`,
    fullPage: true,
  });
  await card.getByRole("button", { name: "Cancel booking" }).click();
  await expect(card.getByText("CANCELLED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(
    page.getByRole("heading", { name: "Reservation cancelled" }),
  ).toBeVisible();
  await staff.close();
});

test("mobile slow-network booking waits for real availability and persistence", async ({
  page,
}) => {
  await configure();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/reservations/availability?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue().catch(() => {});
  });
  let key = "";
  await page.route("**/api/reservations", async (route) => {
    key = route.request().postDataJSON().idempotencyKey;
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await route.continue();
  });
  await page.goto("/reservations");
  await page.getByLabel("Guests", { exact: true }).fill("40");
  await page.getByLabel("Date", { exact: true }).fill(date);
  await expect(page.getByText("Checking tables for your party…")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm reservation" }),
  ).toBeDisabled();
  await page.getByLabel("Time", { exact: false }).selectOption("19:30");
  await page.getByLabel("Customer name").fill("QA Reservation mobile");
  await page.getByLabel("Phone", { exact: true }).fill("01700000000");
  expect(
    (await page.getByLabel("Phone", { exact: true }).boundingBox())!.width,
  ).toBeGreaterThan(250);
  await page.screenshot({
    path: `${output}/reservation-form-390.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(
    page.getByRole("button", { name: "Saving reservation…" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Your table is confirmed." }),
  ).toHaveCount(0);
  expect(
    await db.reservation.count({
      where: { idempotencyKey: key || "not-yet-requested" },
    }),
  ).toBe(0);
  await expect(page).toHaveURL(/\/reservations\/[^/#]+#/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  bookingIds.push(id);
  await expect(
    page.getByRole("heading", { name: "Your table is confirmed." }),
  ).toBeVisible();
  expect(
    (await db.reservation.findUniqueOrThrow({ where: { id } })).status,
  ).toBe("CONFIRMED");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: `${output}/reservation-confirmation-390.png`,
    fullPage: true,
  });
});

test("a lost success response recovers the persisted reservation without allocating a second table", async ({
  page,
}) => {
  await configure();
  let requests = 0,
    key = "";
  await page.route("**/api/reservations", async (route) => {
    requests++;
    key = route.request().postDataJSON().idempotencyKey;
    if (requests === 1) {
      const saved = await route.fetch();
      expect(saved.status()).toBe(201);
      bookingIds.push((await saved.json()).id);
      await route.abort("connectionreset");
    } else await route.continue();
  });
  await page.goto("/reservations");
  await fillBooking(page, "QA lost response guest", "11:00");
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page).toHaveURL(/\/reservations\/[^/#]+#/, { timeout: 5000 });
  await expect(
    page.getByRole("heading", { name: "Your table is confirmed." }),
  ).toBeVisible();
  expect(requests).toBe(2);
  expect(await db.reservation.count({ where: { idempotencyKey: key } })).toBe(
    1,
  );
});

test("reservation and business APIs enforce authentication, role permissions, origin checks and private confirmation tokens", async ({
  request,
}) => {
  expect((await request.get("/api/pos/reservations")).status()).toBe(401);
  expect((await request.get("/api/admin/business")).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin/tables", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.patch("/api/pos/reservations/missing", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/reservations", {
        headers: { Origin: "https://wrong-origin.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get(`/api/reservations/${bookingIds[0] || "missing"}`)
    ).status(),
  ).toBe(404);
  await login(request, "KITCHEN");
  expect((await request.get("/api/pos/reservations")).status()).toBe(403);
  expect((await request.get("/api/admin/business")).status()).toBe(403);
  expect(
    (
      await request.patch("/api/pos/reservations/missing", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/auth/logout", { headers: { Origin: origin } });
  await login(request, "STAFF");
  expect((await request.get("/api/pos/reservations")).status()).toBe(200);
  expect((await request.get("/api/admin/business")).status()).toBe(403);
});

test("a seated reservation opens its own POS check and completes only after the real order is paid", async ({
  page,
}) => {
  await db.restaurant.update({
    where: { id: restaurantId },
    data: {
      businessSettings: {
        ...config,
        hours: Array.from({ length: 7 }, (_, day) => ({
          day,
          opens: "00:00",
          closes: "23:59",
        })),
        slotMinutes: 5,
        reservationMinutes: 30,
      },
    },
  });
  let start = new Date(Math.ceil((Date.now() + 2 * 60000) / 300000) * 300000);
  if (start.getUTCHours() * 60 + start.getUTCMinutes() > 1409)
    start = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + 1,
      ),
    );
  const bookingDate = start.toISOString().slice(0, 10),
    time = start.toISOString().slice(11, 16);
  const created = await page.request.post("/api/reservations", {
    headers: { Origin: origin },
    data: {
      date: bookingDate,
      time,
      partySize: 40,
      name: "QA seated guest",
      phone: "01700000000",
      idempotencyKey: randomUUID(),
      trackingToken:
        randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id;
  bookingIds.push(id);
  await login(page.request, "STAFF");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/pos/reservations");
  await page.getByLabel("Booking date").fill(bookingDate);
  const card = page
    .locator(".staff-reservation-card")
    .filter({ hasText: "QA seated guest" });
  await card.getByRole("button", { name: "Seat guests" }).click();
  await page.goto("/pos/tables");
  const floor = page
    .locator(".floor-table")
    .filter({ hasText: `QA-${run.slice(0, 8)}` });
  await expect(floor.getByText("Reserved", { exact: true })).toBeVisible();
  const manage = floor.getByRole("link").filter({ hasText: "Manage booking" });
  await expect(manage).toHaveAttribute(
    "href",
    `/pos/reservations?date=${bookingDate}`,
  );
  await manage.click();
  await expect(page.getByLabel("Booking date")).toHaveValue(bookingDate);
  await card.getByRole("link", { name: "Open seated POS check" }).click();
  await expect(page.getByRole("textbox", { name: "Guest name" })).toHaveValue(
    "QA seated guest",
  );
  await page
    .getByRole("button", { name: "Add Fire-roasted chicken to POS order" })
    .click();
  await page.getByRole("button", { name: "Send to kitchen" }).click();
  await expect(page).toHaveURL(/\/pos\/orders\?order=/);
  const orderId = new URL(page.url()).searchParams.get("order")!;
  orderIds.push(orderId);
  expect(
    (await db.order.findUniqueOrThrow({ where: { id: orderId } }))
      .reservationId,
  ).toBe(id);
  for (const action of ["Start preparing", "Mark ready"])
    await page.getByRole("button", { name: action, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Complete order", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(/I have collected/).check();
  await page
    .getByRole("button", { name: "Complete order", exact: true })
    .click();
  await expect(page.getByText("Cash · paid")).toBeVisible();
  expect(
    (await db.reservation.findUniqueOrThrow({ where: { id } })).status,
  ).toBe("COMPLETED");
  await page.screenshot({ path: `${output}/staff-seated-order-1280.png` });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/pos\/login/);
});

test("configured delivery zone and minimum flow through menu/cart/checkout into a real server-priced order", async ({
  page,
  request,
}) => {
  await configure();
  await login(request);
  const current = await (await request.get("/api/admin/business")).json();
  const zoneId = randomUUID();
  expect(
    (
      await request.patch("/api/admin/business", {
        headers: { Origin: origin },
        data: {
          expectedVersion: current.version,
          deliveryFee: current.deliveryFee,
          settings: {
            ...current.settings,
            deliveryMode: "zones",
            deliveryZones: [
              {
                id: zoneId,
                name: "Automated QA delivery area",
                fee: 12300,
                minimum: 100000,
              },
            ],
          },
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/menu");
  await page
    .getByRole("button", { name: "Add Fire-roasted chicken to bag" })
    .click();
  await page.goto("/checkout");
  await page.getByLabel("Delivery zone", { exact: false }).selectOption(zoneId);
  await expect(
    page.getByRole("alert").filter({ hasText: "below the delivery minimum" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Place order" }),
  ).toBeDisabled();
  await page.goto("/cart");
  await page
    .getByRole("button", { name: "Increase Fire-roasted chicken quantity" })
    .click();
  await page.getByRole("link", { name: "To checkout" }).click();
  await page.getByLabel("Delivery zone", { exact: false }).selectOption(zoneId);
  await page.getByLabel("Your name").fill("QA delivery guest");
  await page.getByLabel("Phone number").fill("01700000000");
  await page
    .getByLabel("Delivery address")
    .fill("Automated QA delivery address, not a real order");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  orderIds.push(id);
  expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({
    deliveryFee: 12300,
    total: 148300,
    deliveryZone: "Automated QA delivery area",
  });
  await expect(page.getByText("Payment pending")).toBeVisible();
});

test("slow menu and failed availability show loading/error states and recover without fabricated success", async ({
  page,
}) => {
  await configure();
  await page.route("**/api/menu", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await page.goto("/menu");
  await expect(
    page.getByRole("status").filter({ hasText: "Warming up the menu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Fire-roasted chicken to bag" }),
  ).toBeVisible();
  let fail = true;
  await page.route("**/api/reservations/availability?*", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Availability temporarily unavailable.",
        }),
      });
    } else await route.continue();
  });
  await page.goto("/reservations");
  await page.getByLabel("Guests", { exact: true }).fill("40");
  await page.getByLabel("Date", { exact: true }).fill(date);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Availability temporarily unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm reservation" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retry availability" }).click();
  await page.getByLabel("Time", { exact: false }).selectOption("09:00");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Availability temporarily unavailable" }),
  ).toHaveCount(0);
});
