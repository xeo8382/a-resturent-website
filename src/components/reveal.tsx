"use client";
import { motion } from "motion/react";
import {
  useCompactMotion,
  useReducedMotionPreference,
} from "./use-motion-preferences";

export function RevealGroup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotionPreference();
  const compact = useCompactMotion();
  return (
    <motion.div
      className={`reveal-group ${className}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: reduced ? 0 : compact ? 0.07 : 0.11 },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function RevealText({
  children,
  as = "p",
  className,
}: {
  children: React.ReactNode;
  as?: "p" | "h2";
  className?: string;
}) {
  const reduced = useReducedMotionPreference();
  const compact = useCompactMotion();
  const Component = as === "h2" ? motion.h2 : motion.p;
  return (
    <Component
      className={`reveal-text ${className || ""}`}
      variants={{
        hidden: { opacity: 0, y: compact ? 10 : 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: reduced ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </Component>
  );
}
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotionPreference();
  const compact = useCompactMotion();
  return (
    <motion.div
      className={`reveal ${className}`}
      initial={{ opacity: 0, y: compact ? 16 : 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: reduced ? 0 : 0.8,
        delay: reduced ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
