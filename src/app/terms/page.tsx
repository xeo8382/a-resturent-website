import { Footer } from "@/components/footer";
import Link from "next/link";
export const metadata = {
  title: "Terms",
  description:
    "Pre-launch ordering, reservation, payment and cancellation terms for Ember & Table.",
};
export default function TermsPage() {
  return (
    <>
      <main id="main" className="page-wrap policy-page">
        <h1>Terms of service</h1>
        <p className="notice">
          Pre-launch terms. Real business identity, location, service
          commitments and legally reviewed terms must be configured before
          launch approval.
        </p>
        <h2>Orders and prices</h2>
        <p>
          Menu content remains sample content until the operator replaces it.
          Prices are in BDT. The server checks current prices and availability
          when saving an order. Delivery fees and minimum food subtotals follow
          the configured delivery zone or flat-fee rules. Selecting a zone does
          not geocode or verify your address; staff must verify it.
        </p>
        <h2>Payment</h2>
        <p>
          Cash on delivery or at the restaurant is the supported method. No
          online payment gateway is configured. A paid status records a staff
          cash-collection attestation.
        </p>
        <h2>Reservations</h2>
        <p>
          A reservation is confirmed only after the server rechecks table
          capacity and successfully saves an allocated table and time window.
          Times use the restaurant’s configured timezone. Availability can
          change before submission. The displayed table-hold duration includes
          turnover. Keep your private confirmation link; no email or SMS is
          sent.
        </p>
        <h2>Changes and cancellations</h2>
        <p>
          Contact the restaurant to change or cancel a booking or order. Staff
          manage reservation and order status according to permitted
          transitions. Cancellation penalties, deposits and refunds are not
          configured; no reservation deposit is collected by this platform.
        </p>
        <h2>Before visiting</h2>
        <p>
          Check the{" "}
          <Link href="/contact">
            configured address, opening hours and contact details
          </Link>
          . Missing details are not promises of service. Allergy requests
          require direct staff confirmation; photographs show serving
          inspiration.
        </p>
        <h2>Operator information</h2>
        <p>
          The legal operator and jurisdiction-specific terms are not yet
          supplied. This site remains noindex pending explicit launch approval.
        </p>
      </main>
      <Footer />
    </>
  );
}
