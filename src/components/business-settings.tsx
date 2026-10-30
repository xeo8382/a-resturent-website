"use client";
import { useEffect, useState } from "react";
import { days, type BusinessConfig } from "@/lib/business-config";
type Table = {
  id: string;
  label: string;
  seats: number;
  active: boolean;
  version: number;
};
type Configuration = {
  settings: BusinessConfig;
  deliveryFee: number;
  version: number;
  tables: Table[];
};
export function BusinessSettings() {
  const [data, setData] = useState<Configuration | null>(null),
    [zones, setZones] = useState<BusinessConfig["deliveryZones"]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/business", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error);
        setData(value);
        setZones(value.settings.deliveryZones);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget),
      s = { ...data.settings };
    for (const key of [
      "legalName",
      "address",
      "serviceArea",
      "phone",
      "email",
      "mapUrl",
      "timeZone",
    ] as const)
      s[key] = String(form.get(key) || "").trim();
    for (const key of [
      "reservationMinutes",
      "slotMinutes",
      "leadMinutes",
      "earlySeatingMinutes",
      "horizonDays",
      "maxPartySize",
    ] as const)
      s[key] = Number(form.get(key));
    s.reservationsEnabled = form.get("reservationsEnabled") === "on";
    s.hours = days.flatMap((_, day) =>
      form.get(`closed_${day}`) === "on"
        ? []
        : [
            {
              day,
              opens: String(form.get(`opens_${day}`) || ""),
              closes: String(form.get(`closes_${day}`) || ""),
            },
          ],
    );
    s.deliveryMode = String(
      form.get("deliveryMode"),
    ) as BusinessConfig["deliveryMode"];
    s.minimumOrder = Math.round(Number(form.get("minimumOrder")) * 100);
    s.deliveryZones = zones;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const r = await fetch("/api/admin/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: data.version,
          settings: s,
          deliveryFee: Math.round(Number(form.get("deliveryFee")) * 100),
        }),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      setData({ ...data, ...value });
      setMessage(
        "Business configuration saved. Existing order and booking snapshots are preserved.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function tableSave(
    event: React.FormEvent<HTMLFormElement>,
    table?: Table,
  ) {
    event.preventDefault();
    const element = event.currentTarget,
      form = new FormData(element);
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const r = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(table ? { id: table.id, expectedVersion: table.version } : {}),
          label: form.get("label"),
          seats: Number(form.get("seats")),
          active: form.get("active") === "on",
        }),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      setMessage("Table saved.");
      if (!table) element.reset();
      setData((current) =>
        current
          ? {
              ...current,
              tables: (table
                ? current.tables.map((t) => (t.id === value.id ? value : t))
                : [...current.tables, value]
              ).sort((a, b) => a.label.localeCompare(b.label)),
            }
          : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Table could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  const s = data?.settings;
  return (
    <main id="main" className="pos-main business-settings">
      <div className="pos-heading">
        <div>
          <p className="eyebrow">OPERATING CONFIGURATION</p>
          <h1>Business & reservations</h1>
          <p>
            Supply real information. Empty values remain visibly unconfigured.
            Bookings stay closed until a valid schedule is enabled.
          </p>
        </div>
        <button
          className="pos-outline"
          onClick={() => setRevision((r) => r + 1)}
        >
          Reload configuration
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {!data && !error && <p role="status">Loading business configuration…</p>}
      {data && s && (
        <>
          <form
            onSubmit={save}
            className="settings-form"
            key={`settings-${revision}`}
          >
            <section>
              <h2>Location & contact</h2>
              <div className="settings-grid">
                {(
                  [
                    ["legalName", "Legal operator name"],
                    ["address", "Restaurant address"],
                    ["serviceArea", "Service area description"],
                    ["phone", "Contact phone"],
                    ["email", "Contact email"],
                    ["mapUrl", "Map link (HTTPS)"],
                    ["timeZone", "Restaurant timezone (IANA)"],
                  ] as const
                ).map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      defaultValue={s[name]}
                      type={
                        name === "email"
                          ? "email"
                          : name === "mapUrl"
                            ? "url"
                            : "text"
                      }
                      placeholder={
                        name === "timeZone"
                          ? "Choose the real timezone, e.g. Asia/Dhaka"
                          : "Not configured"
                      }
                      maxLength={
                        name === "mapUrl"
                          ? 1000
                          : name === "address"
                            ? 400
                            : 254
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
            <section>
              <h2>Weekly operating hours</h2>
              <p>
                One same-day opening window per weekday. Closed days have no
                booking slots. Overnight service needs a future scheduling
                extension.
              </p>
              <div className="hours-editor">
                {days.map((name, day) => {
                  const h = s.hours.find((h) => h.day === day);
                  return (
                    <fieldset key={day}>
                      <legend>{name}</legend>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name={`closed_${day}`}
                          defaultChecked={!h}
                        />
                        Closed
                      </label>
                      <label>
                        Opens
                        <input
                          type="time"
                          name={`opens_${day}`}
                          aria-label={`${name} opens`}
                          defaultValue={h?.opens || ""}
                        />
                      </label>
                      <label>
                        Closes
                        <input
                          type="time"
                          name={`closes_${day}`}
                          aria-label={`${name} closes`}
                          defaultValue={h?.closes || ""}
                        />
                      </label>
                    </fieldset>
                  );
                })}
              </div>
            </section>
            <section>
              <h2>Reservation rules</h2>
              <label className="checkbox-label">
                <input
                  name="reservationsEnabled"
                  type="checkbox"
                  defaultChecked={s.reservationsEnabled}
                />
                Open online reservations
              </label>
              <div className="settings-grid">
                {(
                  [
                    [
                      "reservationMinutes",
                      "Table hold including turnover (minutes)",
                      30,
                      240,
                    ],
                    ["slotMinutes", "Start-time interval (minutes)", 5, 60],
                    [
                      "leadMinutes",
                      "Minimum booking lead time (minutes)",
                      0,
                      10080,
                    ],
                    [
                      "earlySeatingMinutes",
                      "Allow seating early by (minutes)",
                      0,
                      60,
                    ],
                    ["horizonDays", "Book ahead up to (days)", 1, 180],
                    ["maxPartySize", "Maximum online party size", 1, 50],
                  ] as const
                ).map(([name, label, min, max]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type="number"
                      min={min}
                      max={max}
                      defaultValue={s[name]}
                      required
                    />
                  </label>
                ))}
              </div>
              <p>
                Allocation uses one active table large enough for the party.
                Tables are not automatically combined. Open POS checks block new
                bookings until closed.
              </p>
            </section>
            <section>
              <h2>Delivery rules</h2>
              <div className="settings-grid">
                <label>
                  Delivery mode
                  <select name="deliveryMode" defaultValue={s.deliveryMode}>
                    <option value="sample">
                      Sample flat fee · real service unconfigured
                    </option>
                    <option value="flat">Configured flat-fee service</option>
                    <option value="zones">Configured delivery zones</option>
                    <option value="disabled">Delivery unavailable</option>
                  </select>
                </label>
                <label>
                  Flat delivery fee (BDT)
                  <input
                    name="deliveryFee"
                    type="number"
                    min={0}
                    max={10000}
                    step="0.01"
                    defaultValue={data.deliveryFee / 100}
                    required
                  />
                </label>
                <label>
                  Minimum delivery food subtotal (BDT)
                  <input
                    name="minimumOrder"
                    type="number"
                    min={0}
                    max={100000}
                    step="0.01"
                    defaultValue={s.minimumOrder / 100}
                    required
                  />
                </label>
              </div>
              <div className="zone-editor">
                {zones.map((zone, i) => (
                  <fieldset key={zone.id}>
                    <legend>Delivery zone {i + 1}</legend>
                    <label>
                      Area name
                      <input
                        value={zone.name}
                        required
                        minLength={2}
                        maxLength={100}
                        onChange={(e) =>
                          setZones((rows) =>
                            rows.map((r) =>
                              r.id === zone.id
                                ? { ...r, name: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Fee (BDT)
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        step="0.01"
                        value={zone.fee / 100}
                        required
                        onChange={(e) =>
                          setZones((rows) =>
                            rows.map((r) =>
                              r.id === zone.id
                                ? {
                                    ...r,
                                    fee: Math.round(
                                      Number(e.target.value) * 100,
                                    ),
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Minimum food subtotal (BDT)
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        step="0.01"
                        value={zone.minimum / 100}
                        required
                        onChange={(e) =>
                          setZones((rows) =>
                            rows.map((r) =>
                              r.id === zone.id
                                ? {
                                    ...r,
                                    minimum: Math.round(
                                      Number(e.target.value) * 100,
                                    ),
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className="pos-outline"
                      type="button"
                      onClick={() =>
                        setZones((rows) => rows.filter((r) => r.id !== zone.id))
                      }
                    >
                      Remove zone
                    </button>
                  </fieldset>
                ))}
              </div>
              <button
                type="button"
                className="pos-outline"
                disabled={zones.length >= 30}
                onClick={() =>
                  setZones((rows) => [
                    ...rows,
                    { id: crypto.randomUUID(), name: "", fee: 0, minimum: 0 },
                  ])
                }
              >
                Add delivery zone
              </button>
            </section>
            <button className="button" disabled={busy}>
              Save business settings
            </button>
          </form>
          <section className="table-settings">
            <h2>Tables & capacity</h2>
            <p>
              Seeded tables are sample configuration. Set the real floor plan
              before opening bookings. Existing holds/checks prevent conflicting
              capacity reductions or deactivation.
            </p>
            {data.tables.map((table) => (
              <form
                key={`${table.id}-${table.version}`}
                onSubmit={(e) => void tableSave(e, table)}
              >
                <label>
                  Table label
                  <input
                    name="label"
                    defaultValue={table.label}
                    required
                    maxLength={30}
                  />
                </label>
                <label>
                  Seats
                  <input
                    name="seats"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={table.seats}
                    required
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={table.active}
                  />
                  Active
                </label>
                <button className="pos-outline" disabled={busy}>
                  Save table
                </button>
              </form>
            ))}
            <form onSubmit={(e) => void tableSave(e)}>
              <h3>Add a table</h3>
              <label>
                Table label
                <input name="label" required maxLength={30} />
              </label>
              <label>
                Seats
                <input name="seats" type="number" min={1} max={50} required />
              </label>
              <label className="checkbox-label">
                <input name="active" type="checkbox" defaultChecked />
                Active
              </label>
              <button className="button" disabled={busy}>
                Add table
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
