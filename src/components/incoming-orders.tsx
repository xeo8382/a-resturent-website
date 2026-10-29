"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Fulfillment, OrderStatus, Role } from "@prisma/client";
import { nextStatuses, money } from "@/lib/order-rules";
import { RefreshCw, Search } from "lucide-react";
type StaffOrder = {
  source: "ONLINE" | "STAFF";
  table: { label: string } | null;
  id: string;
  customerName: string;
  phone: string;
  address: string | null;
  notes: string | null;
  fulfillment: Fulfillment;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: { id: string; name: string; quantity: number; lineTotal: number }[];
  payment: { status: string } | null;
};
const statusNames: Record<string, string> = {
  PLACED: "New",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "On the way",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const actionNames: Record<string, string> = {
  ACCEPTED: "Accept order",
  PREPARING: "Start preparing",
  READY: "Mark ready",
  OUT_FOR_DELIVERY: "Send for delivery",
  COMPLETED: "Complete order",
  CANCELLED: "Cancel order",
};
export function IncomingOrders({
  role,
  kitchen = false,
  initialOrderId = null,
}: {
  role: Role;
  kitchen?: boolean;
  initialOrderId?: string | null;
}) {
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [selected, setSelected] = useState<string | null>(initialOrderId);
  const [filter, setFilter] = useState(kitchen ? "kitchen" : "active");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cash, setCash] = useState(false);
  async function refresh() {
    const r = await fetch("/api/pos/orders", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setOrders(d);
    setLoaded(true);
  }
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const r = await fetch("/api/pos/orders", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!stopped) {
          setOrders(d);
          setLoaded(true);
          setError("");
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Unable to load orders.");
      }
    };
    void load();
    const source = new EventSource("/api/pos/stream");
    source.onmessage = (e) => {
      setOrders(JSON.parse(e.data));
      setLoaded(true);
      setLive(true);
      setError("");
    };
    source.onerror = () => setLive(false);
    source.addEventListener("stream-error", () => setLive(false));
    const fallback = setInterval(() => void load(), 10000);
    return () => {
      stopped = true;
      source.close();
      clearInterval(fallback);
    };
  }, []);
  const filtered = orders.filter(
    (o) =>
      (filter === "all" ||
        (filter === "online" && o.source === "ONLINE") ||
        (filter === "staff" && o.source === "STAFF") ||
        (filter === "active" &&
          !["COMPLETED", "CANCELLED"].includes(o.status)) ||
        (filter === "kitchen" &&
          ["ACCEPTED", "PREPARING", "READY"].includes(o.status)) ||
        filter === o.status) &&
      `${o.id} ${o.customerName}`.toLowerCase().includes(search.toLowerCase()),
  );
  const current = orders.find((o) => o.id === selected);
  async function change(status: OrderStatus) {
    if (!current) return;
    if (
      status === "CANCELLED" &&
      !window.confirm("Cancel this order? This cannot be undone.")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/pos/orders/${current.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          expectedStatus: current.status,
          cashCollected: cash,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCash(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="pos-main">
      <div className="pos-heading">
        <div>
          <p className="eyebrow">THE SERVICE BOARD</p>
          <h1>{kitchen ? "Kitchen workflow" : "Incoming orders"}</h1>
          <p>Every plate has a story. Keep this one moving.</p>
        </div>
        <span className={`connection ${live ? "connected" : ""}`}>
          {live ? "Live updates" : "Reconnecting · 10s fallback"}
        </span>
      </div>
      <div className="pos-stats">
        {[
          ["New orders", orders.filter((o) => o.status === "PLACED").length],
          [
            "On the fire",
            orders.filter((o) => o.status === "PREPARING").length,
          ],
          ["Ready to go", orders.filter((o) => o.status === "READY").length],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="pos-controls">
        <div className="category-tabs">
          {(kitchen
            ? [
                ["kitchen", "Kitchen queue"],
                ["PREPARING", "Preparing"],
                ["READY", "Ready"],
              ]
            : [
                ["active", "Active"],
                ["PLACED", "New"],
                ["COMPLETED", "Completed"],
                ["all", "All recent"],
                ["online", "Online"],
                ["staff", "Staff"],
              ]
          ).map(([value, label]) => (
            <button
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or order ID"
            aria-label="Search orders"
          />
        </label>
        <button
          className="icon-button"
          aria-label="Refresh orders"
          onClick={() => void refresh().catch((e) => setError(e.message))}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="pos-orders-layout">
        <section className="order-card-grid" aria-label="Orders">
          {!loaded && !error && <p role="status">Loading orders…</p>}
          {loaded && !filtered.length && (
            <div className="empty-state">
              <h2>All quiet at the pass.</h2>
              <p>
                {kitchen
                  ? "Accepted orders appear here."
                  : "New customer orders will appear here automatically."}
              </p>
            </div>
          )}
          {filtered.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setSelected(o.id);
                setCash(false);
              }}
              className={`staff-order-card ${selected === o.id ? "selected" : ""}`}
            >
              <div className="order-card-top">
                <strong>#{o.id.slice(-6).toUpperCase()}</strong>
                <span className={`status-badge status-${o.status}`}>
                  {statusNames[o.status]}
                </span>
              </div>
              <span className="order-source">
                {o.source === "STAFF" ? "Staff order" : "Online order"}
                {o.table ? ` · ${o.table.label}` : ""}
              </span>
              <h2>{o.customerName}</h2>
              <span className="order-meta">
                {o.fulfillment.replace("_", " ").toLowerCase()} ·{" "}
                {new Date(o.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div className="order-preview">
                {o.items.slice(0, 3).map((i) => (
                  <p key={i.id}>
                    <span>{i.quantity}×</span>
                    {i.name}
                  </p>
                ))}
                {o.items.length > 3 && <p>+{o.items.length - 3} more</p>}
              </div>
              <div className="order-card-total">
                <span>{o.items.reduce((s, i) => s + i.quantity, 0)} items</span>
                <strong>{money(o.total)}</strong>
              </div>
            </button>
          ))}
        </section>
        <aside className="order-detail-panel">
          {current ? (
            <>
              <div className="order-card-top">
                <h2>Order details</h2>
                <span>#{current.id.slice(-6).toUpperCase()}</span>
              </div>
              <span className={`status-badge status-${current.status}`}>
                {statusNames[current.status]}
              </span>
              <h3>{current.customerName}</h3>
              {current.phone && (
                <a href={`tel:${current.phone}`}>{current.phone}</a>
              )}
              <p>
                {current.fulfillment === "DELIVERY"
                  ? current.address
                  : current.fulfillment === "DINE_IN"
                    ? `Dine-in · ${current.table?.label ?? "Unassigned"}`
                    : "Pickup at restaurant"}
              </p>
              {current.notes && (
                <p className="kitchen-note">
                  <strong>Kitchen note</strong>
                  <br />
                  {current.notes}
                </p>
              )}
              <div className="detail-order-items">
                {current.items.map((i) => (
                  <div className="summary-row" key={i.id}>
                    <span>
                      {i.quantity} × {i.name}
                    </span>
                    <strong>{money(i.lineTotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="summary-row total">
                <span>Total incl. delivery</span>
                <strong>{money(current.total)}</strong>
              </div>
              <p className="muted">
                Cash · {current.payment?.status.toLowerCase()}
              </p>
              {nextStatuses(current.status, current.fulfillment).includes(
                "COMPLETED",
              ) &&
                role !== "KITCHEN" && (
                  <label className="cash-confirm">
                    <input
                      type="checkbox"
                      checked={cash}
                      onChange={(e) => setCash(e.target.checked)}
                    />{" "}
                    I have collected {money(current.total)} in cash
                  </label>
                )}
              {role !== "KITCHEN" && (
                <Link
                  className="pos-receipt-link"
                  href={`/pos/receipts/${current.id}`}
                >
                  View receipt / order ticket ↗
                </Link>
              )}
              <div className="order-actions">
                {nextStatuses(current.status, current.fulfillment)
                  .filter(
                    (s) =>
                      role !== "KITCHEN" ||
                      (current.status === "ACCEPTED" && s === "PREPARING") ||
                      (current.status === "PREPARING" && s === "READY"),
                  )
                  .map((s) => (
                    <button
                      key={s}
                      className={`button wide ${s === "CANCELLED" ? "secondary" : ""}`}
                      disabled={busy || (s === "COMPLETED" && !cash)}
                      onClick={() => void change(s)}
                    >
                      {busy ? "Updating…" : actionNames[s]}
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FlameIcon />
              <h2>A closer look.</h2>
              <p>
                Select an order to view details
                <br />
                and update its progress.
              </p>
            </div>
          )}
        </aside>
      </div>
      <p className="sample-note">
        Active orders and orders updated in the last 24 hours · Up to 200 most
        recent orders.
      </p>
    </main>
  );
}
function FlameIcon() {
  return <span className="empty-flame">♨</span>;
}
