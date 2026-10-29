import { NextResponse } from "next/server";
import { errorResponse, privateHeaders } from "@/lib/http";
import { staffOrders } from "@/lib/staff-orders";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await staffOrders(), { headers: privateHeaders });
  } catch (e) {
    return errorResponse(e);
  }
}
