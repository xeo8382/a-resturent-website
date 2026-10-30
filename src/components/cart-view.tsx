"use client";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ArrowUpRight, ArrowLeft } from "lucide-react";
import { useCart } from "./providers";
import { useMenu } from "./menu-browser";
import {
  customerPhoto,
  customerPhotoStyle,
  customerPhotoFrameStyle,
} from "@/lib/customer-photos";
import { money } from "@/lib/order-rules";
export function CartView() {
  const { lines, ready, setQuantity } = useCart();
  const { menu, error } = useMenu();
  if (error)
    return (
      <p role="alert" className="notice error">
        {error}
      </p>
    );
  if (!ready || !menu) return <p role="status">Setting your table…</p>;
  if (!lines.length)
    return (
      <div className="empty-state">
        <h2>A little room for something good.</h2>
        <p>Your bag is empty. Let’s fix that.</p>
        <Link href="/menu" className="button">
          Explore the menu <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  const items = menu.categories.flatMap((c) => c.items);
  const subtotal = lines.reduce(
    (sum, line) =>
      sum +
      (items.find((i) => i.id === line.menuItemId)?.price ?? 0) * line.quantity,
    0,
  );
  const invalid = lines.some(
    (l) => !items.find((i) => i.id === l.menuItemId)?.available,
  );
  return (
    <div className="checkout-grid">
      <div className="cart-lines">
        {lines.map((line) => {
          const item = items.find((i) => i.id === line.menuItemId);
          return (
            <article className="cart-line" key={line.menuItemId}>
              {item && (
                <span className="cart-photo">
                  <span
                    className="food-photo-frame"
                    style={customerPhotoFrameStyle(item)}
                  >
                    <Image
                      src={customerPhoto(item).src}
                      alt={customerPhoto(item).alt}
                      fill
                      sizes="110px"
                      style={customerPhotoStyle(item)}
                    />
                  </span>
                </span>
              )}
              <div className="cart-line-info">
                <h2>{item?.name ?? "Removed menu item"}</h2>
                <p>
                  {item?.available
                    ? money(item.price)
                    : "Currently unavailable — please remove"}
                </p>
                <div className="quantity">
                  <button
                    aria-label={`Decrease ${item?.name ?? "item"} quantity`}
                    onClick={() =>
                      setQuantity(line.menuItemId, line.quantity - 1)
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    aria-label={`Increase ${item?.name ?? "item"} quantity`}
                    disabled={line.quantity >= 20}
                    onClick={() =>
                      setQuantity(line.menuItemId, line.quantity + 1)
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="cart-line-end">
                <strong>{money((item?.price ?? 0) * line.quantity)}</strong>
                <button
                  className="icon-button"
                  aria-label={`Remove ${item?.name ?? "item"}`}
                  onClick={() => setQuantity(line.menuItemId, 0)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          );
        })}
        <Link className="text-link" href="/menu">
          <ArrowLeft size={15} aria-hidden="true" /> Find a little more
        </Link>
      </div>
      <aside className="summary">
        <p className="eyebrow">YOUR TABLE, SORTED</p>
        <h2>A good choice.</h2>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <p>
          {menu.business?.deliveryMode === "zones"
            ? "Delivery fee and minimum depend on your selected zone."
            : menu.business?.deliveryMode === "disabled"
              ? "Delivery is unavailable. Pickup is free."
              : `Delivery: ${money(menu.deliveryFee)}. Pickup is free.`}
          <br />
          Final total calculated at checkout.
        </p>
        {invalid ? (
          <p role="alert" className="notice error">
            Remove unavailable items to continue.
          </p>
        ) : (
          <Link href="/checkout" className="button wide">
            To checkout <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
        <small>Pay in cash on delivery or at pickup.</small>
      </aside>
    </div>
  );
}
