import Image from "next/image";
import { ReservationForm } from "@/components/reservation-form";
import { Footer } from "@/components/footer";
import { Reveal } from "@/components/reveal";
export const metadata = {
  title: "Reserve a table",
  description:
    "Check real table availability and save a reservation at Ember & Table. All times use the restaurant’s configured timezone.",
};
export default function ReservationsPage() {
  return (
    <>
      <main id="main" className="reservation-page">
        <div className="reservation-layout">
          <Reveal className="reservation-intro">
            <p className="eyebrow">AT EMBER & TABLE</p>
            <h1>
              A place
              <br />
              at <em>our table.</em>
            </h1>
            <p>
              Choose your date and party size. We’ll check the restaurant’s
              configured tables before confirming your reservation.
            </p>
            <div className="reservation-photo">
              <Image
                src="/photos/kitchen.jpg"
                alt="Food being prepared in an open kitchen"
                fill
                sizes="(max-width:760px) 85vw, 38vw"
              />
            </div>
          </Reveal>
          <section className="booking-panel" aria-label="Table reservation">
            <h2>Find your table</h2>
            <ReservationForm />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
