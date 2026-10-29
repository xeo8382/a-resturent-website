import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const restaurant = await db.restaurant.findUnique({
      where: { slug: "ember-table" },
      select: {
        name: true,
        currency: true,
        deliveryFee: true,
        categories: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            items: {
              orderBy: { name: "asc" },
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                price: true,
                image: true,
                allergens: true,
                available: true,
                featured: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(restaurant);
  } catch (e) {
    return errorResponse(e);
  }
}
