import "server-only";
import { sql } from "./db";

export type OrderRow = {
  id: number; number: string; shift_id: number | null; cashier_name: string; status: "paid" | "void";
  subtotal: number; discount: number; service: number; tax: number; total: number; cogs: number; change: number;
  meta: Record<string, string>; note: string; void_reason: string | null; voided_at: Date | null; created_at: Date;
};
export type ItemRow = {
  id: number; product_id: number | null; name: string; variant_label: string | null; unit: string; qty: number;
  price: number; cost: number; discount: number; options: { group: string; name: string; price: number }[]; note: string; total: number;
};
export type PaymentRow = { id: number; method: string; amount: number; tendered: number };

export async function getOrder(id: number) {
  if (!Number.isInteger(id)) return null;
  const [order] = await sql<OrderRow[]>`select * from orders where id = ${id}`;
  if (!order) return null;
  const items = await sql<ItemRow[]>`select * from order_items where order_id = ${id} order by id`;
  const payments = await sql<PaymentRow[]>`select id, method, amount, tendered from payments where order_id = ${id} order by id`;
  return { order, items, payments };
}
