"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Flame, Copy } from "lucide-react";
import type { TrackedOrder } from "@/lib/types";
import { money } from "@/lib/order-rules";
const labels: Record<string, string> = {
  PLACED: "Order received",
  ACCEPTED: "Accepted by the team",
  PREPARING: "On the fire",
  READY: "Ready to enjoy",
  OUT_FOR_DELIVERY: "On its way",
  COMPLETED: "Served with love",
  CANCELLED: "Order cancelled",
};
export function OrderTracker({ id }: { id: string }) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const token =
      window.location.hash.slice(1) ||
      sessionStorage.getItem(`ember-order-${id}`) ||
      "";
    sessionStorage.setItem(`ember-order-${id}`, token);
    let stopped = false;
    const url = `/api/orders/${id}?token=${encodeURIComponent(token)}`;
    const refresh = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!stopped) {
          setOrder(data);
          setError("");
        }
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error ? e.message : "Could not load your order.",
          );
      }
    };
    void refresh();
    const source = new EventSource(
      `/api/orders/${id}/stream?token=${encodeURIComponent(token)}`,
    );
    source.onmessage = (event) => {
      setOrder(JSON.parse(event.data));
      setLive(true);
      setError("");
    };
    source.onerror = () => setLive(false);
    source.addEventListener("stream-error", () => setLive(false));
    const fallback = setInterval(() => {
      void refresh();
    }, 10000);
    return () => {
      stopped = true;
      source.close();
      clearInterval(fallback);
    };
  }, [id]);
  if (!order)
    return (
      <p
        className={error ? "notice error" : ""}
        role={error ? "alert" : "status"}
      >
        {error || "Finding your order…"}
      </p>
    );
  const steps = [
    "PLACED",
    "ACCEPTED",
    "PREPARING",
    "READY",
    ...(order.fulfillment === "DELIVERY" ? ["OUT_FOR_DELIVERY"] : []),
    "COMPLETED",
  ];
  return (
    <div className="tracking-wrap">
      <div className="tracking-heading">
        <Flame size={34} />
        <p className="eyebrow">ORDER #{id.slice(-6).toUpperCase()}</p>
        <h1>{labels[order.status]}</h1>
        <p>
          {order.status === "CANCELLED"
            ? "The restaurant cancelled this order. No payment is due."
            : order.status === "COMPLETED"
              ? "Thank you for sharing your table with us."
              : "Your order is saved. We’ll keep you posted, every step of the way."}
        </p>
        <span className={`connection ${live ? "connected" : ""}`}>
          {live
            ? "Live updates connected"
            : "Reconnecting live updates · also checking every 10 seconds"}
        </span>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {order.status !== "CANCELLED" && (
        <ol className="order-timeline">
          {steps.map((step, i) => {
            const reached = order.events.some((e) => e.status === step);
            return (
              <li key={step} className={reached ? "reached" : ""}>
                <span>{reached ? <Check size={16} /> : i + 1}</span>
                <div>
                  <strong>{labels[step]}</strong>
                  {order.events.find((e) => e.status === step) && (
                    <small>
                      {new Date(
                        order.events.find((e) => e.status === step)!.createdAt,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="summary">
        <h2>Your order</h2>
        {order.items.map((item, i) => (
          <div className="summary-row" key={i}>
            <span>
              {item.quantity} × {item.name}
            </span>
            <span>{money(item.lineTotal)}</span>
          </div>
        ))}
        <div className="summary-row">
          <span>Delivery</span>
          <span>{money(order.deliveryFee)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <strong>{money(order.total)}</strong>
        </div>
        <p>
          {order.fulfillment === "DELIVERY" ? "Delivery" : "Pickup"} · Cash ·{" "}
          {order.payment?.status === "PAID"
            ? "Collected by staff"
            : order.payment?.status === "VOID"
              ? "Voided — nothing due"
              : "Payment pending"}
        </p>
      </div>
      <p className="notice">
        Keep this private link to return to your order. Anyone with the complete
        link can view its items and status.
      </p>
      <div className="hero-ctas">
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              setError("Copy the complete link from your browser address bar.");
            }
          }}
        >
          <Copy size={16} />
          {copied ? "Link copied" : "Copy tracking link"}
        </button>
        <Link className="text-link" href="/menu">
          Back to the menu ↗
        </Link>
      </div>
    </div>
  );
}
