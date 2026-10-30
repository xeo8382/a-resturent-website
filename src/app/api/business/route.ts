import { NextResponse } from "next/server";
import { publicBusiness } from "@/lib/business";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await publicBusiness(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
