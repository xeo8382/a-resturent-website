import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { changeReservation, serviceRoles } from "@/lib/reservations";
import {
  checkOrigin,
  errorResponse,
  readJson,
  privateHeaders,
} from "@/lib/http";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser([...serviceRoles]);
    return NextResponse.json(
      await changeReservation((await params).id, await readJson(request), user),
      { headers: privateHeaders },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
