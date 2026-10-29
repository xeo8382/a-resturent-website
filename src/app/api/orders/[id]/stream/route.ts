import { trackedOrder, publicOrder } from "@/lib/orders";
import { eventStream } from "@/lib/stream";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get("token");
    await trackedOrder(id, token);
    return eventStream(request, async () =>
      publicOrder(await trackedOrder(id, token)),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
