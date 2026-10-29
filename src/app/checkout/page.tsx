import { CheckoutForm } from "@/components/checkout-form";
export const metadata = { title: "Checkout" };
export default function CheckoutPage() {
  return (
    <main id="main" className="page-wrap">
      <div className="page-heading">
        <p className="eyebrow">ALMOST AT THE TABLE</p>
        <h1>
          Let’s make it <em>happen.</em>
        </h1>
      </div>
      <CheckoutForm />
    </main>
  );
}
