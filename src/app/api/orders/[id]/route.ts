import { NextResponse } from "next/server";
import { errorResponse, privateHeaders } from "@/lib/http";
import { trackedOrder, publicOrder } from "@/lib/orders";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return NextResponse.json(
      publicOrder(
        await trackedOrder(
          (await context.params).id,
          new URL(request.url).searchParams.get("token"),
        ),
      ),
      { headers: privateHeaders },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
