"use client";
import { Printer } from "lucide-react";
export function ReceiptPrint() {
  return (
    <button className="button receipt-print" onClick={() => window.print()}>
      <Printer size={16} />
      Print receipt
    </button>
  );
}
