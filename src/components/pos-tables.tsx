"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Armchair, ArrowUpRight, RefreshCw } from "lucide-react";
import type { PosTable } from "@/lib/pos-types";
import { money } from "@/lib/order-rules";
export function PosTables({ canCreate }: { canCreate: boolean }) {
  const [tables, setTables] = useState<PosTable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const r = await fetch("/api/pos/tables", { cache: "no-store" });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setTables(data);
    setLoaded(true);
    setError("");
  }, []);
  useEffect(() => {
    const load = () => void refresh().catch((e) => setError(e.message));
    load();
    const timer = setInterval(load, 5000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [refresh]);
  return (
    <main id="main" className="pos-main">
      <div className="pos-heading">
        <div>
          <p className="eyebrow">A PLACE FOR EVERY GUEST</p>
          <h1>Table management</h1>
          <p>
            One active check per table. Tables reopen when their check is
            completed or cancelled.
          </p>
        </div>
        <button
          className="pos-outline"
          onClick={() => void refresh().catch((e) => setError(e.message))}
        >
          <RefreshCw size={15} />
          Refresh floor
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="floor-legend">
        <span>
          <i />
          Available
        </span>
        <span>
          <i />
          Occupied
        </span>
        <small>Updates every 5 seconds</small>
      </div>
      {!loaded && !error && <p role="status">Loading the floor…</p>}
      <div className="floor-grid">
        {tables.map((t) => (
          <article
            key={t.id}
            className={`floor-table ${t.orders.length || t.reservationHold ? "occupied" : ""}`}
          >
            <div>
              <span className="table-occupancy">
                {t.orders.length
                  ? "Occupied"
                  : t.reservationHold
                    ? "Reserved"
                    : "Available"}
              </span>
              <Armchair size={21} />
            </div>
            <h2>{t.label}</h2>
            <p>{t.seats} seats</p>
            {t.orders.length ? (
              t.orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/pos/orders?order=${o.id}`}
                  className="floor-order"
                >
                  <strong>
                    #{o.id.slice(-6).toUpperCase()} · {money(o.total)}
                  </strong>
                  <span>
                    {o.customerName} ·{" "}
                    {o.status.toLowerCase().replaceAll("_", " ")}
                    <ArrowUpRight size={15} />
                  </span>
                </Link>
              ))
            ) : t.reservationHold ? (
              canCreate ? (
                <Link
                  className="floor-order"
                  href={
                    t.reservationHold.date
                      ? `/pos/reservations?date=${t.reservationHold.date}`
                      : "/pos/reservations"
                  }
                >
                  <strong>Reservation hold</strong>
                  <span>
                    Manage booking <ArrowUpRight size={15} />
                  </span>
                </Link>
              ) : (
                <p>Held for a reservation</p>
              )
            ) : canCreate ? (
              <Link className="floor-order" href={`/pos?table=${t.id}`}>
                <strong>Open a new check</strong>
                <span>
                  Select this table <ArrowUpRight size={15} />
                </span>
              </Link>
            ) : (
              <p>No active order</p>
            )}
          </article>
        ))}
      </div>
      {loaded && !tables.length && (
        <div className="empty-state">
          <h2>No tables configured.</h2>
          <p>Ask an administrator to configure the restaurant’s floor.</p>
        </div>
      )}
    </main>
  );
}
