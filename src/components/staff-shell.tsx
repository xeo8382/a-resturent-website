"use client";
import Link from "next/link";
import "@/app/pos.css";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Flame,
  ClipboardList,
  CookingPot,
  LayoutGrid,
  Settings,
  LogOut,
  UtensilsCrossed,
  CalendarDays,
} from "lucide-react";
export function StaffShell({
  children,
  name,
  role,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  const links = [
    ...(role !== "KITCHEN"
      ? [{ href: "/pos", label: "New order", icon: UtensilsCrossed }]
      : []),
    { href: "/pos/orders", label: "Incoming orders", icon: ClipboardList },
    { href: "/pos/kitchen", label: "Kitchen", icon: CookingPot },
    { href: "/pos/tables", label: "Tables", icon: LayoutGrid },
    ...(role !== "KITCHEN"
      ? [
          {
            href: "/pos/reservations",
            label: "Reservations",
            icon: CalendarDays,
          },
        ]
      : []),
    ...(["ADMIN", "MANAGER"].includes(role)
      ? [
          { href: "/admin", label: "Manage", icon: Settings },
          { href: "/admin/business", label: "Business", icon: CalendarDays },
        ]
      : []),
  ];
  return (
    <div className="staff-app">
      <aside className="staff-sidebar">
        <Link href="/" className="staff-brand" aria-label="Restaurant home">
          <Flame size={32} />
          <span>E&T</span>
        </Link>
        <nav aria-label="Staff navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : ""}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button
          onClick={async () => {
            try {
              const r = await fetch("/api/auth/logout", { method: "POST" });
              if (!r.ok) throw new Error("Sign out failed.");
              router.push("/pos/login");
              router.refresh();
            } catch {
              setError("Unable to sign out. Please retry.");
            }
          }}
        >
          <LogOut size={20} />
          <span>Sign out</span>
        </button>
      </aside>
      <div className="staff-content">
        <header className="staff-topbar">
          <span>
            Ember & Table <span className="muted">/ Service console</span>
          </span>
          <div>
            <span className="staff-avatar">{name.slice(0, 1)}</span>
            <span>
              {name}
              <small>{role.toLowerCase()}</small>
            </span>
          </div>
        </header>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {children}
        <p className="pos-disclaimer">
          Service console · Reference-independent UI; Figma screenshots pending.
        </p>
      </div>
    </div>
  );
}
