import { NextResponse } from "next/server";
import { availability } from "@/lib/reservations";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return NextResponse.json(
      await availability(
        params.get("date") || "",
        Number(params.get("partySize")),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
