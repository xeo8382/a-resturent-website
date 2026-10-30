import { Footer } from "@/components/footer";
import Link from "next/link";
export const metadata = {
  title: "Privacy",
  description:
    "How this pre-launch restaurant platform handles order, reservation, cart and staff session information.",
};
export default function PrivacyPage() {
  return (
    <>
      <main id="main" className="page-wrap policy-page">
        <h1>Privacy policy</h1>
        <p className="notice">
          Pre-launch policy. The operator’s legal identity, contact and
          data-retention process need configuration and review before public
          launch.
        </p>
        <h2>Information you provide</h2>
        <p>
          Orders store your name, phone, delivery address where applicable,
          order items and notes. Reservations store your name, phone, optional
          email and notes, party size, allocated table and booking times. Avoid
          adding sensitive information in notes.
        </p>
        <h2>Why it is stored</h2>
        <p>
          The restaurant uses this information to fulfil orders, allocate tables
          and manage bookings. Staff access requires authentication and role
          permissions. Cash records show staff confirmation; this platform does
          not collect card details.
        </p>
        <h2>Browser storage and private links</h2>
        <p>
          Your cart uses local storage. Order and reservation retry details and
          private tracking tokens use tab/session storage. Staff sessions use an
          HttpOnly, SameSite cookie that expires after eight hours, with Secure
          enabled in production. Complete confirmation links grant access to the
          associated details; keep them private.
        </p>
        <h2>Notifications and third parties</h2>
        <p>
          No email/SMS confirmation service or marketing tracker is configured.
          Cooking footage and photographs are served locally. Hosting and
          database providers process requests when this site is deployed; actual
          provider details must be added before launch.
        </p>
        <h2>Retention and your requests</h2>
        <p>
          Automatic record deletion and a formal retention period are not
          configured. The operator must establish a retention process and handle
          access, correction or deletion requests before launch. Contact
          details, when supplied, appear on the{" "}
          <Link href="/contact">contact page</Link>.
        </p>
      </main>
      <Footer />
    </>
  );
}
