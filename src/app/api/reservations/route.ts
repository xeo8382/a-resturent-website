import { NextResponse } from "next/server";
import { createReservation } from "@/lib/reservations";
import {
  checkOrigin,
  errorResponse,
  readJson,
  privateHeaders,
} from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    return NextResponse.json(await createReservation(await readJson(request)), {
      status: 201,
      headers: privateHeaders,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
