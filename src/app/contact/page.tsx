import { BusinessDetails } from "@/components/business-details";
import { Footer } from "@/components/footer";
import Link from "next/link";
export const metadata = {
  title: "Contact & visit",
  description:
    "Find Ember & Table’s configured address, operating hours, contact details and delivery service area.",
};
export default function ContactPage() {
  return (
    <>
      <main id="main" className="page-wrap information-page">
        <div className="page-heading">
          <p className="eyebrow">PLAN YOUR VISIT</p>
          <h1>
            Come <em>on over.</em>
          </h1>
          <p>
            Only details supplied by the restaurant appear here. Missing
            information is marked for configuration.
          </p>
        </div>
        <BusinessDetails />
        <Link className="button" href="/reservations">
          Find your table
        </Link>
      </main>
      <Footer />
    </>
  );
}
