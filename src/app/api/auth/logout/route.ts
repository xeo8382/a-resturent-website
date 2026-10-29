import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie } from "@/lib/auth";
import { digest } from "@/lib/crypto";
import { checkOrigin, errorResponse } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    const token = jar.get(sessionCookie)?.value;
    if (token)
      await db.session.deleteMany({ where: { tokenHash: digest(token) } });
    jar.delete(sessionCookie);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
