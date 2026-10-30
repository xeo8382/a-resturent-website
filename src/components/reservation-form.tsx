"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { localParts } from "@/lib/reservation-time";
import { useBusiness } from "./business-details";
type Slots = {
  configured: boolean;
  timeZone: string;
  maxPartySize: number;
  durationMinutes?: number;
  slots: { time: string; available: boolean }[];
};
export function ReservationForm() {
  const { data: business, error: businessError } = useBusiness();
  const [date, setDate] = useState("");
  const [party, setParty] = useState(2);
  const [time, setTime] = useState("");
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    data?: Slots;
    error?: string;
  }>({ key: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const router = useRouter();
  const key = `${date}/${party}/${revision}`;
  useEffect(() => {
    if (!date || party < 1) return;
    const controller = new AbortController();
    fetch(
      `/api/reservations/availability?date=${encodeURIComponent(date)}&partySize=${party}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setResponse({ key, data });
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setResponse({
            key,
            error: e.message || "Availability could not be checked.",
          });
      });
    return () => controller.abort();
  }, [date, party, revision, key]);
  const slots = response.key === key ? response.data : undefined;
  const availabilityError = response.key === key ? response.error : undefined;
  const configured =
    business?.settings.reservationsEnabled && business.settings.timeZone;
  const loading = !!date && party > 0 && response.key !== key;
  const selected = slots?.slots.find(
    (slot) => slot.time === time && slot.available,
  );
  const zone = business?.settings.timeZone;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !selected) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      date,
      time,
      partySize: party,
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email") || "",
      notes: form.get("notes") || "",
    };
    let refreshAvailability = false;
    try {
      const fingerprint = JSON.stringify(payload);
      let attempt: { fingerprint: string; key: string; token: string } | null =
        null;
      try {
        attempt = JSON.parse(
          sessionStorage.getItem("ember-reservation-attempt") || "null",
        );
      } catch {}
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = {
          fingerprint,
          key: crypto.randomUUID(),
          token: [...crypto.getRandomValues(new Uint8Array(32))]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(""),
        };
        sessionStorage.setItem(
          "ember-reservation-attempt",
          JSON.stringify(attempt),
        );
      }
      const request = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          idempotencyKey: attempt.key,
          trackingToken: attempt.token,
        }),
      };
      // A transport failure can happen after commit. One bounded replay uses
      // the exact same persisted key/token/body, so it recovers that booking.
      let r: Response;
      try {
        r = await fetch("/api/reservations", request);
      } catch {
        r = await fetch("/api/reservations", request);
      }
      const result = await r.json();
      if (!r.ok) {
        refreshAvailability = [409, 503].includes(r.status);
        throw new Error(result.error || "The reservation could not be saved.");
      }
      sessionStorage.setItem(`ember-reservation-${result.id}`, attempt.token);
      sessionStorage.removeItem("ember-reservation-attempt");
      router.push(`/reservations/${result.id}#${attempt.token}`);
    } catch (e) {
      setError(
        e instanceof TypeError || e instanceof SyntaxError
          ? "We could not receive confirmation. Your booking may already be saved. Retry with the same details to recover it safely."
          : e instanceof Error
            ? e.message
            : "The reservation could not be saved. You can safely retry.",
      );
      // Keep the selected attempt retryable after an unknown response. Rechecking
      // availability there could hide the only table that this attempt just saved.
      if (refreshAvailability) setRevision((r) => r + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (businessError)
    return (
      <div className="booking-notice" role="alert">
        {businessError} Refresh the page to retry.
      </div>
    );
  if (!business) return <p role="status">Loading reservation details…</p>;
  return (
    <form onSubmit={submit} className="reservation-form">
      {!configured && (
        <p className="booking-notice" role="status">
          Reservations are not open yet. The restaurant must configure its
          timezone, operating hours, and tables before accepting bookings.
        </p>
      )}
      <div className="booking-fields">
        <label>
          Date
          <input
            name="date"
            type="date"
            value={date}
            min={zone ? localParts(new Date(), zone).date : undefined}
            required
            disabled={!configured || busy}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
            }}
          />
        </label>
        <label>
          Guests
          <input
            name="partySize"
            type="number"
            min={1}
            max={business.settings.maxPartySize}
            value={party || ""}
            required
            disabled={!configured || busy}
            onChange={(e) => {
              setParty(Number(e.target.value));
              setTime("");
            }}
          />
        </label>
        <label className="booking-wide">
          Time
          {zone && <span className="field-hint">Restaurant time · {zone}</span>}
          <select
            name="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            disabled={
              !configured ||
              busy ||
              loading ||
              !slots?.slots.some((s) => s.available)
            }
          >
            <option value="">
              {loading
                ? "Checking real availability…"
                : "Choose an available time"}
            </option>
            {slots?.slots.map((slot) => (
              <option
                key={slot.time}
                value={slot.time}
                disabled={!slot.available}
              >
                {slot.time}
                {slot.available ? "" : " — unavailable"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading && <p role="status">Checking tables for your party…</p>}
      {availabilityError && (
        <div className="booking-notice" role="alert">
          {availabilityError}{" "}
          <button type="button" onClick={() => setRevision((r) => r + 1)}>
            Retry availability
          </button>
        </div>
      )}
      {slots?.configured &&
        !loading &&
        !slots.slots.some((s) => s.available) && (
          <p className="booking-notice" role="status">
            No tables are available for this party and date. Try another date or
            a smaller party.
          </p>
        )}
      <div className="booking-fields booking-contact-fields">
        <label className="booking-wide">
          Customer name
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            disabled={!configured || busy}
          />
        </label>
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            minLength={8}
            maxLength={20}
            disabled={!configured || busy}
          />
        </label>
        <label>
          Email <span className="field-hint">Optional</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            disabled={!configured || busy}
          />
        </label>
        <label className="booking-wide">
          Notes{" "}
          <span className="field-hint">
            Optional · no sensitive health information
          </span>
          <textarea
            name="notes"
            maxLength={500}
            rows={3}
            disabled={!configured || busy}
          />
        </label>
      </div>
      {slots?.durationMinutes && (
        <p className="booking-detail">
          <CalendarDays size={16} aria-hidden="true" /> Table hold:{" "}
          {slots.durationMinutes} minutes, including turnover.
        </p>
      )}
      <p className="booking-detail">
        Availability is checked again when you book. Confirmation appears only
        after your reservation is saved. No email or SMS notifications are
        configured.
      </p>
      <p className="booking-detail">
        By booking, you agree to our <Link href="/terms">terms</Link> and{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>
      {error && (
        <p role="alert" className="booking-notice">
          {error}
        </p>
      )}
      <button
        className="button"
        type="submit"
        disabled={!configured || !selected || busy || loading}
      >
        {busy ? "Saving reservation…" : "Confirm reservation"}
        <ArrowUpRight size={16} aria-hidden="true" />
      </button>
    </form>
  );
}
