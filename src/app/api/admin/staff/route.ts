import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { checkOrigin, errorResponse, readJson, HttpError } from "@/lib/http";
const schema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(12).max(200),
    role: z.enum(["STAFF", "KITCHEN", "MANAGER"]),
  })
  .strict();
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(["ADMIN"]);
    const data = schema.parse(await readJson(request));
    await db.user.create({
      data: {
        restaurantId: user.restaurantId,
        name: data.name,
        email: data.email,
        role: data.role,
        passwordHash: hashPassword(data.password),
      },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return errorResponse(new HttpError(409, "Email is already registered."));
    return errorResponse(e);
  }
}
