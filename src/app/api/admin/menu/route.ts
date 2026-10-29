import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { manageMenu } from "@/lib/menu-management";
import { checkOrigin, errorResponse, readJson } from "@/lib/http";
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(["ADMIN", "MANAGER"]);
    return NextResponse.json(await manageMenu(await readJson(request), user));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(["ADMIN", "MANAGER"]);
    return NextResponse.json(
      await manageMenu(await readJson(request), user, true),
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
