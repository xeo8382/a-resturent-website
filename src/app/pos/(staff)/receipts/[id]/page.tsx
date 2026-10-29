import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { pageUser } from "@/lib/page-auth";
import { staffReceipt } from "@/lib/pos-orders";
import { HttpError } from "@/lib/errors";
import { money } from "@/lib/order-rules";
import { ReceiptPrint } from "@/components/receipt-print";
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await pageUser();
  if (user.role === "KITCHEN") redirect("/pos/kitchen");
  let receipt;
  try {
    receipt = await staffReceipt((await params).id, user);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  return (
    <main id="main" className="pos-main receipt-page">
      <div className="receipt-toolbar">
        <Link href={`/pos/orders?order=${receipt.id}`}>← Back to order</Link>
        <ReceiptPrint />
      </div>
      <article className="pos-receipt">
        <p className="eyebrow">
          {receipt.payment?.status === "PAID" ? "CASH RECEIPT" : "ORDER TICKET"}
        </p>
        <h1>{receipt.restaurant.name}</h1>
        <p>
          #{receipt.id.slice(-6).toUpperCase()} ·{" "}
          {receipt.fulfillment.replaceAll("_", " ")}
          {receipt.table ? ` · ${receipt.table.label}` : ""}
        </p>
        <p>
          {receipt.customerName}
          <br />
          {new Date(receipt.createdAt).toLocaleString("en-GB", {
            timeZone: "Asia/Dhaka",
          })}{" "}
          (Dhaka)
        </p>
        <div className={`receipt-payment receipt-${receipt.payment?.status}`}>
          {receipt.payment?.status === "PAID"
            ? "PAID · Cash collected"
            : receipt.payment?.status === "VOID"
              ? "VOID · No payment due"
              : "PAYMENT PENDING · Cash not collected"}
        </div>
        {receipt.items.map((i, n) => (
          <div className="receipt-line" key={n}>
            <div>
              <strong>
                {i.quantity} × {i.name}
              </strong>
              <small>{money(i.unitPrice)} each</small>
            </div>
            <span>{money(i.lineTotal)}</span>
          </div>
        ))}
        <div className="receipt-line">
          <span>Subtotal</span>
          <span>{money(receipt.subtotal)}</span>
        </div>
        <div className="receipt-line">
          <span>Delivery fee</span>
          <span>{money(receipt.deliveryFee)}</span>
        </div>
        <div className="receipt-line receipt-total">
          <strong>Total</strong>
          <strong>{money(receipt.total)}</strong>
        </div>
        <p>
          Cash{" "}
          {receipt.payment?.status === "PAID"
            ? "received"
            : receipt.payment?.status === "VOID"
              ? "voided"
              : "due"}
          : {money(receipt.payment?.status === "VOID" ? 0 : receipt.total)}
        </p>
        {receipt.payment?.paidAt && (
          <p>
            Collected{" "}
            {new Date(receipt.payment.paidAt).toLocaleString("en-GB", {
              timeZone: "Asia/Dhaka",
            })}{" "}
            (Dhaka)
          </p>
        )}
        <footer>
          Good food. Better company.
          <br />
          Concept restaurant · Sample menu
        </footer>
      </article>
    </main>
  );
}
