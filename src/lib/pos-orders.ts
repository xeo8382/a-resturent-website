import { Prisma } from "@prisma/client";
import type { User } from "@prisma/client";
import { db } from "./db";
import { digest, newToken } from "./crypto";
import { HttpError } from "./errors";
import { totals } from "./order-rules";
import { assertServiceRole, staffOrderSchema } from "./pos-validation";
import { readBusiness } from "./business-config";
import { holdConflict } from "./reservations";
import { localParts } from "./reservation-time";
export type StaffActor = Pick<User, "id" | "restaurantId" | "role">;
export async function createStaffOrder(input: unknown, user: StaffActor) {
  assertServiceRole(user.role);
  const data = staffOrderSchema.parse(input);
  const requestHash = digest(
    JSON.stringify({
      actorId: user.id,
      restaurantId: user.restaurantId,
      ...data,
    }),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Restaurant" WHERE "id"=${user.restaurantId} FOR UPDATE`;
          const existing = await tx.order.findUnique({
            where: { idempotencyKey: data.idempotencyKey },
          });
          if (existing) {
            if (
              existing.restaurantId !== user.restaurantId ||
              existing.createdById !== user.id ||
              existing.requestHash !== requestHash
            )
              throw new HttpError(
                409,
                "This order key has already been used for a different request.",
              );
            return { id: existing.id };
          }
          const restaurant = await tx.restaurant.findUnique({
            where: { id: user.restaurantId },
          });
          if (!restaurant) throw new HttpError(404, "Restaurant not found.");
          if (data.tableId) {
            const rows = await tx.$queryRaw<
              { id: string }[]
            >`SELECT "id" FROM "Table" WHERE "id"=${data.tableId} AND "restaurantId"=${user.restaurantId} AND "active"=true FOR UPDATE`;
            if (!rows.length)
              throw new HttpError(404, "Table not found in your restaurant.");
            const active = await tx.order.findFirst({
              where: {
                tableId: data.tableId,
                status: { notIn: ["COMPLETED", "CANCELLED"] },
              },
            });
            if (active)
              throw new HttpError(
                409,
                "This table already has an active order. Refresh tables and choose another.",
              );
            if (data.reservationId) {
              const booking = await tx.reservation.findFirst({
                where: {
                  id: data.reservationId,
                  restaurantId: user.restaurantId,
                  tableId: data.tableId,
                  status: "SEATED",
                },
              });
              if (!booking)
                throw new HttpError(
                  409,
                  "Select a current, seated reservation for this table.",
                );
              if (
                await tx.order.findUnique({
                  where: { reservationId: booking.id },
                })
              )
                throw new HttpError(
                  409,
                  "This reservation already has a POS check.",
                );
            }
            const until = new Date(
              Date.now() +
                readBusiness(restaurant.businessSettings).reservationMinutes *
                  60000,
            );
            const booking = await tx.reservation.findFirst({
              where: {
                tableId: data.tableId,
                ...(data.reservationId
                  ? { id: { not: data.reservationId } }
                  : {}),
                ...holdConflict(new Date(), until),
              },
            });
            if (booking)
              throw new HttpError(
                409,
                "This table is reserved during the configured service window. Use the reservation's seated POS link or choose another table.",
              );
          }
          const menu = await tx.menuItem.findMany({
            where: {
              id: { in: data.items.map((i) => i.menuItemId) },
              restaurantId: user.restaurantId,
              available: true,
            },
          });
          if (menu.length !== data.items.length)
            throw new HttpError(
              409,
              "An item is unavailable. Refresh the menu and update the draft.",
            );
          const items = data.items.map((line) => {
            const item = menu.find((i) => i.id === line.menuItemId)!;
            return {
              menuItemId: item.id,
              name: item.name,
              quantity: line.quantity,
              unitPrice: item.price,
              lineTotal: item.price * line.quantity,
            };
          });
          const price = totals(items, data.fulfillment, restaurant.deliveryFee);
          const order = await tx.order.create({
            data: {
              restaurantId: user.restaurantId,
              source: "STAFF",
              createdById: user.id,
              tableId: data.tableId ?? null,
              reservationId: data.reservationId ?? null,
              customerName: data.customerName,
              phone: "",
              notes: data.notes,
              fulfillment: data.fulfillment,
              status: "ACCEPTED",
              ...price,
              trackingTokenHash: digest(newToken()),
              idempotencyKey: data.idempotencyKey,
              requestHash,
              items: { create: items },
              payment: { create: { amount: price.total } },
              events: { create: { toStatus: "ACCEPTED", actorId: user.id } },
            },
          });
          return { id: order.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(e.code)
      ) {
        if (attempt < 2) continue;
        throw new HttpError(
          409,
          "The order or table changed concurrently. Refresh and retry the same request.",
        );
      }
      throw e;
    }
  }
  throw new HttpError(409, "Order conflict. Please retry.");
}
export async function posMenu(restaurantId: string) {
  return db.menuCategory.findMany({
    where: { restaurantId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      items: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          price: true,
          image: true,
          allergens: true,
          available: true,
          featured: true,
        },
      },
    },
  });
}
export async function posTables(restaurantId: string) {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
  });
  const now = new Date(),
    until = new Date(
      now.getTime() +
        readBusiness(restaurant.businessSettings).reservationMinutes * 60000,
    );
  const tables = await db.table.findMany({
    where: { restaurantId, active: true },
    orderBy: { label: "asc" },
    select: {
      id: true,
      label: true,
      seats: true,
      reservations: {
        where: holdConflict(now, until),
        select: { id: true, status: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: "asc" },
        take: 1,
      },
      orders: {
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        select: {
          id: true,
          customerName: true,
          status: true,
          total: true,
          source: true,
          createdAt: true,
        },
      },
    },
  });
  return tables.map(({ reservations, ...table }) => ({
    ...table,
    reservationHold: reservations[0]
      ? {
          ...reservations[0],
          date: localParts(
            reservations[0].startsAt,
            readBusiness(restaurant.businessSettings).timeZone || "UTC",
          ).date,
        }
      : null,
  }));
}
export async function staffReceipt(id: string, user: StaffActor) {
  assertServiceRole(user.role);
  const order = await db.$transaction(
    (tx) =>
      tx.order.findFirst({
        where: { id, restaurantId: user.restaurantId },
        include: {
          restaurant: { select: { name: true, currency: true } },
          table: { select: { label: true } },
          items: true,
          payment: true,
        },
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  if (!order) throw new HttpError(404, "Receipt not found.");
  return {
    id: order.id,
    restaurant: order.restaurant,
    table: order.table,
    customerName: order.customerName,
    source: order.source,
    fulfillment: order.fulfillment,
    status: order.status,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    payment: order.payment
      ? {
          amount: order.payment.amount,
          status: order.payment.status,
          method: order.payment.method,
          paidAt: order.payment.paidAt,
        }
      : null,
  };
}
