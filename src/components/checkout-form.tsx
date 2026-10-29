"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "./providers";
import { useMenu } from "./menu-browser";
import { money } from "@/lib/order-rules";
export function CheckoutForm() {
  const { lines, ready, clear } = useCart();
  const { menu, error: menuError } = useMenu();
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">(
    "DELIVERY",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const router = useRouter();
  if (menuError)
    return (
      <p role="alert" className="notice error">
        {menuError}
      </p>
    );
  if (!ready || !menu) return <p role="status">Preparing checkout…</p>;
  if (!lines.length)
    return (
      <div className="empty-state">
        <p>Your bag is empty.</p>
        <Link className="button" href="/menu">
          Explore the menu ↗
        </Link>
      </div>
    );
  const items = menu.categories.flatMap((c) => c.items);
  const subtotal = lines.reduce(
    (s, l) =>
      s + (items.find((i) => i.id === l.menuItemId)?.price ?? 0) * l.quantity,
    0,
  );
  const invalid = lines.some(
    (l) => !items.find((i) => i.id === l.menuItemId)?.available,
  );
  const fee = fulfillment === "DELIVERY" ? menu.deliveryFee : 0;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: form.get("customerName"),
      phone: form.get("phone"),
      address: form.get("address") ?? "",
      notes: form.get("notes"),
      fulfillment,
      items: lines,
    };
    try {
      // Persist the exact attempt before sending: a network retry reuses both key and private token.
      const fingerprint = JSON.stringify(payload);
      let attempt: {
        fingerprint: string;
        idempotencyKey: string;
        trackingToken: string;
      } | null = null;
      try {
        attempt = JSON.parse(
          sessionStorage.getItem("ember-checkout-attempt") ?? "null",
        );
      } catch {
        /* Replace invalid local attempt. */
      }
      if (!attempt || attempt.fingerprint !== fingerprint) {
        const token = Array.from(
          crypto.getRandomValues(new Uint8Array(32)),
          (n) => n.toString(16).padStart(2, "0"),
        ).join("");
        attempt = {
          fingerprint,
          idempotencyKey: crypto.randomUUID(),
          trackingToken: token,
        };
        sessionStorage.setItem(
          "ember-checkout-attempt",
          JSON.stringify(attempt),
        );
      }
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          idempotencyKey: attempt.idempotencyKey,
          trackingToken: attempt.trackingToken,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      sessionStorage.setItem(`ember-order-${result.id}`, attempt.trackingToken);
      clear();
      sessionStorage.removeItem("ember-checkout-attempt");
      router.push(`/orders/${result.id}#${attempt.trackingToken}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Checkout failed. You can safely retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="checkout-grid">
      <div className="form-panel">
        <h2>Where’s your table?</h2>
        <fieldset className="fulfillment">
          <legend className="sr-only">Order type</legend>
          <label className={fulfillment === "DELIVERY" ? "selected" : ""}>
            <input
              type="radio"
              name="fulfillment"
              value="DELIVERY"
              checked={fulfillment === "DELIVERY"}
              onChange={() => setFulfillment("DELIVERY")}
            />{" "}
            Delivery <small>{money(menu.deliveryFee)}</small>
          </label>
          <label className={fulfillment === "PICKUP" ? "selected" : ""}>
            <input
              type="radio"
              name="fulfillment"
              value="PICKUP"
              checked={fulfillment === "PICKUP"}
              onChange={() => setFulfillment("PICKUP")}
            />{" "}
            Pickup <small>Free</small>
          </label>
        </fieldset>
        {fulfillment === "PICKUP" && (
          <p className="notice">
            Demo restaurant: a real pickup location is not configured. Use
            sample orders only.
          </p>
        )}
        <label>
          Your name
          <input
            name="customerName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Who are we cooking for?"
          />
        </label>
        <label>
          Phone number
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            minLength={8}
            maxLength={20}
            placeholder="01XXXXXXXXX"
          />
        </label>
        {fulfillment === "DELIVERY" && (
          <label>
            Delivery address
            <textarea
              name="address"
              autoComplete="street-address"
              required
              minLength={10}
              maxLength={400}
              placeholder="Street, building, apartment and area"
            />
          </label>
        )}
        <label>
          A note for the kitchen <span>(optional)</span>
          <textarea
            name="notes"
            maxLength={500}
            placeholder="Allergies or anything we should know?"
          />
        </label>
        <p className="sample-note">
          Sample platform. Do not submit sensitive information. Allergy requests
          need confirmation from staff.
        </p>
      </div>
      <aside className="summary">
        <p className="eyebrow">ONE LAST LOOK</p>
        <h2>Made for you.</h2>
        {lines.map((l) => (
          <div className="summary-row" key={l.menuItemId}>
            <span>
              {l.quantity} ×{" "}
              {items.find((i) => i.id === l.menuItemId)?.name ??
                "Unavailable item"}
            </span>
            <span>
              {money(
                (items.find((i) => i.id === l.menuItemId)?.price ?? 0) *
                  l.quantity,
              )}
            </span>
          </div>
        ))}
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>Delivery</span>
          <span>{fee ? money(fee) : "Free pickup"}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <strong>{money(subtotal + fee)}</strong>
        </div>
        <div className="payment-note">
          <strong>
            Cash {fulfillment === "DELIVERY" ? "on delivery" : "at pickup"}
          </strong>
          <p>No online payment. Pay only when you receive your food.</p>
        </div>
        <p className="sample-note">
          Prices and availability are checked again by the server when you place
          the order.
        </p>
        {invalid && (
          <p className="notice error">
            An item is unavailable. <Link href="/cart">Update your bag</Link>.
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button wide"
          disabled={busy || invalid}
          type="submit"
        >
          {busy ? "Placing your order…" : "Place order ↗"}
        </button>
        <small>Orders are saved immediately. No card details required.</small>
      </aside>
    </form>
  );
}
