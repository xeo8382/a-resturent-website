import { z } from "zod";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const businessSchema = z
  .object({
    legalName: z.string().trim().max(160).default(""),
    address: z.string().trim().max(400).default(""),
    serviceArea: z.string().trim().max(300).default(""),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^$|^\+?[0-9 ()-]{8,30}$/, "Enter a valid contact phone.")
      .default(""),
    email: z.union([z.literal(""), z.email().max(254)]).default(""),
    mapUrl: z
      .union([
        z.literal(""),
        z
          .url()
          .max(1000)
          .refine((v) => v.startsWith("https://"), "Map URL must use HTTPS."),
      ])
      .default(""),
    timeZone: z
      .string()
      .max(80)
      .refine((v) => {
        if (!v) return true;
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid IANA timezone.")
      .default(""),
    hours: z
      .array(
        z
          .object({
            day: z.number().int().min(0).max(6),
            opens: clock,
            closes: clock,
          })
          .strict(),
      )
      .max(7)
      .default([]),
    reservationsEnabled: z.boolean().default(false),
    reservationMinutes: z.number().int().min(30).max(240).default(90),
    slotMinutes: z
      .number()
      .int()
      .min(5)
      .max(60)
      .refine((n) => 60 % n === 0, "Slot interval must divide one hour.")
      .default(30),
    leadMinutes: z.number().int().min(0).max(10080).default(60),
    earlySeatingMinutes: z.number().int().min(0).max(60).default(15),
    horizonDays: z.number().int().min(1).max(180).default(60),
    maxPartySize: z.number().int().min(1).max(50).default(12),
    deliveryMode: z
      .enum(["sample", "flat", "zones", "disabled"])
      .default("sample"),
    minimumOrder: z.number().int().min(0).max(10000000).default(0),
    deliveryZones: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: z.string().trim().min(2).max(100),
            fee: z.number().int().min(0).max(1000000),
            minimum: z.number().int().min(0).max(10000000),
          })
          .strict(),
      )
      .max(30)
      .default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.hours.map((h) => h.day)).size !== v.hours.length)
      ctx.addIssue({ code: "custom", message: "Configure each weekday once." });
    if (v.hours.some((h) => h.opens >= h.closes))
      ctx.addIssue({
        code: "custom",
        message:
          "Closing time must follow opening time on the same day. Overnight service is not supported.",
      });
    if (v.reservationsEnabled && (!v.timeZone || !v.hours.length))
      ctx.addIssue({
        code: "custom",
        message:
          "Set a timezone and operating hours before opening reservations.",
      });
    if (
      v.reservationsEnabled &&
      !v.hours.some(
        (h) => minutes(h.closes) - minutes(h.opens) >= v.reservationMinutes,
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "At least one opening window must fit the table hold duration.",
      });
    if (v.deliveryMode === "zones" && !v.deliveryZones.length)
      ctx.addIssue({
        code: "custom",
        message: "Add a delivery zone before enabling zone delivery.",
      });
    if (
      new Set(v.deliveryZones.map((zone) => zone.id)).size !==
        v.deliveryZones.length ||
      new Set(v.deliveryZones.map((zone) => zone.name.toLowerCase())).size !==
        v.deliveryZones.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Delivery zone IDs and names must be unique.",
      });
  });
export type BusinessConfig = z.infer<typeof businessSchema>;
export const defaultBusiness = businessSchema.parse({});
export function readBusiness(value: unknown): BusinessConfig {
  return businessSchema.parse(value ?? {});
}
export function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function clockTime(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
export function deliveryQuote(
  config: BusinessConfig,
  fulfillment: "DELIVERY" | "PICKUP" | "DINE_IN",
  subtotal: number,
  fallbackFee: number,
  zoneId?: string,
) {
  if (fulfillment !== "DELIVERY")
    return { fee: 0, minimum: 0, zone: null, error: "" };
  if (config.deliveryMode === "disabled")
    return {
      fee: 0,
      minimum: 0,
      zone: null,
      error: "Delivery is unavailable. Choose pickup.",
    };
  const zone =
    config.deliveryMode === "zones"
      ? config.deliveryZones.find((z) => z.id === zoneId)
      : null;
  if (config.deliveryMode === "zones" && !zone)
    return {
      fee: 0,
      minimum: 0,
      zone: null,
      error: "Select a configured delivery zone.",
    };
  const minimum = Math.max(config.minimumOrder, zone?.minimum ?? 0);
  return {
    fee: zone?.fee ?? fallbackFee,
    minimum,
    zone: zone?.name ?? null,
    error:
      subtotal < minimum
        ? "The food subtotal is below the delivery minimum."
        : "",
  };
}
