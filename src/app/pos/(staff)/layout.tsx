import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { StaffShell } from "@/components/staff-shell";
export const dynamic = "force-dynamic";
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/pos/login");
  return (
    <StaffShell name={user.name} role={user.role}>
      {children}
    </StaffShell>
  );
}
