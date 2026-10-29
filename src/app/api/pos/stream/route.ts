import { staffOrders } from "@/lib/staff-orders";
import { requireUser } from "@/lib/auth";
import { eventStream } from "@/lib/stream";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    await requireUser();
    return eventStream(request, staffOrders);
  } catch (e) {
    return errorResponse(e);
  }
}
