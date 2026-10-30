"use client";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Header } from "./header";
import { useReducedMotionPreference } from "./use-motion-preferences";
export function CustomerFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotionPreference();
  if (pathname.startsWith("/pos") || pathname.startsWith("/admin"))
    return children;
  return (
    <div
      className={`customer-site ${pathname === "/" ? "customer-home" : "customer-inner"}`}
    >
      <Header />
      <motion.div
        className="customer-route"
        key={pathname}
        initial={pathname === "/" ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
