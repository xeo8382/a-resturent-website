"use client";
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { MotionConfig } from "motion/react";
import type { CartLine } from "@/lib/types";
const key = "ember-cart";
const eventName = "ember-cart-change";
let memory = "[]";
let memoryOnly = false;
function snapshot() {
  try {
    return memoryOnly ? memory : (localStorage.getItem(key) ?? "[]");
  } catch {
    return memory;
  }
}
function parse(raw: string): CartLine[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const valid = value.filter(
      (i): i is CartLine =>
        !!i &&
        typeof i.menuItemId === "string" &&
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        i.quantity <= 20,
    );
    return valid
      .filter(
        (item, index) =>
          valid.findIndex((i) => i.menuItemId === item.menuItemId) === index,
      )
      .slice(0, 40);
  } catch {
    return [];
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(eventName, callback);
  };
}
function write(lines: CartLine[]) {
  memory = JSON.stringify(lines);
  try {
    localStorage.setItem(key, memory);
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(eventName));
}
const add = (id: string) => {
  const old = parse(snapshot());
  write(
    old.some((i) => i.menuItemId === id)
      ? old.map((i) =>
          i.menuItemId === id
            ? { ...i, quantity: Math.min(20, i.quantity + 1) }
            : i,
        )
      : [...old, { menuItemId: id, quantity: 1 }],
  );
};
const setQuantity = (id: string, quantity: number) => {
  const old = parse(snapshot());
  write(
    quantity <= 0
      ? old.filter((i) => i.menuItemId !== id)
      : old.map((i) =>
          i.menuItemId === id ? { ...i, quantity: Math.min(20, quantity) } : i,
        ),
  );
};
const clear = () => write([]);
const CartContext = createContext({
  lines: [] as CartLine[],
  ready: false,
  add,
  setQuantity,
  clear,
});
export function Providers({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const lines = useMemo(() => parse(raw), [raw]);
  return (
    <MotionConfig reducedMotion="user">
      <CartContext.Provider value={{ lines, ready, add, setQuantity, clear }}>
        {children}
      </CartContext.Provider>
    </MotionConfig>
  );
}
export const useCart = () => useContext(CartContext);
