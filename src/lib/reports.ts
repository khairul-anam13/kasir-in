import "server-only";
import { sql } from "./db";
import { toCsv, type Cell } from "./csv.ts";
import { dateTimeOf, isoDayOf } from "./format.ts";
import { METHOD_LABEL } from "./profiles.ts";

export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400_000).toISOString().slice(0, 10);

/** Rentang hari (yyyy-mm-dd, inklusif) di zona waktu usaha. */
const inRange = (tz: string, from: string, to: string) =>
  sql`(o.created_at at time zone ${tz})::date between ${from}::date and ${to}::date`;

export type DayRow = { day: string; orders: number; revenue: number; profit: number };

export async function report(tz: string, from: string, to: string) {
  const [t] = await sql<{ orders: number; revenue: number; net: number; tax: number; service: number; discount: number; cogs: number; voided: number }[]>`
    select count(*) filter (where status = 'paid') orders,
           coalesce(sum(total) filter (where status = 'paid'), 0) revenue,
           coalesce(sum(total - tax - service) filter (where status = 'paid'), 0) net,
           coalesce(sum(tax) filter (where status = 'paid'), 0) tax,
           coalesce(sum(service) filter (where status = 'paid'), 0) service,
           coalesce(sum(discount) filter (where status = 'paid'), 0) discount,
           coalesce(sum(cogs) filter (where status = 'paid'), 0) cogs,
           count(*) filter (where status = 'void') voided
    from orders o where ${inRange(tz, from, to)}`;

  const days = await sql<{ day: string; orders: number; revenue: number; profit: number }[]>`
    select to_char((o.created_at at time zone ${tz})::date, 'YYYY-MM-DD') as day, count(*) orders, sum(total) revenue, sum(total - tax - service - cogs) profit
    from orders o where status = 'paid' and ${inRange(tz, from, to)} group by 1 order by 1`;
  const byDay: DayRow[] = [];
  for (let d = from; d <= to && byDay.length < 400; d = addDays(d, 1)) byDay.push(days.find((x) => x.day === d) ?? { day: d, orders: 0, revenue: 0, profit: 0 });

  const top = await sql<{ name: string; variant_label: string | null; qty: number; revenue: number }[]>`
    select oi.name, oi.variant_label, sum(oi.qty) qty, sum(oi.total) revenue
    from order_items oi join orders o on o.id = oi.order_id
    where o.status = 'paid' and ${inRange(tz, from, to)}
    group by oi.name, oi.variant_label order by revenue desc, qty desc limit 10`;

  const byCategory = await sql<{ name: string; qty: number; revenue: number }[]>`
    select coalesce(c.name, 'Tanpa kategori') name, sum(oi.qty) qty, sum(oi.total) revenue
    from order_items oi join orders o on o.id = oi.order_id
    left join products p on p.id = oi.product_id left join categories c on c.id = p.category_id
    where o.status = 'paid' and ${inRange(tz, from, to)} group by 1 order by revenue desc`;

  const byMethod = await sql<{ method: string; amount: number }[]>`
    select p.method, sum(p.amount) amount from payments p join orders o on o.id = p.order_id
    where o.status = 'paid' and ${inRange(tz, from, to)} group by 1 order by amount desc`;

  const [pur] = await sql<{ n: number; total: number }[]>`
    select count(*) n, coalesce(sum(total), 0) total from purchases o where ${inRange(tz, from, to)}`;

  return { totals: { ...t, profit: t.net - t.cogs, avg: t.orders ? Math.round(t.revenue / t.orders) : 0 }, byDay, top, byCategory, byMethod, purchases: pur };
}

/** Produk aktif yang stok jualnya (tanpa batch kedaluwarsa) sudah di/bawah batas minimum, atau habis. */
export async function lowStock(todayIso: string, limit = 50) {
  return sql<{ id: number; name: string; variant_label: string | null; unit: string; stock: number; min_stock: number }[]>`
    select p.id, p.name, p.variant_label, p.unit, p.stock - x.expired as stock, p.min_stock
    from products p
    cross join lateral (select coalesce(sum(b.qty), 0) expired from stock_batches b where b.product_id = p.id and b.expiry < ${todayIso}::date) x
    where p.active and not p.is_service and p.stock - x.expired <= p.min_stock and (p.min_stock > 0 or p.stock - x.expired <= 0)
    order by p.stock - x.expired - p.min_stock, p.name limit ${limit}`;
}

/** Batch yang sudah/akan kedaluwarsa dalam `days` hari (masih ada stoknya). */
export async function expiringBatches(todayIso: string, days = 90) {
  return sql<{ id: number; product_id: number; name: string; batch_no: string; expiry: string; qty: number; unit: string; days_left: number }[]>`
    select b.id, b.product_id, p.name, b.batch_no, to_char(b.expiry, 'YYYY-MM-DD') expiry, b.qty, p.unit, (b.expiry - ${todayIso}::date) days_left
    from stock_batches b join products p on p.id = b.product_id
    where b.qty > 0 and b.expiry is not null and b.expiry <= ${todayIso}::date + ${days}::int
    order by b.expiry, p.name`;
}

/* ---------- Ekspor CSV ---------- */
export const EXPORT_KINDS = ["transaksi", "item", "stok", "pembelian"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export async function exportCsv(kind: ExportKind, tz: string, from: string, to: string): Promise<string> {
  const when = (d: Date) => `${isoDayOf(d, tz)} ${dateTimeOf(d, tz).slice(-5)}`;
  if (kind === "transaksi") {
    const rows = await sql`
      select o.*, (select string_agg(p.method || ':' || p.amount, ', ' order by p.id) from payments p where p.order_id = o.id) pay
      from orders o where ${inRange(tz, from, to)} order by o.id`;
    return toCsv([
      ["No", "Waktu", "Kasir", "Status", "Subtotal", "Diskon", "Service", "Pajak", "Total", "HPP", "Laba", "Pembayaran", "Kembalian", "Keterangan"],
      ...rows.map((r): Cell[] => [r.number, when(r.created_at), r.cashier_name, r.status === "void" ? "VOID" : "Lunas", r.subtotal, r.discount, r.service, r.tax, r.total, r.cogs,
        r.status === "void" ? 0 : r.total - r.tax - r.service - r.cogs,
        String(r.pay ?? "").replace(/(cash|qris|transfer|card):/g, (_, m) => METHOD_LABEL[m] + " "), r.change,
        Object.values(r.meta as Record<string, string>).join(" / ")]),
    ]);
  }
  if (kind === "item") {
    const rows = await sql`
      select o.number, o.created_at, o.status, oi.name, oi.variant_label, oi.unit, oi.qty, oi.price, oi.discount, oi.total, oi.cost, oi.options, oi.note
      from order_items oi join orders o on o.id = oi.order_id where ${inRange(tz, from, to)} order by o.id, oi.id`;
    return toCsv([
      ["No transaksi", "Waktu", "Status", "Item", "Varian", "Satuan", "Qty", "Harga", "Diskon", "Jumlah", "HPP satuan", "Opsi", "Catatan"],
      ...rows.map((r): Cell[] => [r.number, when(r.created_at), r.status === "void" ? "VOID" : "Lunas", r.name, r.variant_label, r.unit, r.qty, r.price, r.discount, r.total, r.cost,
        (r.options as { name: string }[]).map((o) => o.name).join(", "), r.note]),
    ]);
  }
  if (kind === "stok") {
    const rows = await sql`
      select p.*, c.name category from products p left join categories c on c.id = p.category_id where not p.is_service order by c.name nulls last, p.name, p.variant_label`;
    return toCsv([
      ["Nama", "Varian", "Kategori", "SKU", "Barcode", "Satuan", "Stok", "Stok minimum", "Harga beli", "Harga jual", "Nilai stok (beli)", "Aktif"],
      ...rows.map((r): Cell[] => [r.name, r.variant_label, r.category, r.sku, r.barcode, r.unit, r.stock, r.min_stock, r.cost, r.price, Math.round(r.stock * r.cost), r.active ? "ya" : "tidak"]),
    ]);
  }
  const rows = await sql`
    select o.number, o.created_at, o.supplier_name, o.invoice_no, pi.name, pi.qty, pi.cost, pi.batch_no, pi.expiry
    from purchases o join purchase_items pi on pi.purchase_id = o.id where ${inRange(tz, from, to)} order by o.id, pi.id`;
  return toCsv([
    ["No", "Waktu", "Supplier", "No faktur", "Barang", "Qty", "Harga beli", "Jumlah", "Batch", "Kedaluwarsa"],
    ...rows.map((r): Cell[] => [r.number, when(r.created_at), r.supplier_name, r.invoice_no, r.name, r.qty, r.cost, Math.round(r.qty * r.cost), r.batch_no, r.expiry ? isoDayOf(r.expiry, "UTC") : ""]),
  ]);
}
