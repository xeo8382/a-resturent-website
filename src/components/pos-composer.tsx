"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { PosCategory, PosTable } from "@/lib/pos-types";
import {
  customerPhoto,
  customerPhotoStyle,
  customerPhotoFrameStyle,
} from "@/lib/customer-photos";
import { money } from "@/lib/order-rules";
type Draft = {
  items: { menuItemId: string; quantity: number }[];
  fulfillment: "DINE_IN" | "PICKUP";
  tableId: string;
  customerName: string;
  notes: string;
};
const empty: Draft = {
  items: [],
  fulfillment: "DINE_IN",
  tableId: "",
  customerName: "",
  notes: "",
};
export function PosComposer({
  userId,
  initialTable,
  reservationId,
  initialGuest,
}: {
  userId: string;
  initialTable?: string;
  reservationId?: string;
  initialGuest?: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const hydrated = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const storage = `ember-pos-${userId}${reservationId ? `-${reservationId}` : ""}`;
  const refresh = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/pos/menu", { cache: "no-store" }),
      fetch("/api/pos/tables", { cache: "no-store" }),
    ]);
    const data = await Promise.all(responses.map((r) => r.json()));
    if (responses.some((r) => !r.ok))
      throw new Error(
        data.find((_, i) => !responses[i].ok)?.error ||
          "Unable to load the service menu.",
      );
    setCategories(data[0]);
    setTables(data[1]);
    if (!hydrated.current) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storage) || "null");
        if (
          saved?.draft &&
          Array.isArray(saved.draft.items) &&
          ["DINE_IN", "PICKUP"].includes(saved.draft.fulfillment)
        ) {
          setDraft({
            ...empty,
            ...saved.draft,
            ...(initialTable
              ? { tableId: initialTable, fulfillment: "DINE_IN" }
              : {}),
          });
          attempt.current = saved.attempt ?? null;
        } else if (initialTable)
          setDraft({
            ...empty,
            tableId: initialTable,
            customerName: initialGuest || "",
          });
      } catch {
        if (initialTable)
          setDraft({
            ...empty,
            tableId: initialTable,
            customerName: initialGuest || "",
          });
      }
      hydrated.current = true;
    }
    setLoaded(true);
  }, [storage, initialTable, initialGuest]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await refresh();
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Unable to load menu.");
      }
    };
    void load();
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (loaded)
      try {
        sessionStorage.setItem(
          storage,
          JSON.stringify({ draft, attempt: attempt.current }),
        );
      } catch {
        /* The in-tab attempt remains available if storage is disabled. */
      }
  }, [draft, loaded, storage]);
  const menu = categories.flatMap((c) => c.items);
  const shown = categories
    .filter((c) => category === "all" || c.id === category)
    .flatMap((c) => c.items)
    .filter((i) =>
      `${i.name} ${i.description}`.toLowerCase().includes(search.toLowerCase()),
    );
  const subtotal = draft.items.reduce(
    (s, l) =>
      s + (menu.find((i) => i.id === l.menuItemId)?.price ?? 0) * l.quantity,
    0,
  );
  const unavailable = draft.items.some(
    (l) => !menu.find((i) => i.id === l.menuItemId)?.available,
  );
  const table = tables.find((t) => t.id === draft.tableId);
  const tableInvalid =
    draft.fulfillment === "DINE_IN" &&
    (!table ||
      !!table.orders.length ||
      (!!table.reservationHold && table.reservationHold.id !== reservationId));
  function quantity(id: string, n: number) {
    setDraft((d) => ({
      ...d,
      items:
        n <= 0
          ? d.items.filter((i) => i.menuItemId !== id)
          : d.items.some((i) => i.menuItemId === id)
            ? d.items.map((i) =>
                i.menuItemId === id ? { ...i, quantity: Math.min(n, 20) } : i,
              )
            : [...d.items, { menuItemId: id, quantity: 1 }],
    }));
  }
  async function send() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        fulfillment: draft.fulfillment,
        tableId: draft.fulfillment === "DINE_IN" ? draft.tableId : null,
        customerName: draft.customerName.trim() || "Walk-in guest",
        notes: draft.notes,
        items: draft.items,
        ...(reservationId ? { reservationId } : {}),
      };
      const fingerprint = JSON.stringify(payload);
      if (!attempt.current || attempt.current.fingerprint !== fingerprint)
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      try {
        sessionStorage.setItem(
          storage,
          JSON.stringify({ draft, attempt: attempt.current }),
        );
      } catch {}
      const r = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          idempotencyKey: attempt.current.key,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      try {
        sessionStorage.removeItem(storage);
      } catch {}
      attempt.current = null;
      setDraft(empty);
      router.push(`/pos/orders?order=${data.id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Order was not confirmed. Retry the same draft safely.",
      );
      void refresh().catch(() => {});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main id="main" className="pos-main pos-sale">
      <div className="pos-heading">
        <div>
          <p className="eyebrow">MAKE EVERY PLATE COUNT</p>
          <h1>New order</h1>
          <p>Choose something good. We’ll take it from here.</p>
        </div>
        <button
          className="pos-outline"
          onClick={() =>
            void refresh()
              .then(() => setError(""))
              .catch((e) => setError(e.message))
          }
        >
          <RefreshCw size={15} />
          Refresh menu & tables
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!loaded ? (
        <div className="pos-loading" role="status">
          {error
            ? "Menu unavailable. Use Refresh menu & tables to retry."
            : "Loading menu and tables…"}
        </div>
      ) : (
        <div className="sale-layout">
          <section className="sale-menu">
            <div className="sale-search">
              <Search size={18} />
              <input
                aria-label="Search POS menu"
                placeholder="Search a dish, find a favourite…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span>{menu.length} dishes</span>
            </div>
            <div className="pos-food-categories" aria-label="Food categories">
              <button
                className={category === "all" ? "active" : ""}
                aria-pressed={category === "all"}
                onClick={() => setCategory("all")}
              >
                All dishes <span>{menu.length}</span>
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  className={category === c.id ? "active" : ""}
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                >
                  {c.name}
                  <span>{c.items.length}</span>
                </button>
              ))}
            </div>
            <div className="pos-food-grid">
              {shown.map((item, index) => {
                const line = draft.items.find((i) => i.menuItemId === item.id);
                return (
                  <button
                    className={`pos-food-card ${!item.available ? "sold-out" : ""}`}
                    key={item.id}
                    disabled={
                      !item.available || busy || (line?.quantity ?? 0) >= 20
                    }
                    aria-label={`Add ${item.name} to POS order`}
                    onClick={() => quantity(item.id, (line?.quantity ?? 0) + 1)}
                  >
                    <div className="pos-food-photo">
                      <div
                        className="pos-photo-frame"
                        style={customerPhotoFrameStyle(item)}
                      >
                        <Image
                          src={customerPhoto(item).src}
                          alt={customerPhoto(item).alt}
                          fill
                          sizes="(max-width: 900px) 45vw, 240px"
                          loading={index < 3 ? "eager" : "lazy"}
                          style={customerPhotoStyle(item)}
                        />
                      </div>
                      {line && (
                        <span className="pos-item-count">
                          {line.quantity} in order
                        </span>
                      )}
                      {!item.available && (
                        <span className="pos-sold-label">Unavailable</span>
                      )}
                    </div>
                    <div className="pos-food-info">
                      <h2>{item.name}</h2>
                      <p>
                        {item.allergens.length
                          ? `Contains ${item.allergens.join(", ")}`
                          : "No listed allergens"}
                      </p>
                      <div>
                        <strong>{money(item.price)}</strong>
                        <span className="pos-add-circle">
                          <Plus size={17} />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!shown.length && (
              <div className="empty-state">
                <Search />
                <h2>Nothing on this plate.</h2>
                <p>Try another category or search.</p>
              </div>
            )}
          </section>
          <aside className="sale-check">
            <div className="check-title">
              <div>
                <span className="eyebrow">CURRENT CHECK</span>
                <h2>
                  {draft.fulfillment === "DINE_IN"
                    ? (table?.label ?? "Select a table")
                    : "Walk-in pickup"}
                </h2>
              </div>
              <ShoppingBag size={23} />
            </div>
            <div className="check-scroll">
              <fieldset disabled={busy} className="check-options">
                <legend className="sr-only">Order details</legend>
                <div className="pos-mode-tabs">
                  <button
                    className={draft.fulfillment === "DINE_IN" ? "active" : ""}
                    onClick={() =>
                      setDraft((d) => ({ ...d, fulfillment: "DINE_IN" }))
                    }
                  >
                    Dine-in
                  </button>
                  <button
                    className={draft.fulfillment === "PICKUP" ? "active" : ""}
                    onClick={() =>
                      setDraft((d) => ({ ...d, fulfillment: "PICKUP" }))
                    }
                  >
                    Pickup
                  </button>
                </div>
                {draft.fulfillment === "DINE_IN" && (
                  <label>
                    Table
                    <select
                      aria-label="Select table"
                      value={draft.tableId}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, tableId: e.target.value }))
                      }
                    >
                      <option value="">Choose an available table</option>
                      {tables.map((t) => (
                        <option
                          key={t.id}
                          value={t.id}
                          disabled={
                            !!t.orders.length ||
                            (!!t.reservationHold &&
                              t.reservationHold.id !== reservationId)
                          }
                        >
                          {t.label} · {t.seats} seats
                          {t.orders.length
                            ? " · Occupied"
                            : t.reservationHold
                              ? " · Reserved"
                              : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Guest name <span>(optional)</span>
                  <input
                    aria-label="Guest name"
                    maxLength={80}
                    value={draft.customerName}
                    placeholder="Walk-in guest"
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, customerName: e.target.value }))
                    }
                  />
                </label>
              </fieldset>
              <div className="check-items">
                {!draft.items.length ? (
                  <div className="empty-check">
                    <ShoppingBag size={28} />
                    <h3>A little room for good food.</h3>
                    <p>Tap a dish to start the order.</p>
                  </div>
                ) : (
                  draft.items.map((line) => {
                    const item = menu.find((i) => i.id === line.menuItemId);
                    return (
                      <article key={line.menuItemId}>
                        <div>
                          <strong>{item?.name ?? "Removed dish"}</strong>
                          <span>
                            {money((item?.price ?? 0) * line.quantity)}
                          </span>
                        </div>
                        {!item?.available && (
                          <p className="pos-item-error">
                            Unavailable — remove to continue
                          </p>
                        )}
                        <div className="check-item-controls">
                          <button
                            aria-label={`Decrease ${item?.name} POS quantity`}
                            disabled={busy}
                            onClick={() =>
                              quantity(line.menuItemId, line.quantity - 1)
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span>{line.quantity}</span>
                          <button
                            aria-label={`Increase ${item?.name} POS quantity`}
                            disabled={busy || line.quantity >= 20}
                            onClick={() =>
                              quantity(line.menuItemId, line.quantity + 1)
                            }
                          >
                            <Plus size={14} />
                          </button>
                          <span>{money(item?.price ?? 0)} each</span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
              <label className="check-note">
                Kitchen note
                <textarea
                  aria-label="Kitchen note"
                  maxLength={500}
                  value={draft.notes}
                  disabled={busy}
                  placeholder="Allergies or special requests…"
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="check-totals">
              <div>
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <div>
                <span>Delivery fee</span>
                <span>Not applicable</span>
              </div>
              <div className="check-grand-total">
                <span>Total estimate</span>
                <strong>{money(subtotal)}</strong>
              </div>
            </div>
            <p className="pos-help">
              Cash on service · Final prices confirmed when sent.
            </p>
            {tableInvalid && draft.fulfillment === "DINE_IN" && (
              <p className="pos-help">
                Choose an available table before sending.
              </p>
            )}
            {unavailable && (
              <p className="pos-item-error" role="alert">
                Remove unavailable items to continue.
              </p>
            )}
            <button
              className="button wide"
              disabled={
                busy || !draft.items.length || unavailable || tableInvalid
              }
              onClick={() => void send()}
            >
              {busy ? (
                "Sending order…"
              ) : (
                <>
                  Send to kitchen <ArrowRight size={17} />
                </>
              )}
            </button>
            <button
              className="clear-check"
              disabled={busy || !draft.items.length}
              onClick={() => {
                if (window.confirm("Clear this unsent draft?")) {
                  attempt.current = null;
                  setDraft(empty);
                }
              }}
            >
              <Trash2 size={13} />
              Clear draft
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
