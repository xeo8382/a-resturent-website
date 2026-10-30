import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { db } from "./db";
import { digest, newToken } from "./crypto";
import { HttpError } from "./http";
export const sessionCookie = "ember_session";
export async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: true },
  });
  return session && session.expiresAt > new Date() && session.user.active
    ? session.user
    : null;
}
export async function requireUser(
  roles: Role[] = ["ADMIN", "MANAGER", "STAFF", "KITCHEN"],
) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  if (!roles.includes(user.role))
    throw new HttpError(403, "You do not have permission.");
  return user;
}
export async function createSession(userId: string, validatedOrigin?: string) {
  const token = newToken();
  await db.session.create({
    data: {
      userId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 8 * 3600_000),
    },
  });
  (await cookies()).set(sessionCookie, token, {
    httpOnly: true,
    // Codespaces terminates HTTPS at its proxy, including for next dev.
    // The origin comes from checkOrigin, never X-Forwarded-Proto.
    secure:
      process.env.NODE_ENV === "production" ||
      validatedOrigin?.startsWith("https://") === true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 3600,
  });
}
