import "server-only";
import { sql, type Tx } from "./db";
import { UserError } from "./errors.ts";
import { fmtQty } from "./format.ts";

export type MoveType = "sale" | "void" | "purchase" | "opname" | "adjust";
export type Move = {
  productId: number; delta: number; type: MoveType; batchId?: number | null;
  refType?: "order" | "purchase"; refId?: number; note?: string;
};

/** Ubah stok (dan batch bila ada) lalu catat mutasinya. Mengembalikan total stok produk sesudahnya. */
export async function moveStock(tx: Tx, m: Move): Promise<number> {
  if (m.batchId) {
    const [b] = await tx`update stock_batches set qty = qty + ${m.delta} where id = ${m.batchId} and qty + ${m.delta} >= 0 returning id`;
    if (!b) throw new UserError("Stok batch tidak mencukupi");
  }
  const [p] = await tx`update products set stock = stock + ${m.delta} where id = ${m.productId} returning stock`;
  await tx`insert into stock_moves (product_id, batch_id, type, qty, balance, ref_type, ref_id, note)
           values (${m.productId}, ${m.batchId ?? null}, ${m.type}, ${m.delta}, ${p.stock}, ${m.refType ?? null}, ${m.refId ?? null}, ${m.note ?? ""})`;
  return p.stock;
}

/**
 * Keluarkan `qty` dari batch-batch produk dengan urutan FEFO (kedaluwarsa paling dekat dulu).
 * Batch yang sudah lewat tanggal tidak dipakai. Mengembalikan pembagian per batch.
 */
export async function consumeFefo(tx: Tx, productId: number, qty: number, todayIso: string, name: string) {
  const batches = await tx`
    select id, qty from stock_batches
    where product_id = ${productId} and qty > 0 and (expiry is null or expiry >= ${todayIso}::date)
    order by expiry nulls last, id for update`;
  const out: { batchId: number; qty: number }[] = [];
  let left = qty;
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(b.qty, left);
    out.push({ batchId: b.id, qty: take });
    left = Math.round((left - take) * 1000) / 1000;
  }
  if (left > 0) throw new UserError(`Stok ${name} tidak cukup (tersedia ${fmtQty(qty - left)}; batch kedaluwarsa tidak dihitung)`);
  return out;
}

export type OpnameRow = { productId: number; batchId?: number | null; counted: number };

/** Stok opname: samakan stok sistem dengan hasil hitung fisik. Hanya baris yang berbeda yang dicatat. Mengembalikan jumlah baris yang disesuaikan. */
export async function applyOpname(rows: OpnameRow[], note: string): Promise<number> {
  if (rows.some((r) => !Number.isFinite(r.counted) || r.counted < 0)) throw new UserError("Jumlah hitung tidak valid");
  let changed = 0;
  await sql.begin(async (tx) => {
    for (const r of rows) {
      const [cur] = r.batchId
        ? await tx`select qty as v from stock_batches where id = ${r.batchId} and product_id = ${r.productId} for update`
        : await tx`select stock as v from products where id = ${r.productId} and not is_service for update`;
      if (!cur) continue;
      const delta = Math.round((r.counted - cur.v) * 1000) / 1000;
      if (delta === 0) continue;
      await moveStock(tx, { productId: r.productId, batchId: r.batchId ?? null, delta, type: "opname", note });
      changed++;
    }
  });
  return changed;
}
