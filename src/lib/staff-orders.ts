import { db } from "./db";
import { requireUser } from "./auth";
export async function staffOrders() {
  const user = await requireUser();
  return db.order.findMany({
    where: {
      restaurantId: user.restaurantId,
      OR: [
        { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        { updatedAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      ],
    },
    include: { items: true, payment: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
