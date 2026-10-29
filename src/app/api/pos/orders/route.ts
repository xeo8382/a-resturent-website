import { requireUser } from "@/lib/auth";
import { serviceRoles } from "@/lib/pos-validation";
import { createStaffOrder } from "@/lib/pos-orders";
import { checkOrigin, readJson } from "@/lib/http";
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

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(serviceRoles);
    return NextResponse.json(
      await createStaffOrder(await readJson(request), user),
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
