"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBag,
  Flame,
  Menu as MenuIcon,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useCart } from "./providers";
export function Header() {
  const path = usePathname();
  const { lines } = useCart();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  if (path.startsWith("/pos") || path.startsWith("/admin")) return null;
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Ember and Table home">
        <Flame size={30} strokeWidth={1.2} />
        <span>
          ember <i>&</i> table<small>FIRE. FLAVOUR. FEELING.</small>
        </span>
      </Link>
      <nav
        id="customer-navigation"
        aria-label="Main navigation"
        className={open ? "main-nav open" : "main-nav"}
      >
        <Link
          onClick={() => setOpen(false)}
          href="/menu"
          aria-current={path.startsWith("/menu") ? "page" : undefined}
        >
          The menu
        </Link>
        <Link onClick={() => setOpen(false)} href="/#story">
          Our story
        </Link>
        <Link
          onClick={() => setOpen(false)}
          href="/reservations"
          aria-current={path.startsWith("/reservations") ? "page" : undefined}
        >
          Find your table
        </Link>
        <Link
          onClick={() => setOpen(false)}
          href="/contact"
          aria-current={path === "/contact" ? "page" : undefined}
        >
          Visit & contact
        </Link>
      </nav>
      <div className="header-actions">
        <Link
          className="bag"
          href="/cart"
          aria-label={`Bag, ${lines.reduce((s, i) => s + i.quantity, 0)} items`}
        >
          <ShoppingBag size={19} />
          <span>{lines.reduce((s, i) => s + i.quantity, 0)}</span>
        </Link>
        <Link className="button small header-order" href="/menu">
          Order online <ArrowUpRight size={13} />
        </Link>
        <button
          className="icon-button mobile-toggle"
          ref={toggle}
          aria-controls="customer-navigation"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
        >
          {open ? <X /> : <MenuIcon />}
        </button>
      </div>
    </header>
  );
}
