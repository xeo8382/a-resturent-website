import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readBusiness } from "@/lib/business-config";
import { saveBusiness } from "@/lib/business";
import {
  checkOrigin,
  errorResponse,
  readJson,
  privateHeaders,
} from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireUser(["ADMIN", "MANAGER"]);
    const restaurant = await db.restaurant.findUniqueOrThrow({
      where: { id: user.restaurantId },
    });
    const tables = await db.table.findMany({
      where: { restaurantId: user.restaurantId },
      orderBy: { label: "asc" },
    });
    return NextResponse.json(
      {
        settings: readBusiness(restaurant.businessSettings),
        version: restaurant.businessVersion,
        deliveryFee: restaurant.deliveryFee,
        tables,
      },
      { headers: privateHeaders },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(["ADMIN", "MANAGER"]);
    return NextResponse.json(
      await saveBusiness(await readJson(request), user),
      { headers: privateHeaders },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
