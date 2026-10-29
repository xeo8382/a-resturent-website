import { describe, it, expect } from "vitest";
import { staffOrderSchema, assertServiceRole } from "../src/lib/pos-validation";
import { totals, nextStatuses } from "../src/lib/order-rules";
const valid = {
  fulfillment: "DINE_IN",
  tableId: "table-1",
  items: [{ menuItemId: "dish", quantity: 1 }],
  idempotencyKey: "3146ab90-bf1a-4b14-a339-30306c922095",
};
describe("POS draft boundaries", () => {
  it("requires a dine-in table", () =>
    expect(
      staffOrderSchema.safeParse({ ...valid, tableId: null }).success,
    ).toBe(false));
  it("rejects a table on a pickup order", () =>
    expect(
      staffOrderSchema.safeParse({ ...valid, fulfillment: "PICKUP" }).success,
    ).toBe(false));
  it("accepts pickup without a table", () =>
    expect(
      staffOrderSchema.safeParse({
        ...valid,
        fulfillment: "PICKUP",
        tableId: null,
      }).success,
    ).toBe(true));
  it("rejects browser prices", () =>
    expect(
      staffOrderSchema.safeParse({
        ...valid,
        items: [{ menuItemId: "dish", quantity: 1, price: 1 }],
      }).success,
    ).toBe(false));
  it("rejects duplicate item lines", () =>
    expect(
      staffOrderSchema.safeParse({
        ...valid,
        items: [...valid.items, ...valid.items],
      }).success,
    ).toBe(false));
  it("rejects kitchen order creation", () =>
    expect(() => assertServiceRole("KITCHEN")).toThrow());
  it.each(["STAFF", "MANAGER", "ADMIN"] as const)(
    "allows %s to create orders",
    (role) => expect(() => assertServiceRole(role)).not.toThrow(),
  );
  it("dine-in has no delivery fee and completes from READY", () => {
    expect(
      totals([{ unitPrice: 12550, quantity: 2 }], "DINE_IN", 6000).total,
    ).toBe(25100);
    expect(nextStatuses("READY", "DINE_IN")).toEqual(["COMPLETED"]);
  });
});
