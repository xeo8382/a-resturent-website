import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./errors";
import type { StaffActor } from "./pos-orders";
const fields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(600),
  categoryId: z.string().min(1).max(80),
  allergens: z.array(z.string().trim().min(1).max(48)).max(12),
  price: z.number().int().min(100).max(10000000),
  available: z.boolean(),
};
export const menuCreateSchema = z
  .object({
    ...fields,
    slug: z
      .string()
      .min(2)
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use a lowercase slug with letters, numbers and hyphens.",
      ),
  })
  .strict();
export const menuUpdateSchema = z
  .object({
    id: z.string(),
    price: fields.price,
    available: fields.available,
    name: fields.name.optional(),
    description: fields.description.optional(),
    categoryId: fields.categoryId.optional(),
    allergens: fields.allergens.optional(),
  })
  .strict();
export async function manageMenu(
  input: unknown,
  user: StaffActor,
  create = false,
) {
  if (!["ADMIN", "MANAGER"].includes(user.role))
    throw new HttpError(403, "Menu management permission is required.");
  const data = create
    ? menuCreateSchema.parse(input)
    : menuUpdateSchema.parse(input);
  if (
    data.categoryId &&
    !(await db.menuCategory.findFirst({
      where: { id: data.categoryId, restaurantId: user.restaurantId },
    }))
  )
    throw new HttpError(404, "Category not found in your restaurant.");
  try {
    if (create) {
      const value = menuCreateSchema.parse(input);
      const item = await db.menuItem.create({
        data: {
          ...value,
          restaurantId: user.restaurantId,
          image: "/images/garden.svg",
        },
      });
      return { id: item.id };
    }
    const { id, ...update } = menuUpdateSchema.parse(input);
    const changed = await db.menuItem.updateMany({
      where: { id, restaurantId: user.restaurantId },
      data: update,
    });
    if (!changed.count) throw new HttpError(404, "Menu item not found.");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new HttpError(
        409,
        "This menu slug is already in use. Choose another.",
      );
    throw e;
  }
}
