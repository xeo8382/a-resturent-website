import type { Fulfillment, OrderStatus, Role } from "@prisma/client";
import { HttpError } from "./errors";
export function totals(
  items: { quantity: number; unitPrice: number }[],
  fulfillment: Fulfillment,
  deliveryFee: number,
) {
  if (
    !items.length ||
    items.some(
      (i) =>
        !Number.isInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > 20 ||
        !Number.isInteger(i.unitPrice) ||
        i.unitPrice < 0,
    )
  )
    throw new HttpError(400, "Invalid order items.");
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const fee = fulfillment === "DELIVERY" ? deliveryFee : 0;
  return { subtotal, deliveryFee: fee, total: subtotal + fee };
}
export function nextStatuses(
  status: OrderStatus,
  fulfillment: Fulfillment,
): OrderStatus[] {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    PLACED: ["ACCEPTED", "CANCELLED"],
    ACCEPTED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY"],
    READY: [fulfillment === "DELIVERY" ? "OUT_FOR_DELIVERY" : "COMPLETED"],
    OUT_FOR_DELIVERY: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  return transitions[status];
}
export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment: Fulfillment,
  role: Role,
  cashCollected = false,
) {
  if (!nextStatuses(from, fulfillment).includes(to))
    throw new HttpError(
      409,
      "This order status change is not allowed. Refresh the order.",
    );
  if (
    role === "KITCHEN" &&
    !(from === "ACCEPTED" && to === "PREPARING") &&
    !(from === "PREPARING" && to === "READY")
  )
    throw new HttpError(
      403,
      "Kitchen staff can only prepare orders and mark them ready.",
    );
  if (to === "COMPLETED" && !cashCollected)
    throw new HttpError(
      400,
      "Confirm cash collection before completing this order.",
    );
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
