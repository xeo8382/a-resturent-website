import { describe, it, expect } from "vitest";
import {
  totals,
  assertTransition,
  nextStatuses,
  money,
} from "../src/lib/order-rules";
import { checkoutSchema } from "../src/lib/validation";
import { hashPassword, verifyPassword } from "../src/lib/crypto";
import { checkOrigin } from "../src/lib/http";
const valid = {
  customerName: "Sample Guest",
  phone: "01700000000",
  fulfillment: "DELIVERY",
  address: "Sample street 123, Dhaka",
  items: [{ menuItemId: "dish", quantity: 2 }],
  idempotencyKey: "3146ab90-bf1a-4b14-a339-30306c922095",
  trackingToken: "a".repeat(64),
};
describe("order totals in integer minor units", () => {
  it("calculates line totals and a delivery fee once", () =>
    expect(
      totals(
        [
          { quantity: 2, unitPrice: 68000 },
          { quantity: 3, unitPrice: 18000 },
        ],
        "DELIVERY",
        6000,
      ),
    ).toEqual({ subtotal: 190000, deliveryFee: 6000, total: 196000 }));
  it("does not charge delivery on pickup", () =>
    expect(
      totals([{ quantity: 1, unitPrice: 52000 }], "PICKUP", 6000).total,
    ).toBe(52000));
  it.each([0, -1, 1.5, 21])("rejects quantity %s", (quantity) =>
    expect(() => totals([{ quantity, unitPrice: 100 }], "PICKUP", 0)).toThrow(),
  );
});
describe("checkout validation", () => {
  it("accepts the supported checkout", () =>
    expect(checkoutSchema.safeParse(valid).success).toBe(true));
  it("rejects supplied browser prices", () =>
    expect(
      checkoutSchema.safeParse({
        ...valid,
        items: [{ menuItemId: "dish", quantity: 1, price: 1 }],
      }).success,
    ).toBe(false));
  it("requires a delivery address", () =>
    expect(checkoutSchema.safeParse({ ...valid, address: "" }).success).toBe(
      false,
    ));
  it("rejects duplicate menu items", () =>
    expect(
      checkoutSchema.safeParse({
        ...valid,
        items: [...valid.items, ...valid.items],
      }).success,
    ).toBe(false));
  it("rejects unsupported dine-in checkout", () =>
    expect(
      checkoutSchema.safeParse({ ...valid, fulfillment: "DINE_IN" }).success,
    ).toBe(false));
});
describe("authorized state transitions", () => {
  it("accepts a new order", () =>
    expect(() =>
      assertTransition("PLACED", "ACCEPTED", "PICKUP", "STAFF"),
    ).not.toThrow());
  it("prevents jumping from placed to complete", () =>
    expect(() =>
      assertTransition("PLACED", "COMPLETED", "DELIVERY", "ADMIN", true),
    ).toThrow());
  it("restricts kitchen staff", () =>
    expect(() =>
      assertTransition("PLACED", "ACCEPTED", "PICKUP", "KITCHEN"),
    ).toThrow());
  it("allows kitchen preparation", () =>
    expect(() =>
      assertTransition("ACCEPTED", "PREPARING", "PICKUP", "KITCHEN"),
    ).not.toThrow());
  it("requires cash collection confirmation", () =>
    expect(() =>
      assertTransition("READY", "COMPLETED", "PICKUP", "STAFF", false),
    ).toThrow());
  it("allows completion after cash collection", () =>
    expect(() =>
      assertTransition("READY", "COMPLETED", "PICKUP", "STAFF", true),
    ).not.toThrow());
  it("requires dispatch for delivery", () =>
    expect(nextStatuses("READY", "DELIVERY")).toEqual(["OUT_FOR_DELIVERY"]));
  it("terminal orders cannot change", () =>
    expect(nextStatuses("COMPLETED", "PICKUP")).toEqual([]));
});
describe("authentication primitives", () => {
  it("salts password hashes and verifies only the matching password", () => {
    const hash = hashPassword("correct password");
    expect(hash).not.toBe(hashPassword("correct password"));
    expect(verifyPassword("correct password", hash)).toBe(true);
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });
  it("rejects a cross-origin mutation", () => {
    process.env.APP_ORIGIN = "http://localhost:3000";
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api/orders", {
          headers: { origin: "https://attacker.test" },
        }),
      ),
    ).toThrow();
  });
});

it("displays fractional BDT prices without rounding away poisha", () => {
  expect(money(68050)).toContain("680.50");
});
