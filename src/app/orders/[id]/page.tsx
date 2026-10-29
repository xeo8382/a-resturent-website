import { OrderTracker } from "@/components/order-tracker";
export const metadata = { title: "Track your order" };
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main id="main" className="page-wrap">
      <OrderTracker id={(await params).id} />
    </main>
  );
}
