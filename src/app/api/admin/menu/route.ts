import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse, readJson, HttpError } from "@/lib/http";
const schema = z
  .object({
    id: z.string(),
    price: z.number().int().min(100).max(10000000),
    available: z.boolean(),
  })
  .strict();
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(["ADMIN", "MANAGER"]);
    const data = schema.parse(await readJson(request));
    const result = await db.menuItem.updateMany({
      where: { id: data.id, restaurantId: user.restaurantId },
      data: { price: data.price, available: data.available },
    });
    if (!result.count) throw new HttpError(404, "Menu item not found.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
