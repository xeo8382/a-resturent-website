import { NextResponse } from "next/server";
import { privateReservation } from "@/lib/reservations";
import { errorResponse, privateHeaders } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return NextResponse.json(
      await privateReservation(
        (await params).id,
        new URL(request.url).searchParams.get("token"),
      ),
      { headers: privateHeaders },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
