import type { MenuItem } from "./types";
export type PosCategory = {
  id: string;
  name: string;
  slug: string;
  items: MenuItem[];
};
export type PosTable = {
  id: string;
  label: string;
  seats: number;
  reservationHold?: {
    id: string;
    status: string;
    startsAt: string;
    endsAt: string;
    date?: string;
  } | null;
  orders: {
    id: string;
    customerName: string;
    status: string;
    total: number;
    source: string;
    createdAt: string;
  }[];
};
