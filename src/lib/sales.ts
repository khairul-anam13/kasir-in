import "server-only";
import { sql, type Tx } from "./db";
import { readBusiness } from "./biz.ts";
import { UserError } from "./errors.ts";
import { fmtQty, isoDayOf } from "./format.ts";
import { resolveOptions, type ChosenOption, type Picked } from "./options.ts";
import { computeTotals, lineTotal, settle, type DiscountInput, type PaymentInput } from "./pricing.ts";
import { isFractionalUnit, isMethod, type OptionGroup } from "./profiles.ts";
import { consumeFefo, moveStock } from "./stock.ts";

export type CartLine = { productId: number; qty: number; discount?: number; note?: string; options?: Picked[] };
export type CheckoutInput = {
  lines: CartLine[]; discount?: DiscountInput; payments: PaymentInput[];
  meta?: Record<string, string>; note?: string;
};

/** Nomor urut harian: PREFIX-yymmdd-0001. Harus dipanggil di dalam transaksi. */
export async function nextNumber(tx: Tx, prefix: string, dayIso: string) {
  const key = `${prefix}-${dayIso.slice(2).replaceAll("-", "")}`;
  const [{ n }] = await tx`insert into counters (key, n) values (${key}, 1) on conflict (key) do update set n = counters.n + 1 returning n`;
  return `${key}-${String(n).padStart(4, "0")}`;
}

/**
 * Catat penjualan. Semua harga & total dihitung ulang di server dari database; klien hanya mengirim
 * apa yang dipilih. Satu transaksi: nomor, baris, pembayaran, dan pengurangan stok berhasil atau gagal bersama.
 */
export async function checkout(input: CheckoutInput, cashier: string): Promise<{ id: number; number: string }> {
  if (!Array.isArray(input?.lines) || input.lines.length === 0) throw new UserError("Keranjang masih kosong");
  if (!Array.isArray(input.payments)) throw new UserError("Pembayaran tidak valid");
  if (input.lines.length > 200) throw new UserError("Terlalu banyak baris dalam satu transaksi");

  return sql.begin(async (tx) => {
    const { biz, profile, rates } = await readBusiness(tx);
    const [shift] = await tx`select id from shifts where closed_at is null`;
    if (!shift) throw new UserError("Belum ada shift yang dibuka. Buka shift dulu di menu Shift.");

    const ids = [...new Set(input.lines.map((l) => Number(l.productId)))].sort((a, b) => a - b);
    if (ids.some((i) => !Number.isInteger(i))) throw new UserError("Item tidak valid");
    const prods = await tx`select * from products where id in ${tx(ids)} order by id for update`;
    const byId = new Map(prods.map((p) => [p.id as number, p]));

    const items = input.lines.map((l) => {
      const p = byId.get(Number(l.productId));
      if (!p || !p.active) throw new UserError("Ada item yang sudah tidak tersedia. Muat ulang halaman kasir.");
      const frac = isFractionalUnit(p.unit);
      const qty = frac ? Math.round(Number(l.qty) * 1000) / 1000 : Number(l.qty);
      if (!(qty > 0) || qty > 100000) throw new UserError(`Jumlah ${p.name} tidak valid`);
      if (!frac && !Number.isInteger(qty)) throw new UserError(`Jumlah ${p.name} harus bilangan bulat`);
      const chosen: ChosenOption[] = resolveOptions((p.options ?? []) as OptionGroup[], l.options ?? [], p.name);
      const price = p.price + chosen.reduce((a, c) => a + c.price, 0);
      const total = lineTotal(price, qty, Number(l.discount) || 0);
      return { p, qty, price, total, discount: Math.round(price * qty) - total, chosen, note: String(l.note ?? "").trim().slice(0, 120) };
    });

    const d = input.discount;
    if (d && (!(d.type === "pct" || d.type === "amt") || !Number.isFinite(d.value) || d.value < 0)) throw new UserError("Diskon tidak valid");
    const totals = computeTotals(items.map((i) => i.total), rates, d);

    if (input.payments.some((p) => !isMethod(p.method))) throw new UserError("Metode pembayaran tidak dikenal");
    const paid = settle(totals.total, input.payments);
    if (!paid.ok) throw new UserError(paid.error);

    const meta: Record<string, string> = {};
    for (const f of profile.orderFields) {
      const v = String(input.meta?.[f.key] ?? "").trim().slice(0, 80);
      if (v && (!f.choices || f.choices.includes(v))) meta[f.key] = v;
    }

    const day = isoDayOf(new Date(), biz.timezone);
    const number = await nextNumber(tx, "INV", day);
    const cogs = items.reduce((a, i) => a + Math.round(i.p.cost * i.qty), 0);
    const [o] = await tx`
      insert into orders (number, shift_id, cashier_name, subtotal, discount, service, tax, total, cogs, change, meta, note)
      values (${number}, ${shift.id}, ${cashier}, ${totals.subtotal}, ${totals.discount}, ${totals.service}, ${totals.tax}, ${totals.total},
              ${cogs}, ${paid.change}, ${tx.json(meta)}, ${String(input.note ?? "").trim().slice(0, 200)})
      returning id, number`;
    await tx`insert into order_items ${tx(items.map((i) => ({
      order_id: o.id, product_id: i.p.id, name: i.p.name, variant_label: i.p.variant_label, unit: i.p.unit, qty: i.qty,
      price: i.price, cost: i.p.cost, discount: i.discount, options: tx.json(i.chosen), note: i.note, total: i.total,
    })))}`;
    if (paid.payments.length) await tx`insert into payments ${tx(paid.payments.map((p) => ({ order_id: o.id, ...p })))}`;

    // Stok: gabungkan baris dari produk yang sama (mis. opsi berbeda) sebelum dicek.
    const need = new Map<number, number>();
    for (const i of items) if (!i.p.is_service) need.set(i.p.id, (need.get(i.p.id) ?? 0) + i.qty);
    for (const [pid, qty] of need) {
      const p = byId.get(pid)!;
      const ref = { type: "sale", refType: "order", refId: o.id } as const;
      if (profile.features.batches) {
        for (const c of await consumeFefo(tx, pid, qty, day, p.name)) await moveStock(tx, { productId: pid, delta: -c.qty, batchId: c.batchId, ...ref });
      } else {
        if (!biz.allowNegativeStock && p.stock < qty) throw new UserError(`Stok ${p.name}${p.variant_label ? ` (${p.variant_label})` : ""} tidak cukup (tersedia ${fmtQty(p.stock)})`);
        await moveStock(tx, { productId: pid, delta: -qty, ...ref });
      }
    }
    return { id: o.id as number, number: o.number as string };
  });
}

/** Batalkan transaksi: stok dikembalikan persis ke batch asalnya. Transaksi tetap tercatat berstatus void. */
export async function voidOrder(orderId: number, reason: string) {
  const why = reason.trim().slice(0, 200);
  if (!why) throw new UserError("Alasan pembatalan wajib diisi");
  await sql.begin(async (tx) => {
    const [o] = await tx`select id, status from orders where id = ${orderId} for update`;
    if (!o) throw new UserError("Transaksi tidak ditemukan");
    if (o.status === "void") throw new UserError("Transaksi ini sudah dibatalkan");
    const moves = await tx`select product_id, batch_id, qty from stock_moves where ref_type = 'order' and ref_id = ${orderId} and type = 'sale' order by id`;
    for (const m of moves) await moveStock(tx, { productId: m.product_id, batchId: m.batch_id, delta: -m.qty, type: "void", refType: "order", refId: orderId, note: why });
    await tx`update orders set status = 'void', void_reason = ${why}, voided_at = now() where id = ${orderId}`;
  });
}
