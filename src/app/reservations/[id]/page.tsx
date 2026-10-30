import { ReservationConfirmation } from "@/components/reservation-confirmation";
import { Footer } from "@/components/footer";
export const metadata = {
  title: "Your reservation",
  description: "Private reservation confirmation and current status.",
};
export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <>
      <main id="main" className="reservation-page confirmation-page">
        <ReservationConfirmation id={(await params).id} />
      </main>
      <Footer />
    </>
  );
}
