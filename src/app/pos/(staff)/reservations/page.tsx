import { redirect } from "next/navigation";
import { pageUser } from "@/lib/page-auth";
import { StaffReservations } from "@/components/staff-reservations";
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await pageUser();
  if (user.role === "KITCHEN") redirect("/pos/kitchen");
  const query = await searchParams;
  return (
    <StaffReservations
      initialDate={typeof query.date === "string" ? query.date : undefined}
    />
  );
}
