import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { createOrder, trackedOrder, updateStatus } from "../src/lib/orders";
import { newToken } from "../src/lib/crypto";
const created: string[] = [];
let restaurantId: string;
let itemId: string;
let price: number;
let actorId: string;
function payload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Integration sample",
    phone: "01700000000",
    fulfillment: "DELIVERY",
    address: "Sample street 123, Dhaka",
    items: [{ menuItemId: itemId, quantity: 2 }],
    idempotencyKey: randomUUID(),
    trackingToken: newToken(),
    ...overrides,
  };
}
beforeAll(async () => {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { slug: "ember-table" },
  });
  restaurantId = restaurant.id;
  const item = await db.menuItem.findFirstOrThrow({
    where: { restaurantId, available: true },
  });
  itemId = item.id;
  price = item.price;
  const user = await db.user.create({
    data: {
      restaurantId,
      name: "Integration actor",
      email: `integration-${randomUUID()}@example.test`,
      role: "STAFF",
      passwordHash: "unused-test-account",
    },
  });
  actorId = user.id;
});
afterAll(async () => {
  await db.payment.deleteMany({ where: { orderId: { in: created } } });
  await db.order.deleteMany({ where: { id: { in: created } } });
  if (actorId) await db.user.delete({ where: { id: actorId } });
  await db.$disconnect();
});
describe("PostgreSQL order lifecycle", () => {
  it("saves server menu prices, cash payment, snapshots and initial event", async () => {
    const p = payload();
    const result = await createOrder(p);
    created.push(result.id);
    const order = await trackedOrder(result.id, p.trackingToken);
    expect(order.subtotal).toBe(price * 2);
    expect(order.total).toBe(price * 2 + 6000);
    expect(order.items[0].unitPrice).toBe(price);
    expect(order.payment?.status).toBe("PENDING");
    expect(order.events[0].toStatus).toBe("PLACED");
  });
  it("reuses a checkout idempotency key without duplicating orders", async () => {
    const p = payload();
    const [a, b] = await Promise.all([createOrder(p), createOrder(p)]);
    created.push(a.id);
    expect(a.id).toBe(b.id);
    expect(
      await db.order.count({ where: { idempotencyKey: p.idempotencyKey } }),
    ).toBe(1);
    await expect(
      createOrder({ ...p, customerName: "Different customer" }),
    ).rejects.toThrow("already used");
  });
  it("does not expose orders to the wrong tracking token", async () => {
    const p = payload();
    const o = await createOrder(p);
    created.push(o.id);
    await expect(trackedOrder(o.id, newToken())).rejects.toThrow("not found");
  });
  it("rejects unknown items without writing an order", async () => {
    const p = payload({ items: [{ menuItemId: "missing", quantity: 1 }] });
    await expect(createOrder(p)).rejects.toThrow("unavailable");
    expect(
      await db.order.count({ where: { idempotencyKey: p.idempotencyKey } }),
    ).toBe(0);
  });
  it("rejects browser price injection", async () => {
    await expect(
      createOrder(
        payload({ items: [{ menuItemId: itemId, quantity: 1, unitPrice: 1 }] }),
      ),
    ).rejects.toThrow();
  });
  it("isolates restaurants and kitchen permissions, rejects stale updates, then completes with audited cash collection", async () => {
    const p = payload({ fulfillment: "PICKUP", address: "" });
    const o = await createOrder(p);
    created.push(o.id);
    const actor = { id: actorId, restaurantId, role: "STAFF" as const };
    await expect(
      updateStatus(
        o.id,
        { status: "ACCEPTED", expectedStatus: "PLACED" },
        { ...actor, restaurantId: "other" },
      ),
    ).rejects.toThrow("not found");
    await expect(
      updateStatus(
        o.id,
        { status: "ACCEPTED", expectedStatus: "PLACED" },
        { ...actor, role: "KITCHEN" },
      ),
    ).rejects.toThrow("Kitchen");
    await updateStatus(
      o.id,
      { status: "ACCEPTED", expectedStatus: "PLACED" },
      actor,
    );
    await expect(
      updateStatus(
        o.id,
        { status: "CANCELLED", expectedStatus: "PLACED" },
        actor,
      ),
    ).rejects.toThrow("Another staff");
    await updateStatus(
      o.id,
      { status: "PREPARING", expectedStatus: "ACCEPTED" },
      { ...actor, role: "KITCHEN" },
    );
    await updateStatus(
      o.id,
      { status: "READY", expectedStatus: "PREPARING" },
      { ...actor, role: "KITCHEN" },
    );
    await expect(
      updateStatus(
        o.id,
        { status: "COMPLETED", expectedStatus: "READY" },
        actor,
      ),
    ).rejects.toThrow("cash");
    await updateStatus(
      o.id,
      { status: "COMPLETED", expectedStatus: "READY", cashCollected: true },
      actor,
    );
    const completed = await trackedOrder(o.id, p.trackingToken);
    expect(completed.total).toBe(price * 2);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.payment?.status).toBe("PAID");
    expect(completed.events).toHaveLength(5);
  });
  it("voids payment on cancellation", async () => {
    const p = payload();
    const o = await createOrder(p);
    created.push(o.id);
    await updateStatus(
      o.id,
      { status: "CANCELLED", expectedStatus: "PLACED" },
      { id: actorId, restaurantId, role: "STAFF" },
    );
    expect((await trackedOrder(o.id, p.trackingToken)).payment?.status).toBe(
      "VOID",
    );
  });
});
