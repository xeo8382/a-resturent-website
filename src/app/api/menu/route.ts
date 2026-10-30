import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { readBusiness } from "@/lib/business-config";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const restaurant = await db.restaurant.findUnique({
      where: { slug: "ember-table" },
      select: {
        name: true,
        currency: true,
        deliveryFee: true,
        businessSettings: true,
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
    if (!restaurant)
      return NextResponse.json(
        { error: "Restaurant menu has not been configured." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    const { businessSettings, ...menu } = restaurant;
    return NextResponse.json(
      { ...menu, business: readBusiness(businessSettings) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
