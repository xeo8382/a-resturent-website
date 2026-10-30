import { z } from "zod";
export const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(2).max(80),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a valid phone number."),
    fulfillment: z.enum(["DELIVERY", "PICKUP"]),
    deliveryZoneId: z.uuid().optional(),
    address: z.string().trim().max(400).optional(),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(
        z
          .object({
            menuItemId: z.string().min(1).max(80),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    idempotencyKey: z.uuid(),
    trackingToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.fulfillment === "DELIVERY" &&
      (!value.address || value.address.length < 10)
    )
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "A delivery address of at least 10 characters is required.",
      });
    if (
      new Set(value.items.map((i) => i.menuItemId)).size !== value.items.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate menu items are not allowed.",
      });
  });
export const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});
export const statusSchema = z
  .object({
    status: z.enum([
      "ACCEPTED",
      "PREPARING",
      "READY",
      "OUT_FOR_DELIVERY",
      "COMPLETED",
      "CANCELLED",
    ]),
    expectedStatus: z.enum([
      "PLACED",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "OUT_FOR_DELIVERY",
    ]),
    cashCollected: z.boolean().optional(),
  })
  .strict();
