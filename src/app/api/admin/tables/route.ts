import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { saveTable } from "@/lib/business";
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
    const user = await requireUser(["ADMIN", "MANAGER"]);
    return NextResponse.json(await saveTable(await readJson(request), user), {
      headers: privateHeaders,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
