"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { days, type BusinessConfig } from "@/lib/business-config";
export type BusinessInfo = {
  name: string;
  deliveryFee: number;
  settings: BusinessConfig;
};
export function useBusiness() {
  const [data, setData] = useState<BusinessInfo | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/business", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setData(result);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Business details are temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);
  return { data, error };
}
export function BusinessDetails({ compact = false }: { compact?: boolean }) {
  const { data, error } = useBusiness();
  if (error)
    return (
      <p role="status">
        {error} <Link href="/contact">Contact information</Link>
      </p>
    );
  if (!data) return <p role="status">Loading visit information…</p>;
  const s = data.settings;
  return (
    <div className={`business-details ${compact ? "compact" : ""}`}>
      <div>
        <h3>Visit</h3>
        {!compact && (
          <p>
            {s.legalName
              ? `Operator: ${s.legalName}`
              : "Legal operator not configured."}
          </p>
        )}
        <p>
          {s.address ||
            "Address not configured. Please do not travel to this concept restaurant."}
        </p>
        {s.mapUrl && (
          <a href={s.mapUrl} target="_blank" rel="noopener noreferrer">
            Open map
          </a>
        )}
      </div>
      <div>
        <h3>Hours{s.timeZone ? ` · ${s.timeZone}` : ""}</h3>
        {s.hours.length ? (
          <dl className="business-hours">
            {days.map((name, day) => {
              const h = s.hours.find((h) => h.day === day);
              return (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{h ? `${h.opens}–${h.closes}` : "Closed"}</dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p>
            Operating hours and timezone need configuration before bookings can
            open.
          </p>
        )}
      </div>
      <div>
        <h3>Contact</h3>
        {s.phone ? (
          <p>
            <a href={`tel:${s.phone.replace(/[ ()-]/g, "")}`}>{s.phone}</a>
          </p>
        ) : (
          <p>Phone number not configured.</p>
        )}
        {s.email ? (
          <p>
            <a href={`mailto:${s.email}`}>{s.email}</a>
          </p>
        ) : (
          <p>Contact email not configured.</p>
        )}
        {!compact && (
          <>
            <h3>Delivery area</h3>
            <p>{s.serviceArea || "Real service area not configured."}</p>
            {s.deliveryMode === "zones" && (
              <ul>
                {s.deliveryZones.map((zone) => (
                  <li key={zone.id}>{zone.name}</li>
                ))}
              </ul>
            )}
            {s.deliveryMode === "sample" && (
              <p>Current delivery pricing is sample configuration.</p>
            )}
            {s.deliveryMode === "disabled" && (
              <p>Delivery is currently unavailable.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
