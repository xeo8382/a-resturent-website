import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { businessSchema, readBusiness } from "./business-config";
import { HttpError } from "./errors";
import type { StaffActor } from "./pos-orders";
import { activeReservations } from "./reservations";
export function assertManager(user: StaffActor) {
  if (!["ADMIN", "MANAGER"].includes(user.role))
    throw new HttpError(403, "Manager permissions are required.");
}
export async function publicBusiness() {
  const restaurant = await db.restaurant.findUnique({
    where: { slug: "ember-table" },
  });
  if (!restaurant)
    throw new HttpError(503, "Restaurant details have not been configured.");
  return {
    name: restaurant.name,
    deliveryFee: restaurant.deliveryFee,
    settings: readBusiness(restaurant.businessSettings),
  };
}
export const settingsUpdateSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    deliveryFee: z.number().int().min(0).max(1000000),
    settings: businessSchema,
  })
  .strict();
export async function saveBusiness(input: unknown, user: StaffActor) {
  assertManager(user);
  const data = settingsUpdateSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Restaurant" WHERE "id"=${user.restaurantId} FOR UPDATE`;
    const current = await tx.restaurant.findUniqueOrThrow({
      where: { id: user.restaurantId },
    });
    if (current.businessVersion !== data.expectedVersion)
      throw new HttpError(
        409,
        "Business settings changed. Reload before saving.",
      );
    if (
      data.settings.reservationsEnabled &&
      !(await tx.table.count({
        where: { restaurantId: user.restaurantId, active: true },
      }))
    )
      throw new HttpError(
        400,
        "Configure at least one active table before enabling reservations.",
      );
    const updated = await tx.restaurant.update({
      where: { id: user.restaurantId },
      data: {
        businessSettings: data.settings as Prisma.InputJsonValue,
        deliveryFee: data.deliveryFee,
        businessVersion: { increment: 1 },
      },
    });
    return {
      settings: readBusiness(updated.businessSettings),
      deliveryFee: updated.deliveryFee,
      version: updated.businessVersion,
    };
  });
}
export const tableSchema = z
  .object({
    id: z.string().max(80).optional(),
    expectedVersion: z.number().int().min(0).optional(),
    label: z.string().trim().min(1).max(30),
    seats: z.number().int().min(1).max(50),
    active: z.boolean(),
  })
  .strict();
export async function saveTable(input: unknown, user: StaffActor) {
  assertManager(user);
  const data = tableSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Restaurant" WHERE "id"=${user.restaurantId} FOR UPDATE`;
    if (!data.id) {
      if (
        await tx.table.findFirst({
          where: { restaurantId: user.restaurantId, label: data.label },
        })
      )
        throw new HttpError(409, "That table label is already in use.");
      return tx.table.create({
        data: {
          restaurantId: user.restaurantId,
          label: data.label,
          seats: data.seats,
          active: data.active,
        },
      });
    }
    await tx.$queryRaw`SELECT "id" FROM "Table" WHERE "id"=${data.id} AND "restaurantId"=${user.restaurantId} FOR UPDATE`;
    const table = await tx.table.findFirst({
      where: { id: data.id, restaurantId: user.restaurantId },
    });
    if (!table) throw new HttpError(404, "Table not found.");
    if (data.expectedVersion !== table.version)
      throw new HttpError(409, "This table changed. Reload before saving.");
    if (
      await tx.table.findFirst({
        where: {
          restaurantId: user.restaurantId,
          label: data.label,
          id: { not: data.id },
        },
      })
    )
      throw new HttpError(409, "That table label is already in use.");
    const check = await tx.order.count({
      where: {
        tableId: data.id,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    });
    const booking = await tx.reservation.count({
      where: {
        tableId: data.id,
        status: { in: [...activeReservations] },
        OR: [{ status: "SEATED" }, { endsAt: { gt: new Date() } }],
        ...(!data.active ? {} : { partySize: { gt: data.seats } }),
      },
    });
    if (check || booking)
      throw new HttpError(
        409,
        "An active check or reservation prevents this capacity/availability change.",
      );
    return tx.table.update({
      where: { id: data.id },
      data: {
        label: data.label,
        seats: data.seats,
        active: data.active,
        version: { increment: 1 },
      },
    });
  });
}
