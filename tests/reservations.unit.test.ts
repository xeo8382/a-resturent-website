import { describe, it, expect } from "vitest";
import {
  businessSchema,
  deliveryQuote,
  defaultBusiness,
} from "../src/lib/business-config";
import {
  zonedTime,
  reservationWindow,
  timesForDate,
  calendarDate,
} from "../src/lib/reservation-time";
const configured = businessSchema.parse({
  timeZone: "Asia/Dhaka",
  reservationsEnabled: true,
  hours: [{ day: 5, opens: "12:00", closes: "22:00" }],
  leadMinutes: 30,
});
describe("reservation calendar and operating rules", () => {
  it("keeps default booking availability closed without invented hours", () => {
    expect(defaultBusiness.reservationsEnabled).toBe(false);
    expect(defaultBusiness.hours).toEqual([]);
    expect(timesForDate(defaultBusiness, "2026-10-30")).toEqual([]);
  });
  it("validates calendar dates instead of normalizing impossible dates", () => {
    expect(() => calendarDate("2026-02-30")).toThrow();
    expect(() => calendarDate("not-a-date")).toThrow();
  });
  it("converts restaurant time independently of server/browser timezone", () => {
    expect(
      zonedTime("2026-12-01", "12:00", "Asia/Kathmandu").toISOString(),
    ).toBe("2026-12-01T06:15:00.000Z");
    expect(
      zonedTime("2026-12-01", "18:00", "America/New_York").toISOString(),
    ).toBe("2026-12-01T23:00:00.000Z");
  });
  it("rejects both skipped and ambiguous daylight-saving times", () => {
    expect(() => zonedTime("2026-03-08", "02:30", "America/New_York")).toThrow(
      "clock change",
    );
    expect(() => zonedTime("2026-11-01", "01:30", "America/New_York")).toThrow(
      "clock change",
    );
  });
  it("enforces closing time, lead time, closed days, slot alignment and booking horizon", () => {
    const now = new Date("2026-10-30T05:00:00Z");
    expect(
      reservationWindow(
        configured,
        "2026-10-30",
        "12:00",
        now,
      ).endsAt.toISOString(),
    ).toBe("2026-10-30T07:30:00.000Z");
    expect(() =>
      reservationWindow(configured, "2026-10-30", "21:00", now),
    ).toThrow("closing");
    expect(() =>
      reservationWindow(configured, "2026-10-30", "12:15", now),
    ).toThrow("hours");
    expect(() =>
      reservationWindow(configured, "2026-10-31", "12:00", now),
    ).toThrow("hours");
    expect(() =>
      reservationWindow(
        configured,
        "2026-10-30",
        "12:00",
        new Date("2026-10-30T05:45:00Z"),
      ),
    ).toThrow("lead");
    expect(() =>
      reservationWindow(
        { ...configured, horizonDays: 1 },
        "2026-11-06",
        "12:00",
        now,
      ),
    ).toThrow("window");
  });
  it("only generates slots that fit the actual configured window", () => {
    const slots = timesForDate(
      configured,
      "2026-10-30",
      new Date("2026-10-30T05:00:00Z"),
    );
    expect(slots[0].time).toBe("12:00");
    expect(slots.at(-1)!.time).toBe("20:30");
  });
  it("rejects invalid timezone, overlapping weekday definitions and unsupported overnight hours", () => {
    expect(() => businessSchema.parse({ timeZone: "Fake/Town" })).toThrow();
    expect(() =>
      businessSchema.parse({
        hours: [{ day: 1, opens: "22:00", closes: "02:00" }],
      }),
    ).toThrow();
    expect(() =>
      businessSchema.parse({
        hours: [
          { day: 1, opens: "12:00", closes: "20:00" },
          { day: 1, opens: "13:00", closes: "21:00" },
        ],
      }),
    ).toThrow();
  });
});
describe("delivery quotes", () => {
  const id = "7ed159b9-dd89-4df7-9bcf-ea841ed4d358";
  const zones = {
    ...defaultBusiness,
    deliveryMode: "zones" as const,
    minimumOrder: 50000,
    deliveryZones: [{ id, name: "Configured area", fee: 4500, minimum: 70000 }],
  };
  it("preserves the existing sample flat fee and free pickup", () => {
    expect(deliveryQuote(defaultBusiness, "DELIVERY", 100000, 6000).fee).toBe(
      6000,
    );
    expect(deliveryQuote(zones, "PICKUP", 100, 6000).fee).toBe(0);
  });
  it("uses configured zone fees and the larger minimum food subtotal", () => {
    expect(deliveryQuote(zones, "DELIVERY", 80000, 6000, id)).toMatchObject({
      fee: 4500,
      minimum: 70000,
      error: "",
    });
    expect(deliveryQuote(zones, "DELIVERY", 69999, 6000, id).error).toContain(
      "minimum",
    );
  });
  it("rejects unknown zones and disabled delivery", () => {
    expect(
      deliveryQuote(zones, "DELIVERY", 80000, 6000, "missing").error,
    ).toContain("zone");
    expect(
      deliveryQuote(
        { ...defaultBusiness, deliveryMode: "disabled" },
        "DELIVERY",
        80000,
        6000,
      ).error,
    ).toContain("unavailable");
  });
});
