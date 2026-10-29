import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import {
  createStaffOrder,
  posTables,
  staffReceipt,
} from "../src/lib/pos-orders";
import { updateStatus } from "../src/lib/orders";
import { manageMenu } from "../src/lib/menu-management";
import type { StaffActor } from "../src/lib/pos-orders";
let actor: StaffActor;
let kitchen: StaffActor;
let tableId: string;
let otherTableId: string;
let itemId: string;
let otherRestaurantId: string;
let categoryId: string;
const orders: string[] = [];
const menuIds: string[] = [];
const run = randomUUID();
function payload(overrides: Record<string, unknown> = {}) {
  return {
    fulfillment: "DINE_IN",
    tableId,
    items: [{ menuItemId: itemId, quantity: 2 }],
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}
async function make(data: ReturnType<typeof payload>, user = actor) {
  const o = await createStaffOrder(data, user);
  orders.push(o.id);
  return o;
}
async function cancel(id: string) {
  await updateStatus(
    id,
    { expectedStatus: "ACCEPTED", status: "CANCELLED" },
    actor,
  );
}
beforeAll(async () => {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { slug: "ember-table" },
  });
  categoryId = (
    await db.menuCategory.findFirstOrThrow({
      where: { restaurantId: restaurant.id },
    })
  ).id;
  const user = await db.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "POS integration service",
      email: `pos-${run}@example.test`,
      passwordHash: "unused",
      role: "STAFF",
    },
  });
  actor = { id: user.id, role: user.role, restaurantId: user.restaurantId };
  const cook = await db.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "POS integration kitchen",
      email: `cook-${run}@example.test`,
      passwordHash: "unused",
      role: "KITCHEN",
    },
  });
  kitchen = { id: cook.id, role: cook.role, restaurantId: cook.restaurantId };
  tableId = (
    await db.table.create({
      data: { restaurantId: restaurant.id, label: `QA-${run}`, seats: 4 },
    })
  ).id;
  otherRestaurantId = (
    await db.restaurant.create({
      data: { slug: `other-${run}`, name: "Other test restaurant" },
    })
  ).id;
  otherTableId = (
    await db.table.create({
      data: { restaurantId: otherRestaurantId, label: "OTHER", seats: 2 },
    })
  ).id;
  itemId = (
    await db.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId,
        slug: `test-pos-${run}`,
        name: "POS test dish",
        description: "A test-only menu item for POS integration.",
        price: 12550,
        image: "/images/garden.svg",
        allergens: [],
      },
    })
  ).id;
  menuIds.push(itemId);
});
afterAll(async () => {
  await db.payment.deleteMany({ where: { orderId: { in: orders } } });
  await db.order.deleteMany({ where: { id: { in: orders } } });
  await db.menuItem.deleteMany({ where: { id: { in: menuIds } } });
  if (tableId) await db.table.delete({ where: { id: tableId } });
  if (otherTableId) await db.table.delete({ where: { id: otherTableId } });
  if (otherRestaurantId)
    await db.restaurant.delete({ where: { id: otherRestaurantId } });
  if (actor)
    await db.user.deleteMany({ where: { id: { in: [actor.id, kitchen.id] } } });
  await db.$disconnect();
});
describe("staff POS transaction", () => {
  it("persists a server-priced accepted dine-in check, provenance, payment and actor audit", async () => {
    const p = payload();
    const o = await make(p);
    const saved = await db.order.findUniqueOrThrow({
      where: { id: o.id },
      include: { items: true, payment: true, events: true },
    });
    expect(saved.source).toBe("STAFF");
    expect(saved.createdById).toBe(actor.id);
    expect(saved.tableId).toBe(tableId);
    expect(saved.status).toBe("ACCEPTED");
    expect(saved.total).toBe(25100);
    expect(saved.deliveryFee).toBe(0);
    expect(saved.items[0].unitPrice).toBe(12550);
    expect(saved.payment?.status).toBe("PENDING");
    expect(saved.events[0].actorId).toBe(actor.id);
    await cancel(o.id);
  });
  it("concurrent retries with the same key create one check", async () => {
    const p = payload();
    const [a, b] = await Promise.all([make(p), make(p)]);
    expect(a.id).toBe(b.id);
    expect(
      await db.order.count({ where: { idempotencyKey: p.idempotencyKey } }),
    ).toBe(1);
    await expect(
      createStaffOrder({ ...p, customerName: "Changed request" }, actor),
    ).rejects.toThrow("already been used");
    await cancel(a.id);
  });
  it("concurrent different checks cannot double-book a table", async () => {
    const result = await Promise.allSettled([make(payload()), make(payload())]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
    const active = await db.order.findMany({
      where: { tableId, status: { notIn: ["CANCELLED", "COMPLETED"] } },
    });
    expect(active).toHaveLength(1);
    await cancel(active[0].id);
  });
  it("requires a table and prevents cross-restaurant table claims", async () => {
    await expect(
      createStaffOrder(payload({ tableId: null }), actor),
    ).rejects.toThrow();
    await expect(
      createStaffOrder(payload({ tableId: otherTableId }), actor),
    ).rejects.toThrow("Table not found");
  });
  it("rejects kitchen creation, unavailable items and client price fields", async () => {
    await expect(createStaffOrder(payload(), kitchen)).rejects.toThrow(
      "permissions",
    );
    await expect(
      createStaffOrder(
        payload({ items: [{ menuItemId: itemId, quantity: 1, unitPrice: 1 }] }),
        actor,
      ),
    ).rejects.toThrow();
    await db.menuItem.update({
      where: { id: itemId },
      data: { available: false },
    });
    try {
      await expect(createStaffOrder(payload(), actor)).rejects.toThrow(
        "unavailable",
      );
    } finally {
      await db.menuItem.update({
        where: { id: itemId },
        data: { available: true },
      });
    }
  });
  it("pickup orders do not claim a table or charge delivery", async () => {
    const o = await make(payload({ fulfillment: "PICKUP", tableId: null }));
    const saved = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(saved.tableId).toBeNull();
    expect(saved.total).toBe(25100);
    await cancel(o.id);
  });
  it("retains pending cash until valid completion; receipt then becomes paid and table reopens", async () => {
    const o = await make(payload());
    expect((await staffReceipt(o.id, actor)).payment?.status).toBe("PENDING");
    await expect(staffReceipt(o.id, kitchen)).rejects.toThrow("permissions");
    await expect(
      staffReceipt(o.id, { ...actor, restaurantId: otherRestaurantId }),
    ).rejects.toThrow("not found");
    await updateStatus(
      o.id,
      { status: "PREPARING", expectedStatus: "ACCEPTED" },
      kitchen,
    );
    await updateStatus(
      o.id,
      { status: "READY", expectedStatus: "PREPARING" },
      kitchen,
    );
    await expect(
      updateStatus(
        o.id,
        { status: "COMPLETED", expectedStatus: "READY" },
        actor,
      ),
    ).rejects.toThrow("cash");
    expect((await staffReceipt(o.id, actor)).payment?.status).toBe("PENDING");
    await expect(
      updateStatus(
        o.id,
        { status: "COMPLETED", expectedStatus: "READY", cashCollected: true },
        kitchen,
      ),
    ).rejects.toThrow("Kitchen");
    await updateStatus(
      o.id,
      { status: "COMPLETED", expectedStatus: "READY", cashCollected: true },
      actor,
    );
    const paid = await staffReceipt(o.id, actor);
    expect(paid.payment?.status).toBe("PAID");
    expect(paid.payment?.paidAt).toBeTruthy();
    expect(paid.payment?.amount).toBe(25100);
    expect(
      (await posTables(actor.restaurantId)).find((t) => t.id === tableId)
        ?.orders,
    ).toHaveLength(0);
    const next = await make(payload());
    await cancel(next.id);
  });
  it("cancelled checks void cash and release table", async () => {
    const o = await make(payload());
    await cancel(o.id);
    expect((await staffReceipt(o.id, actor)).payment?.status).toBe("VOID");
    expect(
      (await posTables(actor.restaurantId)).find((t) => t.id === tableId)
        ?.orders,
    ).toHaveLength(0);
  });
  it("menu management restricts roles and preserves tenant boundaries", async () => {
    const data = {
      name: "Managed test dish",
      slug: `managed-${run}`,
      description: "New test dish created by a manager.",
      categoryId,
      allergens: ["Sesame"],
      price: 23000,
      available: true,
    };
    await expect(manageMenu(data, actor, true)).rejects.toThrow("permission");
    const manager = { ...actor, role: "MANAGER" as const };
    const created = await manageMenu(data, manager, true);
    if (!("id" in created) || !created.id) throw new Error("No created ID");
    menuIds.push(created.id);
    await manageMenu(
      {
        id: created.id,
        price: 24000,
        available: false,
        name: "Updated managed dish",
      },
      manager,
    );
    const updated = await db.menuItem.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(updated.name).toBe("Updated managed dish");
    expect(updated.price).toBe(24000);
    expect(updated.available).toBe(false);
    await expect(
      manageMenu({ id: created.id, price: 1, available: true }, manager),
    ).rejects.toThrow();
    await expect(
      manageMenu(
        { ...data, slug: `other-${run}`, categoryId },
        { ...manager, restaurantId: otherRestaurantId },
        true,
      ),
    ).rejects.toThrow("Category not found");
  });
});
