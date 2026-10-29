import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { posTables } from "@/lib/pos-orders";
import { errorResponse, privateHeaders } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await posTables(user.restaurantId), {
      headers: privateHeaders,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
