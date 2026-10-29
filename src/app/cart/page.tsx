import { CartView } from "@/components/cart-view";
export const metadata = { title: "Your bag" };
export default function CartPage() {
  return (
    <main id="main" className="page-wrap">
      <div className="page-heading">
        <p className="eyebrow">SAVE ROOM FOR GOOD THINGS</p>
        <h1>
          Your <em>bag.</em>
        </h1>
      </div>
      <CartView />
    </main>
  );
}
