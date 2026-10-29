import { pageUser } from "@/lib/page-auth";
import { IncomingOrders } from "@/components/incoming-orders";
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await pageUser();
  const id = (await searchParams).order;
  return <IncomingOrders key={id} initialOrderId={id} role={user.role} />;
}
