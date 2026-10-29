import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkOrigin, errorResponse, readJson } from "@/lib/http";
import { updateStatus } from "@/lib/orders";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    return NextResponse.json(
      await updateStatus(
        (await context.params).id,
        await readJson(request),
        user,
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
