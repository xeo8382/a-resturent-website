"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  customerPhoto,
  customerPhotoStyle,
  customerPhotoFrameStyle,
} from "@/lib/customer-photos";
import { Plus, Search, ArrowUpRight } from "lucide-react";
import type { Menu, MenuItem } from "@/lib/types";
import { money } from "@/lib/order-rules";
import { useCart } from "./providers";
export function useMenu() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/menu", { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data)
          throw new Error(data?.error || "Menu not configured.");
        setMenu(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  return { menu, error };
}
export function AddButton({ item }: { item: MenuItem }) {
  const { add, lines } = useCart();
  const [announcement, setAnnouncement] = useState("");
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const timeout = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(timeout);
  }, [added]);
  return (
    <>
      <button
        className="button small"
        disabled={!item.available}
        onClick={() => {
          const current =
            lines.find((line) => line.menuItemId === item.id)?.quantity ?? 0;
          add(item.id);
          setAnnouncement(
            current >= 20
              ? `${item.name} is already at the maximum quantity of 20.`
              : `Added ${item.name} to bag. Quantity ${current + 1}.`,
          );
          setAdded(true);
        }}
        aria-label={`Add ${item.name} to bag`}
      >
        {!item.available ? (
          "Unavailable"
        ) : added ? (
          "Added to bag ✓"
        ) : (
          <>
            Add to bag <Plus size={16} aria-hidden="true" />
          </>
        )}
      </button>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
    </>
  );
}
export function MenuBrowser() {
  const { menu, error } = useMenu();
  const reduced = useReducedMotion();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  if (error)
    return (
      <div className="notice error" role="alert">
        {error}
      </div>
    );
  if (!menu) return <p role="status">Warming up the menu…</p>;
  const items = menu.categories
    .filter((c) => category === "all" || c.slug === category)
    .flatMap((c) => c.items)
    .filter((i) =>
      `${i.name} ${i.description}`.toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <>
      <div className="menu-toolbar">
        <div className="category-tabs" aria-label="Menu categories">
          <button
            className={category === "all" ? "active" : ""}
            onClick={() => setCategory("all")}
            aria-pressed={category === "all"}
          >
            All plates
          </button>
          {menu.categories.map((c) => (
            <button
              key={c.id}
              className={category === c.slug ? "active" : ""}
              onClick={() => setCategory(c.slug)}
              aria-pressed={category === c.slug}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search the menu"
            placeholder="Find something delicious"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="menu-grid">
        {items.map((item, index) => (
          <motion.article
            className="menu-card"
            key={item.id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0 : 0.45,
              delay: reduced ? 0 : Math.min(index * 0.04, 0.2),
            }}
          >
            <Link href={`/menu/${item.slug}`} className="menu-card-image">
              <div
                className="food-photo-frame"
                style={customerPhotoFrameStyle(item)}
              >
                <Image
                  src={customerPhoto(item).src}
                  alt={customerPhoto(item).alt}
                  fill
                  style={customerPhotoStyle(item)}
                  sizes="(max-width: 760px) 90vw, (max-width:1100px) 44vw, 30vw"
                />
              </div>
              <span className="menu-card-discover" aria-hidden="true">
                <ArrowUpRight size={22} />
              </span>
              {item.featured && (
                <span className="food-tag">HOUSE FAVOURITE</span>
              )}
            </Link>
            <div className="menu-card-body">
              <div className="dish-title">
                <Link href={`/menu/${item.slug}`}>
                  <h2>{item.name}</h2>
                </Link>
                <span>{money(item.price)}</span>
              </div>
              <p>{item.description}</p>
              <div className="menu-card-bottom">
                <span className="allergen-note">
                  {item.allergens.length
                    ? `Contains ${item.allergens.join(", ").toLowerCase()}`
                    : "No listed allergens"}
                </span>
                <AddButton item={item} />
              </div>
            </div>
          </motion.article>
        ))}
      </div>
      {!items.length && (
        <p className="empty-state">No plates found. Try another search.</p>
      )}
    </>
  );
}
