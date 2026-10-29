import { pageUser } from "@/lib/page-auth";
import { IncomingOrders } from "@/components/incoming-orders";
export default async function OrdersPage() {
  const user = await pageUser();
  return <IncomingOrders role={user.role} />;
}
