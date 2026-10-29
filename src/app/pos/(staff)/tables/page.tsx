import { pageUser } from "@/lib/page-auth";
import { PosTables } from "@/components/pos-tables";
export default async function TablesPage() {
  const user = await pageUser();
  return <PosTables canCreate={user.role !== "KITCHEN"} />;
}
