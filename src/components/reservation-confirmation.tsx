"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Booking = {
  id: string;
  status: string;
  name: string;
  date: string;
  time: string;
  timeZone: string;
  partySize: number;
};
export function ReservationConfirmation({ id }: { id: string }) {
  const [booking, setBooking] = useState<Booking | null>(null),
    [error, setError] = useState("");
  const [revision, setRevision] = useState(0),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const token =
      location.hash.slice(1) ||
      sessionStorage.getItem(`ember-reservation-${id}`) ||
      "";
    fetch(`/api/reservations/${id}?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setBooking(result);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [id, revision]);
  if (error)
    return (
      <div className="booking-notice" role="alert">
        {error} <button onClick={() => setRevision((r) => r + 1)}>Retry</button>
      </div>
    );
  if (!booking) return <p role="status">Loading your saved reservation…</p>;
  return (
    <div className="reservation-confirmation" aria-live="polite">
      <p className="eyebrow">
        RESERVATION #{booking.id.slice(-8).toUpperCase()}
      </p>
      <h1>
        {booking.status === "CONFIRMED"
          ? "Your table is confirmed."
          : `Reservation ${booking.status.toLowerCase().replaceAll("_", " ")}`}
      </h1>
      <p>
        {booking.name} · {booking.partySize} guests
      </p>
      <p>
        {booking.date} at {booking.time} · {booking.timeZone}
      </p>
      <p>
        This reservation was saved to the restaurant’s database. No email or SMS
        was sent.
      </p>
      <p>
        Keep this private link. Anyone with the complete link can view these
        details. Contact the restaurant for changes or cancellation.
      </p>
      <div className="hero-ctas">
        <button
          className="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              setCopied(true);
            } catch {
              setError("Copy the complete link from the address bar.");
            }
          }}
        >
          {copied ? "Link copied" : "Copy confirmation link"}
        </button>
        <Link href="/contact">Contact & visit</Link>
        <button type="button" onClick={() => setRevision((r) => r + 1)}>
          Refresh status
        </button>
      </div>
    </div>
  );
}
