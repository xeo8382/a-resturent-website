"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Booking = {
  id: string;
  tableId: string | null;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  partySize: number;
  status: string;
  startsAt: string;
  endsAt: string;
  table: { label: string } | null;
  order: { id: string; status: string } | null;
};
type Result = { date: string; timeZone: string; reservations: Booking[] };
export function StaffReservations({
  initialDate = "",
}: {
  initialDate?: string;
}) {
  const [date, setDate] = useState(initialDate),
    [data, setData] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      fetch(`/api/pos/reservations${date ? `?date=${date}` : ""}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (r) => {
          const value = await r.json();
          if (!r.ok) throw new Error(value.error);
          if (!controller.signal.aborted) {
            setData(value);
            setError("");
          }
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [date, revision]);
  async function update(booking: Booking, status: string) {
    setBusy(booking.id);
    setError("");
    try {
      const r = await fetch(`/api/pos/reservations/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedStatus: booking.status, status }),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reservation update failed.");
    } finally {
      setBusy("");
    }
  }
  return (
    <main id="main" className="pos-main staff-reservations">
      <div className="pos-heading">
        <div>
          <p className="eyebrow">FRONT OF HOUSE</p>
          <h1>Reservations</h1>
          <p>
            Saved bookings, table holds and guest notes. Times shown in{" "}
            {data?.timeZone || "the configured restaurant timezone"}.
          </p>
        </div>
        <button
          className="pos-outline"
          onClick={() => setRevision((r) => r + 1)}
        >
          Refresh reservations
        </button>
      </div>
      <label className="reservation-date-filter">
        Booking date
        <input
          type="date"
          value={date || data?.date || ""}
          onChange={(e) => {
            setDate(e.target.value);
            setData(null);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading reservations…</p>}
      {data && !data.reservations.length && (
        <div className="empty-state">
          <h2>No reservations for this date.</h2>
          <p>Only successfully persisted bookings appear here.</p>
        </div>
      )}
      <div className="staff-reservation-grid">
        {data?.reservations.map((booking) => (
          <article key={booking.id} className="staff-reservation-card">
            <div className="booking-card-top">
              <h2>{booking.name}</h2>
              <span>{booking.status.replaceAll("_", " ")}</span>
            </div>
            <p>
              {new Intl.DateTimeFormat("en-GB", {
                timeZone: data.timeZone,
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(booking.startsAt))}{" "}
              · {booking.partySize} guests ·{" "}
              {booking.table?.label || "No table assigned"}
            </p>
            <p>
              <a href={`tel:${booking.phone.replace(/[ ()-]/g, "")}`}>
                {booking.phone}
              </a>
              {booking.email && (
                <>
                  {" "}
                  · <a href={`mailto:${booking.email}`}>{booking.email}</a>
                </>
              )}
            </p>
            {booking.notes && <p className="kitchen-note">{booking.notes}</p>}
            <div className="reservation-actions">
              {booking.status === "REQUESTED" && (
                <button
                  className="button small"
                  disabled={!!busy}
                  onClick={() => void update(booking, "CONFIRMED")}
                >
                  Confirm booking
                </button>
              )}
              {booking.status === "CONFIRMED" && (
                <>
                  <button
                    className="button small"
                    disabled={!!busy}
                    onClick={() => void update(booking, "SEATED")}
                  >
                    Seat guests
                  </button>
                  <button
                    className="pos-outline"
                    disabled={!!busy}
                    onClick={() => void update(booking, "NO_SHOW")}
                  >
                    Mark no-show
                  </button>
                </>
              )}
              {["REQUESTED", "CONFIRMED"].includes(booking.status) && (
                <button
                  className="pos-outline"
                  disabled={!!busy}
                  onClick={() => void update(booking, "CANCELLED")}
                >
                  Cancel booking
                </button>
              )}
              {booking.status === "SEATED" && (
                <>
                  <button
                    className="pos-outline"
                    disabled={!!busy}
                    onClick={() => void update(booking, "COMPLETED")}
                  >
                    Complete booking
                  </button>
                  {!booking.order && (
                    <Link
                      className="button small"
                      href={`/pos?table=${booking.tableId}&reservation=${booking.id}`}
                    >
                      Open seated POS check
                    </Link>
                  )}
                </>
              )}
              {booking.order && (
                <Link href={`/pos/orders?order=${booking.order.id}`}>
                  View linked order · {booking.order.status.toLowerCase()}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="sample-note">
        Refreshes every 15 seconds. Seating and table changes are checked on the
        server. No email or SMS service is configured.
      </p>
    </main>
  );
}
