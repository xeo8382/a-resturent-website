import { Prisma } from "@prisma/client";
import type { User } from "@prisma/client";
import { db } from "./db";
import { checkoutSchema, statusSchema } from "./validation";
import { digest } from "./crypto";
import { HttpError } from "./http";
import { totals, assertTransition } from "./order-rules";
import { deliveryQuote, readBusiness } from "./business-config";
export const orderInclude = {
  items: true,
  payment: true,
  events: { orderBy: { createdAt: "asc" as const } },
};
export function publicOrder(
  order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>,
) {
  return {
    id: order.id,
    status: order.status,
    fulfillment: order.fulfillment,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    deliveryZone: order.deliveryZone,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    payment: order.payment
      ? { method: order.payment.method, status: order.payment.status }
      : null,
    events: order.events.map((e) => ({
      status: e.toStatus,
      createdAt: e.createdAt,
    })),
  };
}
export async function createOrder(input: unknown) {
  const data = checkoutSchema.parse(input);
  const requestHash = digest(JSON.stringify(data));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existing = await tx.order.findUnique({
            where: { idempotencyKey: data.idempotencyKey },
          });
          if (existing) {
            if (existing.requestHash !== requestHash)
              throw new HttpError(
                409,
                "This checkout key was already used. Start a new checkout.",
              );
            return { id: existing.id };
          }
          const restaurant = await tx.restaurant.findUnique({
            where: { slug: "ember-table" },
          });
          if (!restaurant)
            throw new HttpError(503, "Restaurant has not been configured.");
          const menu = await tx.menuItem.findMany({
            where: {
              id: { in: data.items.map((i) => i.menuItemId) },
              restaurantId: restaurant.id,
              available: true,
            },
          });
          if (menu.length !== data.items.length)
            throw new HttpError(
              409,
              "An item is unavailable. Update your cart.",
            );
          const items = data.items.map((i) => {
            const item = menu.find((m) => m.id === i.menuItemId)!;
            return {
              menuItemId: item.id,
              name: item.name,
              quantity: i.quantity,
              unitPrice: item.price,
              lineTotal: item.price * i.quantity,
            };
          });
          const subtotal = totals(items, data.fulfillment, 0).subtotal;
          const quote = deliveryQuote(
            readBusiness(restaurant.businessSettings),
            data.fulfillment,
            subtotal,
            restaurant.deliveryFee,
            data.deliveryZoneId,
          );
          if (quote.error) throw new HttpError(400, quote.error);
          const price = totals(items, data.fulfillment, quote.fee);
          const order = await tx.order.create({
            data: {
              restaurantId: restaurant.id,
              customerName: data.customerName,
              phone: data.phone,
              address: data.fulfillment === "DELIVERY" ? data.address : null,
              notes: data.notes,
              fulfillment: data.fulfillment,
              deliveryZone: quote.zone,
              ...price,
              trackingTokenHash: digest(data.trackingToken),
              idempotencyKey: data.idempotencyKey,
              requestHash,
              items: { create: items },
              payment: { create: { amount: price.total } },
              events: { create: { toStatus: "PLACED" } },
            },
          });
          return { id: order.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(e.code) &&
        attempt < 2
      )
        continue;
      throw e;
    }
  }
  throw new HttpError(409, "Concurrent order update. Please retry.");
}
export async function trackedOrder(id: string, token: string | null) {
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(
      404,
      "Order not found. Use your private tracking link.",
    );
  const order = await db.order.findFirst({
    where: { id, trackingTokenHash: digest(token) },
    include: orderInclude,
  });
  if (!order) throw new HttpError(404, "Order not found.");
  return order;
}
export async function updateStatus(
  id: string,
  input: unknown,
  user: Pick<User, "id" | "role" | "restaurantId">,
) {
  const data = statusSchema.parse(input);
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, restaurantId: user.restaurantId },
    });
    if (!order) throw new HttpError(404, "Order not found.");
    if (order.status !== data.expectedStatus)
      throw new HttpError(
        409,
        "Another staff member updated this order. Refresh and retry.",
      );
    assertTransition(
      order.status,
      data.status,
      order.fulfillment,
      user.role,
      data.cashCollected,
    );
    const result = await tx.order.updateMany({
      where: {
        id,
        restaurantId: user.restaurantId,
        status: data.expectedStatus,
      },
      data: { status: data.status },
    });
    if (!result.count)
      throw new HttpError(409, "Order was updated. Refresh and retry.");
    await tx.orderEvent.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: data.status,
        actorId: user.id,
      },
    });
    if (data.status === "COMPLETED")
      await tx.payment.update({
        where: { orderId: id },
        data: { status: "PAID", paidAt: new Date() },
      });
    if (data.status === "CANCELLED")
      await tx.payment.update({
        where: { orderId: id },
        data: { status: "VOID" },
      });
    if (data.status === "COMPLETED" && order.reservationId)
      await tx.reservation.updateMany({
        where: { id: order.reservationId, status: "SEATED" },
        data: { status: "COMPLETED" },
      });
    return { id, status: data.status };
  });
}
