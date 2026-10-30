import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { serviceRoles } from "@/lib/reservations";
import { db } from "@/lib/db";
import { readBusiness } from "@/lib/business-config";
import { calendarDate, localParts } from "@/lib/reservation-time";
import { errorResponse, privateHeaders } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireUser([...serviceRoles]);
    const restaurant = await db.restaurant.findUniqueOrThrow({
      where: { id: user.restaurantId },
    });
    const config = readBusiness(restaurant.businessSettings),
      zone = config.timeZone || "UTC";
    const date =
      new URL(request.url).searchParams.get("date") ||
      localParts(new Date(), zone).date;
    calendarDate(date);
    // Broad UTC bounds, followed by exact local-calendar filtering, also cover DST.
    const pivot = Date.parse(`${date}T00:00:00Z`);
    const reservations = await db.reservation.findMany({
      where: {
        restaurantId: user.restaurantId,
        startsAt: {
          gte: new Date(pivot - 86400000),
          lt: new Date(pivot + 172800000),
        },
      },
      select: {
        id: true,
        tableId: true,
        name: true,
        phone: true,
        email: true,
        notes: true,
        partySize: true,
        status: true,
        startsAt: true,
        endsAt: true,
        table: { select: { label: true } },
        order: { select: { id: true, status: true } },
      },
      orderBy: { startsAt: "asc" },
    });
    return NextResponse.json(
      {
        timeZone: zone,
        date,
        reservations: reservations.filter(
          (r) => localParts(r.startsAt, zone).date === date,
        ),
      },
      { headers: privateHeaders },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
