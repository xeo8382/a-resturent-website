import { pageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
export default async function TablesPage() {
  const user = await pageUser();
  const tables = await db.table.findMany({
    where: { restaurantId: user.restaurantId },
    include: {
      orders: {
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        select: { id: true },
      },
    },
    orderBy: { label: "asc" },
  });
  return (
    <main id="main" className="pos-main">
      <div className="pos-heading">
        <div>
          <p className="eyebrow">THE FLOOR</p>
          <h1>Tables</h1>
          <p>Read-only floor overview from the database.</p>
        </div>
      </div>
      <div className="table-grid">
        {tables.map((t) => (
          <article key={t.id}>
            <span className="eyebrow">
              {t.orders.length ? "ACTIVE ORDER" : "NO ACTIVE ORDER"}
            </span>
            <h2>{t.label}</h2>
            <p>{t.seats} seats</p>
          </article>
        ))}
      </div>
      <p className="notice">
        Table assignment, dine-in ordering, and reservations are not implemented
        in Phase 1. Customer checkout supports delivery and pickup.
      </p>
    </main>
  );
}
