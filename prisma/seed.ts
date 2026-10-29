import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/crypto";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  const email = process.env.SEED_ADMIN_EMAIL;
  if (password && (password.length < 12 || !email))
    throw new Error(
      "Set a seed email and a password of at least 12 characters.",
    );
  const restaurant = await db.restaurant.upsert({
    where: { slug: "ember-table" },
    update: {},
    create: { slug: "ember-table", name: "Ember & Table", deliveryFee: 6000 },
  });
  const categories = [
    ["From the fire", "fire"],
    ["Small plates", "small-plates"],
    ["Something sweet", "dessert"],
    ["To sip", "drinks"],
  ];
  const categoryIds: string[] = [];
  for (const [position, [name, slug]] of categories.entries()) {
    const category = await db.menuCategory.upsert({
      where: { restaurantId_slug: { restaurantId: restaurant.id, slug } },
      update: {},
      create: { restaurantId: restaurant.id, name, slug, position },
    });
    categoryIds.push(category.id);
  }
  const items = [
    {
      slug: "fire-roasted-chicken",
      name: "Fire-roasted chicken",
      description:
        "Charred chicken, smoked pepper glaze, herb rice and a bright lemon finish.",
      price: 68000,
      category: 0,
      image: "/images/chicken.svg",
      allergens: ["Dairy"],
      featured: true,
    },
    {
      slug: "ember-beef-bowl",
      name: "The ember beef bowl",
      description:
        "Slow-cooked beef, warm grains, roasted vegetables and our smoky house sauce.",
      price: 79000,
      category: 0,
      image: "/images/beef.svg",
      allergens: ["Soy", "Gluten"],
      featured: true,
    },
    {
      slug: "garden-harvest",
      name: "Garden harvest bowl",
      description:
        "Fire-kissed seasonal vegetables, chickpeas, soft grains and tahini dressing.",
      price: 52000,
      category: 0,
      image: "/images/garden.svg",
      allergens: ["Sesame"],
      featured: true,
    },
    {
      slug: "crispy-potatoes",
      name: "Crispy golden potatoes",
      description:
        "Twice-cooked potatoes with rosemary, flaky salt and garlic yoghurt.",
      price: 26000,
      category: 1,
      image: "/images/potatoes.svg",
      allergens: ["Dairy"],
      featured: false,
    },
    {
      slug: "burrata-tomatoes",
      name: "Burrata & tomatoes",
      description:
        "Creamy burrata, ripe tomatoes, basil oil and toasted sourdough.",
      price: 48000,
      category: 1,
      image: "/images/garden.svg",
      allergens: ["Dairy", "Gluten"],
      featured: false,
    },
    {
      slug: "dark-chocolate",
      name: "Dark chocolate moment",
      description:
        "Warm chocolate cake, vanilla cream and a pinch of sea salt.",
      price: 34000,
      category: 2,
      image: "/images/chocolate.svg",
      allergens: ["Dairy", "Eggs", "Gluten"],
      featured: false,
    },
    {
      slug: "citrus-cooler",
      name: "Citrus & mint cooler",
      description:
        "Fresh lime, orange, garden mint and sparkling water. Alcohol free.",
      price: 18000,
      category: 3,
      image: "/images/citrus.svg",
      allergens: [],
      featured: false,
    },
  ];
  for (const item of items) {
    const { category, ...data } = item;
    await db.menuItem.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...data,
        restaurantId: restaurant.id,
        categoryId: categoryIds[category],
      },
    });
  }
  for (let i = 1; i <= 8; i++)
    await db.table.upsert({
      where: {
        restaurantId_label: {
          restaurantId: restaurant.id,
          label: `T${i.toString().padStart(2, "0")}`,
        },
      },
      update: {},
      create: {
        restaurantId: restaurant.id,
        label: `T${i.toString().padStart(2, "0")}`,
        seats: i <= 4 ? 2 : 4,
      },
    });
  if (password && email) {
    await db.user.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: {
        restaurantId: restaurant.id,
        email: email.toLowerCase(),
        name: "Restaurant administrator",
        role: "ADMIN",
        passwordHash: hashPassword(password),
      },
    });
    console.log(
      "Seed account ensured; an existing account password is never overwritten.",
    );
  } else
    console.log("No seed password supplied; staff account creation skipped.");
  console.log(
    "Sample restaurant, 7 placeholder dishes and 8 tables ensured. This is demonstration content.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
