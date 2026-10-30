import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import {
  availability,
  createReservation,
  changeReservation,
  privateReservation,
} from "../src/lib/reservations";
import { businessSchema } from "../src/lib/business-config";
import { saveBusiness, saveTable } from "../src/lib/business";
import {
  createStaffOrder,
  posTables,
  type StaffActor,
} from "../src/lib/pos-orders";
import { createOrder, updateStatus } from "../src/lib/orders";
import { newToken } from "../src/lib/crypto";
import { localParts } from "../src/lib/reservation-time";
let restaurantId: string, tableId: string, itemId: string, actor: StaffActor;
let original: { businessSettings: unknown; businessVersion: number };
const orders: string[] = [],
  bookings: string[] = [];
const users: string[] = [];
const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const config = businessSchema.parse({
  timeZone: "UTC",
  hours: Array.from({ length: 7 }, (_, day) => ({
    day,
    opens: "00:00",
    closes: "23:59",
  })),
  reservationsEnabled: true,
  leadMinutes: 0,
  earlySeatingMinutes: 60,
  maxPartySize: 50,
});
const payload = (overrides: Record<string, unknown> = {}) => ({
  date,
  time: "18:00",
  partySize: 40,
  name: "Automated reservation guest",
  phone: "01700000000",
  email: "guest@example.test",
  notes: "Automated fixture, not a real booking",
  idempotencyKey: randomUUID(),
  trackingToken: newToken(),
  ...overrides,
});
async function book(p = payload()) {
  const r = await createReservation(p);
  bookings.push(r.id);
  return r;
}
async function clean() {
  await db.payment.deleteMany({ where: { orderId: { in: orders } } });
  await db.order.deleteMany({ where: { id: { in: orders } } });
  await db.reservation.deleteMany({ where: { id: { in: bookings } } });
  orders.length = 0;
  bookings.length = 0;
}
beforeAll(async () => {
  const r = await db.restaurant.findUniqueOrThrow({
    where: { slug: "ember-table" },
  });
  restaurantId = r.id;
  original = {
    businessSettings: r.businessSettings,
    businessVersion: r.businessVersion,
  };
  await db.restaurant.update({
    where: { id: r.id },
    data: { businessSettings: config },
  });
  tableId = (
    await db.table.create({
      data: {
        restaurantId,
        label: `TEST-${randomUUID().slice(0, 8)}`,
        seats: 50,
      },
    })
  ).id;
  itemId = (
    await db.menuItem.findFirstOrThrow({
      where: { restaurantId, available: true },
    })
  ).id;
  const user = await db.user.create({
    data: {
      restaurantId,
      email: `${randomUUID()}@example.test`,
      name: "Reservation integration manager",
      passwordHash: "unused",
      role: "MANAGER",
    },
  });
  users.push(user.id);
  actor = user;
});
afterEach(async () => {
  await clean();
  await db.restaurant.update({
    where: { id: restaurantId },
    data: { businessSettings: config },
  });
  await db.table.update({
    where: { id: tableId },
    data: { active: true, seats: 50 },
  });
});
afterAll(async () => {
  await clean();
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
      },
    });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
describe("atomic reservations and table allocation", () => {
  it("keeps an overdue seated party occupied until staff explicitly completes it", async () => {
    const held = await db.reservation.create({
      data: {
        restaurantId,
        tableId,
        name: "Overdue seated QA guest",
        phone: "01700000000",
        partySize: 40,
        startsAt: new Date(Date.now() - 120 * 60000),
        endsAt: new Date(Date.now() - 30 * 60000),
        status: "SEATED",
      },
    });
    bookings.push(held.id);
    const secondId = randomUUID();
    bookings.push(secondId);
    await expect(
      db.reservation.create({
        data: {
          id: secondId,
          restaurantId,
          tableId,
          name: "Second seated SQL fixture",
          phone: "01700000000",
          partySize: 40,
          startsAt: new Date(`${date}T18:00:00Z`),
          endsAt: new Date(`${date}T19:30:00Z`),
          status: "SEATED",
        },
      }),
    ).rejects.toThrow();
    expect(
      (await availability(date, 40)).slots.every((slot) => !slot.available),
    ).toBe(true);
    await expect(createReservation(payload())).rejects.toThrow("filled");
    expect(
      (await posTables(restaurantId)).find((table) => table.id === tableId)
        ?.reservationHold?.id,
    ).toBe(held.id);
    await expect(
      createStaffOrder(
        {
          fulfillment: "DINE_IN",
          tableId,
          items: [{ menuItemId: itemId, quantity: 1 }],
          idempotencyKey: randomUUID(),
        },
        actor,
      ),
    ).rejects.toThrow("reserved");
    await changeReservation(
      held.id,
      { expectedStatus: "SEATED", status: "COMPLETED" },
      actor,
    );
    expect(
      (await availability(date, 40)).slots.some((slot) => slot.available),
    ).toBe(true);
  });
  it("persists a confirmed, correctly timed table hold and protects the private confirmation", async () => {
    const p = payload(),
      r = await book(p);
    const stored = await db.reservation.findUniqueOrThrow({
      where: { id: r.id },
    });
    expect(stored.status).toBe("CONFIRMED");
    expect(stored.tableId).toBe(tableId);
    expect(stored.endsAt.getTime() - stored.startsAt.getTime()).toBe(
      90 * 60000,
    );
    expect(stored.trackingTokenHash).not.toBe(p.trackingToken);
    expect((await privateReservation(r.id, p.trackingToken)).name).toBe(p.name);
    await expect(privateReservation(r.id, newToken())).rejects.toThrow(
      "not found",
    );
    await db.restaurant.update({
      where: { id: restaurantId },
      data: { businessSettings: { ...config, timeZone: "Asia/Dhaka" } },
    });
    expect((await privateReservation(r.id, p.trackingToken)).timeZone).toBe(
      "UTC",
    );
  });
  it("concurrent retries create exactly one reservation", async () => {
    const p = payload();
    const [a, b] = await Promise.all([book(p), book(p)]);
    expect(a.id).toBe(b.id);
    expect(
      await db.reservation.count({
        where: { idempotencyKey: p.idempotencyKey },
      }),
    ).toBe(1);
    await expect(createReservation({ ...p, name: "Changed" })).rejects.toThrow(
      "already been used",
    );
  });
  it("concurrent distinct bookings cannot double-book the only fitting table", async () => {
    const result = await Promise.allSettled([book(), book()]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("rejects partial overlaps but permits adjacent windows", async () => {
    await book();
    await expect(createReservation(payload({ time: "19:00" }))).rejects.toThrow(
      "filled",
    );
    await book(payload({ time: "19:30" }));
    const a = await availability(date, 40);
    expect(a.slots.find((s) => s.time === "18:00")?.available).toBe(false);
  });
  it("enforces overlap prevention even through direct SQL inserts", async () => {
    const a = await book();
    await expect(
      db.$executeRaw`INSERT INTO "Reservation" ("id","restaurantId","tableId","name","phone","partySize","startsAt","endsAt","status","updatedAt") SELECT ${randomUUID()},"restaurantId","tableId",'Constraint test','01700000000',40,"startsAt","endsAt",'CONFIRMED',now() FROM "Reservation" WHERE "id"=${a.id}`,
    ).rejects.toThrow();
  });
  it("does not allocate undersized or deactivated tables", async () => {
    await db.table.update({ where: { id: tableId }, data: { active: false } });
    await expect(createReservation(payload())).rejects.toThrow("filled");
    await db.table.update({
      where: { id: tableId },
      data: { active: true, seats: 30 },
    });
    await expect(createReservation(payload())).rejects.toThrow("filled");
  });
  it("rejects booking when hours are unconfigured or the time is outside service", async () => {
    await expect(createReservation(payload({ time: "23:00" }))).rejects.toThrow(
      "closing",
    );
    await db.restaurant.update({
      where: { id: restaurantId },
      data: { businessSettings: {} },
    });
    expect((await availability(date, 40)).configured).toBe(false);
    await expect(createReservation(payload())).rejects.toThrow("closed");
  });
  it("releases a cancelled booking, rejects stale/invalid changes and enforces tenant/role", async () => {
    const r = await book();
    await expect(
      changeReservation(
        r.id,
        { expectedStatus: "CONFIRMED", status: "CANCELLED" },
        { ...actor, role: "KITCHEN" },
      ),
    ).rejects.toThrow("permissions");
    await expect(
      changeReservation(
        r.id,
        { expectedStatus: "CONFIRMED", status: "CANCELLED" },
        { ...actor, restaurantId: "other" },
      ),
    ).rejects.toThrow();
    await expect(
      changeReservation(
        r.id,
        { expectedStatus: "CONFIRMED", status: "COMPLETED" },
        actor,
      ),
    ).rejects.toThrow("not allowed");
    await changeReservation(
      r.id,
      { expectedStatus: "CONFIRMED", status: "CANCELLED" },
      actor,
    );
    await expect(
      changeReservation(
        r.id,
        { expectedStatus: "CONFIRMED", status: "SEATED" },
        actor,
      ),
    ).rejects.toThrow("changed");
    expect(
      (await availability(date, 40)).slots.find((s) => s.time === "18:00")
        ?.available,
    ).toBe(true);
  });
  it("prevents capacity reductions/deactivation conflicting with future holds", async () => {
    await book();
    const t = await db.table.findUniqueOrThrow({ where: { id: tableId } });
    await expect(
      saveTable(
        {
          id: tableId,
          expectedVersion: t.version,
          label: t.label,
          seats: 10,
          active: true,
        },
        actor,
      ),
    ).rejects.toThrow("prevents");
    await expect(
      saveTable(
        {
          id: tableId,
          expectedVersion: t.version,
          label: t.label,
          seats: 50,
          active: false,
        },
        actor,
      ),
    ).rejects.toThrow("prevents");
  });
  it("protects a seated booking from a walk-in and links its POS check through completion", async () => {
    await db.restaurant.update({
      where: { id: restaurantId },
      data: {
        businessSettings: { ...config, reservationMinutes: 30, slotMinutes: 5 },
      },
    });
    let start = new Date(Math.ceil((Date.now() + 2 * 60000) / 300000) * 300000);
    // Keep the fixture valid even when this test runs near UTC closing time.
    if (start.getUTCHours() * 60 + start.getUTCMinutes() > 1409)
      start = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate() + 1,
        ),
      );
    const local = localParts(start, "UTC");
    const r = await book(payload({ date: local.date, time: local.time }));
    await changeReservation(
      r.id,
      { expectedStatus: "CONFIRMED", status: "SEATED" },
      actor,
    );
    const draft = {
      fulfillment: "DINE_IN",
      tableId,
      items: [{ menuItemId: itemId, quantity: 1 }],
      idempotencyKey: randomUUID(),
    };
    await expect(createStaffOrder(draft, actor)).rejects.toThrow("reserved");
    const order = await createStaffOrder(
      { ...draft, reservationId: r.id },
      actor,
    );
    orders.push(order.id);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
        .reservationId,
    ).toBe(r.id);
    await expect(
      changeReservation(
        r.id,
        { expectedStatus: "SEATED", status: "COMPLETED" },
        actor,
      ),
    ).rejects.toThrow("Close");
    expect(
      (await availability(date, 40)).slots.every((slot) => !slot.available),
    ).toBe(true);
    for (const [expectedStatus, status] of [
      ["ACCEPTED", "PREPARING"],
      ["PREPARING", "READY"],
      ["READY", "COMPLETED"],
    ])
      await updateStatus(
        order.id,
        {
          expectedStatus,
          status,
          ...(status === "COMPLETED" ? { cashCollected: true } : {}),
        },
        actor,
      );
    expect(
      (await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).status,
    ).toBe("COMPLETED");
  });
});
describe("configured delivery and manager settings", () => {
  it("keeps server-priced fee/minimum rules and idempotent price snapshots", async () => {
    const zoneId = randomUUID();
    const item = await db.menuItem.findUniqueOrThrow({ where: { id: itemId } });
    await db.restaurant.update({
      where: { id: restaurantId },
      data: {
        businessSettings: {
          ...config,
          deliveryMode: "zones",
          deliveryZones: [
            {
              id: zoneId,
              name: "Automated test zone",
              fee: 3900,
              minimum: item.price * 2,
            },
          ],
        },
      },
    });
    const input = {
      customerName: "Automated zone guest",
      phone: "01700000000",
      address: "Automated test address only",
      fulfillment: "DELIVERY",
      deliveryZoneId: zoneId,
      items: [{ menuItemId: itemId, quantity: 1 }],
      trackingToken: newToken(),
      idempotencyKey: randomUUID(),
    };
    await expect(createOrder(input)).rejects.toThrow("minimum");
    await expect(
      createOrder({ ...input, deliveryZoneId: randomUUID() }),
    ).rejects.toThrow("zone");
    const p = { ...input, items: [{ menuItemId: itemId, quantity: 2 }] };
    const order = await createOrder(p);
    orders.push(order.id);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.deliveryFee).toBe(3900);
    expect(saved.total).toBe(item.price * 2 + 3900);
    expect(saved.deliveryZone).toBe("Automated test zone");
    await db.restaurant.update({
      where: { id: restaurantId },
      data: { businessSettings: config },
    });
    expect((await createOrder(p)).id).toBe(order.id);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
        .deliveryFee,
    ).toBe(3900);
  });
  it("rejects unauthorized settings, stale versions and invalid booking configuration", async () => {
    const r = await db.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
    });
    const p = {
      expectedVersion: r.businessVersion,
      deliveryFee: r.deliveryFee,
      settings: config,
    };
    await expect(saveBusiness(p, { ...actor, role: "STAFF" })).rejects.toThrow(
      "permissions",
    );
    await expect(
      saveBusiness({ ...p, settings: { ...config, timeZone: "" } }, actor),
    ).rejects.toThrow();
    await saveBusiness(p, actor);
    await expect(saveBusiness(p, actor)).rejects.toThrow("changed");
  });
});
