import { NextResponse } from "next/server";
import { checkOrigin, errorResponse, readJson } from "@/lib/http";
import { createOrder } from "@/lib/orders";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    return NextResponse.json(await createOrder(await readJson(request)), {
      status: 201,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
