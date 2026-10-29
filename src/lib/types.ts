export type MenuItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image: string;
  allergens: string[];
  available: boolean;
  featured: boolean;
};
export type Category = {
  id: string;
  name: string;
  slug: string;
  items: MenuItem[];
};
export type Menu = {
  name: string;
  currency: string;
  deliveryFee: number;
  categories: Category[];
};
export type CartLine = { menuItemId: string; quantity: number };
export type TrackedOrder = {
  id: string;
  status: string;
  fulfillment: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  payment: { method: string; status: string } | null;
  events: { status: string; createdAt: string }[];
};
