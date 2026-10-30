import { redirect } from "next/navigation";
import { pageUser } from "@/lib/page-auth";
import { PosComposer } from "@/components/pos-composer";
import { db } from "@/lib/db";
export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; reservation?: string }>;
}) {
  const user = await pageUser();
  if (user.role === "KITCHEN") redirect("/pos/kitchen");
  const query = await searchParams;
  const booking = query.reservation
    ? await db.reservation.findFirst({
        where: {
          id: query.reservation,
          restaurantId: user.restaurantId,
          status: "SEATED",
        },
      })
    : null;
  if (query.reservation && !booking) redirect("/pos/reservations");
  return (
    <PosComposer
      userId={user.id}
      initialTable={booking?.tableId || query.table}
      initialGuest={booking?.name}
      reservationId={booking?.id}
    />
  );
}
