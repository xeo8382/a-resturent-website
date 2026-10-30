import { Prisma, type Reservation, type User } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { digest } from "./crypto";
import { HttpError } from "./errors";
import { readBusiness } from "./business-config";
import {
  calendarDate,
  localParts,
  reservationWindow,
  timesForDate,
} from "./reservation-time";

export const serviceRoles = ["ADMIN", "MANAGER", "STAFF"] as const;
type Actor = Pick<User, "id" | "restaurantId" | "role">;
export function assertReservationRole(user: Actor) {
  if (!serviceRoles.some((role) => role === user.role))
    throw new HttpError(403, "Service staff permissions are required.");
}
export const reservationSchema = z
  .object({
    date: z.string().length(10),
    time: z.string().length(5),
    partySize: z.number().int().min(1).max(50),
    name: z.string().trim().min(2).max(80),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a valid phone number."),
    email: z.union([z.literal(""), z.email().max(254)]).optional(),
    notes: z.string().trim().max(500).optional(),
    idempotencyKey: z.uuid(),
    trackingToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const activeReservations = ["REQUESTED", "CONFIRMED", "SEATED"] as const;
export function holdConflict(
  startsAt: Date,
  endsAt: Date,
): Prisma.ReservationWhereInput {
  return {
    OR: [
      { status: "SEATED" },
      {
        status: { in: ["REQUESTED", "CONFIRMED"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    ],
  };
}
export function reservationView(reservation: Reservation, timeZone: string) {
  timeZone = reservation.timeZone || timeZone;
  return {
    id: reservation.id,
    name: reservation.name,
    partySize: reservation.partySize,
    status: reservation.status,
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
    timeZone,
    ...localParts(reservation.startsAt, timeZone),
  };
}
export async function availability(date: string, partySize: number) {
  calendarDate(date);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50)
    throw new HttpError(400, "Choose a valid guest count.");
  // One repeatable-read snapshot prevents combining table/reservation states from
  // different instants. Booking always rechecks while holding row locks.
  return db.$transaction(
    async (tx) => {
      const restaurant = await tx.restaurant.findUnique({
        where: { slug: "ember-table" },
      });
      if (!restaurant)
        throw new HttpError(503, "Restaurant is not configured.");
      const config = readBusiness(restaurant.businessSettings);
      if (!config.reservationsEnabled || !config.timeZone)
        return {
          configured: false,
          timeZone: config.timeZone,
          slots: [],
          maxPartySize: config.maxPartySize,
        };
      if (partySize > config.maxPartySize)
        return {
          configured: true,
          timeZone: config.timeZone,
          slots: [],
          maxPartySize: config.maxPartySize,
        };
      const slots = timesForDate(config, date);
      if (!slots.length)
        return {
          configured: true,
          timeZone: config.timeZone,
          slots: [],
          maxPartySize: config.maxPartySize,
        };
      const tables = await tx.table.findMany({
        where: {
          restaurantId: restaurant.id,
          active: true,
          seats: { gte: partySize },
          orders: { none: { status: { notIn: ["COMPLETED", "CANCELLED"] } } },
          reservations: { none: { status: "SEATED" } },
        },
        select: { id: true },
      });
      const booked = await tx.reservation.findMany({
        where: {
          restaurantId: restaurant.id,
          tableId: { in: tables.map((t) => t.id) },
          status: { in: [...activeReservations] },
          startsAt: { lt: slots.at(-1)!.endsAt },
          endsAt: { gt: slots[0].startsAt },
        },
        select: { tableId: true, startsAt: true, endsAt: true },
      });
      return {
        configured: true,
        timeZone: config.timeZone,
        maxPartySize: config.maxPartySize,
        durationMinutes: config.reservationMinutes,
        slots: slots.map((slot) => ({
          time: slot.time,
          available: tables.some(
            (table) =>
              !booked.some(
                (r) =>
                  r.tableId === table.id &&
                  r.startsAt < slot.endsAt &&
                  r.endsAt > slot.startsAt,
              ),
          ),
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export async function createReservation(input: unknown) {
  const data = reservationSchema.parse(input);
  const requestHash = digest(JSON.stringify(data));
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          // Global lock order: restaurant then table. Also shared by settings and POS.
          const rows = await tx.$queryRaw<
            { id: string }[]
          >`SELECT "id" FROM "Restaurant" WHERE "slug"='ember-table' FOR UPDATE`;
          if (!rows.length)
            throw new HttpError(503, "Restaurant is not configured.");
          const restaurant = await tx.restaurant.findUniqueOrThrow({
            where: { id: rows[0].id },
          });
          const config = readBusiness(restaurant.businessSettings);
          const existing = await tx.reservation.findUnique({
            where: { idempotencyKey: data.idempotencyKey },
          });
          if (existing) {
            if (existing.requestHash !== requestHash)
              throw new HttpError(
                409,
                "This booking key has already been used. Start a new booking.",
              );
            return reservationView(existing, config.timeZone || "UTC");
          }
          const window = reservationWindow(config, data.date, data.time);
          if (data.partySize > config.maxPartySize)
            throw new HttpError(
              400,
              "This party exceeds the configured online booking limit.",
            );
          const tables = await tx.table.findMany({
            where: {
              restaurantId: restaurant.id,
              active: true,
              seats: { gte: data.partySize },
            },
            orderBy: [{ seats: "asc" }, { id: "asc" }],
          });
          for (const table of tables) {
            await tx.$queryRaw`SELECT "id" FROM "Table" WHERE "id"=${table.id} FOR UPDATE`;
            const [booking, check] = await Promise.all([
              tx.reservation.findFirst({
                where: {
                  tableId: table.id,
                  ...holdConflict(window.startsAt, window.endsAt),
                },
              }),
              tx.order.findFirst({
                where: {
                  tableId: table.id,
                  status: { notIn: ["COMPLETED", "CANCELLED"] },
                },
              }),
            ]);
            if (booking || check) continue;
            const reservation = await tx.reservation.create({
              data: {
                restaurantId: restaurant.id,
                tableId: table.id,
                name: data.name,
                phone: data.phone,
                email: data.email || null,
                timeZone: config.timeZone,
                notes: data.notes || null,
                partySize: data.partySize,
                ...window,
                status: "CONFIRMED",
                idempotencyKey: data.idempotencyKey,
                requestHash,
                trackingTokenHash: digest(data.trackingToken),
              },
            });
            return reservationView(reservation, config.timeZone);
          }
          throw new HttpError(
            409,
            "That time has just filled up. Check availability and choose another time.",
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002", "P2004"].includes(error.code)
      ) {
        if (attempt < 3) continue;
        throw new HttpError(
          409,
          "Availability changed concurrently. Check times and retry the same booking.",
        );
      }
      throw error;
    }
  }
  throw new HttpError(409, "Availability changed. Please check again.");
}
export async function privateReservation(id: string, token: string | null) {
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(404, "Use your private reservation confirmation link.");
  const reservation = await db.reservation.findFirst({
    where: { id, trackingTokenHash: digest(token) },
    include: { restaurant: true },
  });
  if (!reservation) throw new HttpError(404, "Reservation not found.");
  return reservationView(
    reservation,
    readBusiness(reservation.restaurant.businessSettings).timeZone || "UTC",
  );
}
export const reservationStatusSchema = z
  .object({
    expectedStatus: z.enum(["REQUESTED", "CONFIRMED", "SEATED"]),
    status: z.enum([
      "CONFIRMED",
      "SEATED",
      "CANCELLED",
      "COMPLETED",
      "NO_SHOW",
    ]),
  })
  .strict();
export async function changeReservation(
  id: string,
  input: unknown,
  user: Actor,
) {
  assertReservationRole(user);
  const data = reservationStatusSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Restaurant" WHERE "id"=${user.restaurantId} FOR UPDATE`;
    const restaurant = await tx.restaurant.findUniqueOrThrow({
      where: { id: user.restaurantId },
    });
    const reservation = await tx.reservation.findFirst({
      where: { id, restaurantId: user.restaurantId },
    });
    if (!reservation) throw new HttpError(404, "Reservation not found.");
    if (reservation.status !== data.expectedStatus)
      throw new HttpError(
        409,
        "Reservation changed. Refresh before updating it.",
      );
    const transitions: Record<string, string[]> = {
      REQUESTED: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["SEATED", "CANCELLED", "NO_SHOW"],
      SEATED: ["COMPLETED"],
    };
    if (!transitions[reservation.status]?.includes(data.status))
      throw new HttpError(
        409,
        "This reservation status change is not allowed.",
      );
    if (reservation.tableId)
      await tx.$queryRaw`SELECT "id" FROM "Table" WHERE "id"=${reservation.tableId} FOR UPDATE`;
    if (["CONFIRMED", "SEATED"].includes(data.status)) {
      if (!reservation.tableId)
        throw new HttpError(
          409,
          "Assign a valid table before confirming or seating this legacy reservation.",
        );
      const table = await tx.table.findFirst({
        where: {
          id: reservation.tableId,
          restaurantId: user.restaurantId,
          active: true,
          seats: { gte: reservation.partySize },
        },
      });
      if (!table || reservation.endsAt <= new Date())
        throw new HttpError(
          409,
          "The reservation needs a valid current window and an active table with enough seats.",
        );
    }
    if (data.status === "SEATED") {
      const config = readBusiness(restaurant.businessSettings);
      const now = new Date();
      if (
        reservation.startsAt.getTime() >
          now.getTime() + config.earlySeatingMinutes * 60000 ||
        reservation.endsAt <= now
      )
        throw new HttpError(
          409,
          "This booking is outside its configured seating window.",
        );
      const check = await tx.order.findFirst({
        where: {
          tableId: reservation.tableId,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      });
      if (check)
        throw new HttpError(
          409,
          "Close the existing table check before seating this reservation.",
        );
      const previous = await tx.reservation.findFirst({
        where: {
          tableId: reservation.tableId,
          id: { not: id },
          ...holdConflict(now, reservation.endsAt),
        },
      });
      if (previous)
        throw new HttpError(
          409,
          "Another reservation still holds this table. Complete that booking before seating early.",
        );
    }
    if (data.status === "COMPLETED") {
      const check = await tx.order.findFirst({
        where: {
          reservationId: id,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      });
      if (check)
        throw new HttpError(
          409,
          "Close the linked POS check before completing the reservation.",
        );
    }
    if (data.status === "NO_SHOW" && reservation.startsAt > new Date())
      throw new HttpError(409, "A future booking cannot be marked no-show.");
    return tx.reservation.update({
      where: { id },
      data: { status: data.status },
      select: { id: true, status: true },
    });
  });
}
