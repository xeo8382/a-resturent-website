import { z } from "zod";
import type { Role } from "@prisma/client";
import { HttpError } from "./errors";
export const serviceRoles: Role[] = ["STAFF", "MANAGER", "ADMIN"];
export function assertServiceRole(role: Role) {
  if (!serviceRoles.includes(role))
    throw new HttpError(403, "Service staff permissions are required.");
}
export const staffOrderSchema = z
  .object({
    fulfillment: z.enum(["DINE_IN", "PICKUP"]),
    tableId: z.string().min(1).max(80).nullable().optional(),
    reservationId: z.string().min(1).max(80).optional(),
    customerName: z.string().trim().min(2).max(80).default("Walk-in guest"),
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
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.reservationId && (data.fulfillment !== "DINE_IN" || !data.tableId))
      ctx.addIssue({
        code: "custom",
        message: "A seated reservation requires its dine-in table.",
      });
    if (data.fulfillment === "DINE_IN" && !data.tableId)
      ctx.addIssue({ code: "custom", message: "Select a table for dine-in." });
    if (data.fulfillment === "PICKUP" && data.tableId)
      ctx.addIssue({
        code: "custom",
        message: "Pickup orders cannot claim a table.",
      });
    if (new Set(data.items.map((i) => i.menuItemId)).size !== data.items.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate menu items are not allowed.",
      });
  });
