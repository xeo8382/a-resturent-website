import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { staffReceipt } from "@/lib/pos-orders";
import { serviceRoles } from "@/lib/pos-validation";
import { errorResponse, privateHeaders } from "@/lib/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(serviceRoles);
    return NextResponse.json(await staffReceipt((await params).id, user), {
      headers: privateHeaders,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
