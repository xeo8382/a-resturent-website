import { pageUser } from "@/lib/page-auth";
import { IncomingOrders } from "@/components/incoming-orders";
export default async function KitchenPage() {
  const user = await pageUser();
  return <IncomingOrders role={user.role} kitchen />;
}
