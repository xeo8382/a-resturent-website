import { redirect } from "next/navigation";
import { pageUser } from "@/lib/page-auth";
import { StaffShell } from "@/components/staff-shell";
import { BusinessSettings } from "@/components/business-settings";
export const metadata = { title: "Business configuration" };
export default async function BusinessPage() {
  const user = await pageUser();
  if (!["ADMIN", "MANAGER"].includes(user.role)) redirect("/pos/orders");
  return (
    <StaffShell name={user.name} role={user.role}>
      <BusinessSettings />
    </StaffShell>
  );
}
