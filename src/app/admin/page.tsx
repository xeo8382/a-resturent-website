import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { StaffShell } from "@/components/staff-shell";
import { AdminPanel } from "@/components/admin-panel";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/pos/login");
  if (!["ADMIN", "MANAGER"].includes(user.role)) redirect("/pos/orders");
  const items = await db.menuItem.findMany({
    where: { restaurantId: user.restaurantId },
    select: { id: true, name: true, price: true, available: true },
    orderBy: { name: "asc" },
  });
  const staff = await db.user.findMany({
    where: { restaurantId: user.restaurantId },
    select: { id: true, name: true, role: true, active: true },
  });
  return (
    <StaffShell name={user.name} role={user.role}>
      <main id="main" className="pos-main">
        <div className="pos-heading">
          <div>
            <p className="eyebrow">BEHIND THE SCENES</p>
            <h1>Restaurant management</h1>
            <p>
              Live menu changes apply to new orders. Existing orders keep their
              original prices.
            </p>
          </div>
        </div>
        <AdminPanel items={items} canCreateStaff={user.role === "ADMIN"} />
        <section className="staff-list">
          <h2>Staff</h2>
          {staff.map((s) => (
            <p key={s.id}>
              {s.name}{" "}
              <span>
                {s.role} · {s.active ? "Active" : "Inactive"}
              </span>
            </p>
          ))}
        </section>
        <p className="notice">
          Phase 1 management supports pricing, availability and staff creation.
          Menu content editing, staff role changes, password resets and account
          deactivation remain future work.
        </p>
      </main>
    </StaffShell>
  );
}
