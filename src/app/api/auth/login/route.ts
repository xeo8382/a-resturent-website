import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse, HttpError, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { digest, verifyPassword, hashPassword } from "@/lib/crypto";
import { createSession } from "@/lib/auth";
const dummyHash = hashPassword("unused-password-for-timing-check");
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const data = loginSchema.parse(await readJson(request));
    const key = digest(data.email);
    const now = new Date();
    // Atomic, database-backed account throttle shared across server instances.
    await db.loginThrottle.deleteMany({
      where: { key, resetAt: { lte: now } },
    });
    const throttle = await db.loginThrottle.upsert({
      where: { key },
      create: { key, resetAt: new Date(Date.now() + 15 * 60_000) },
      update: { attempts: { increment: 1 } },
    });
    if (throttle.attempts > 10)
      throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
    const user = await db.user.findUnique({ where: { email: data.email } });
    const valid = verifyPassword(
      data.password,
      user?.passwordHash ?? dummyHash,
    );
    if (!valid || !user?.active)
      throw new HttpError(401, "Email or password is incorrect.");
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
