import { redirect } from "next/navigation";
import { pageUser } from "@/lib/page-auth";
import { PosComposer } from "@/components/pos-composer";
export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const user = await pageUser();
  if (user.role === "KITCHEN") redirect("/pos/kitchen");
  return (
    <PosComposer userId={user.id} initialTable={(await searchParams).table} />
  );
}
