import "server-only";
import { sql } from "./db";
import { readBusiness } from "./biz.ts";
import { UserError } from "./errors.ts";
import { isoDayOf } from "./format.ts";
import { nextNumber } from "./sales.ts";
import { moveStock } from "./stock.ts";

export type PurchaseInput = {
  supplierId: number | null; invoiceNo: string; note: string;
  items: { productId: number; qty: number; cost: number; batchNo?: string; expiry?: string }[];
};

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Catat barang masuk dari supplier: menambah stok (per batch untuk apotek) dan memperbarui harga pokok terakhir. */
export async function receivePurchase(input: PurchaseInput, user: string): Promise<{ id: number; number: string }> {
  if (!input.items.length) throw new UserError("Tambahkan minimal satu barang");
  return sql.begin(async (tx) => {
    const { biz, profile } = await readBusiness(tx);
    const ids = [...new Set(input.items.map((i) => i.productId))].sort((a, b) => a - b);
    const prods = await tx`select * from products where id in ${tx(ids)} order by id for update`;
    const byId = new Map(prods.map((p) => [p.id as number, p]));

    let supplierName = "";
    if (input.supplierId) {
      const [s] = await tx`select name from suppliers where id = ${input.supplierId}`;
      if (!s) throw new UserError("Supplier tidak ditemukan");
      supplierName = s.name;
    }

    const rows = input.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new UserError("Ada barang yang tidak ditemukan");
      if (p.is_service) throw new UserError(`${p.name} tidak memiliki stok`);
      if (!(i.qty > 0) || i.qty > 1_000_000) throw new UserError(`Jumlah ${p.name} tidak valid`);
      if (!(i.cost >= 0) || i.cost > 1_000_000_000) throw new UserError(`Harga beli ${p.name} tidak valid`);
      if (profile.features.batches) {
        if (!i.batchNo?.trim()) throw new UserError(`${p.name}: no. batch wajib diisi`);
        if (!isDate(i.expiry)) throw new UserError(`${p.name}: tanggal kedaluwarsa wajib diisi`);
      }
      return { p, qty: i.qty, cost: Math.round(i.cost), batchNo: i.batchNo?.trim().slice(0, 40) || null, expiry: isDate(i.expiry) ? i.expiry : null };
    });

    const total = rows.reduce((a, r) => a + Math.round(r.qty * r.cost), 0);
    const number = await nextNumber(tx, "PB", isoDayOf(new Date(), biz.timezone));
    const [pur] = await tx`
      insert into purchases (number, supplier_id, supplier_name, invoice_no, note, total, created_by)
      values (${number}, ${input.supplierId}, ${supplierName}, ${input.invoiceNo.trim().slice(0, 60)}, ${input.note.trim().slice(0, 200)}, ${total}, ${user})
      returning id, number`;
    await tx`insert into purchase_items ${tx(rows.map((r) => ({
      purchase_id: pur.id, product_id: r.p.id, name: r.p.name + (r.p.variant_label ? ` (${r.p.variant_label})` : ""),
      qty: r.qty, cost: r.cost, batch_no: r.batchNo, expiry: r.expiry,
    })))}`;

    for (const r of rows) {
      let batchId: number | null = null;
      if (profile.features.batches) {
        const [b] = await tx`
          insert into stock_batches (product_id, batch_no, expiry, qty, cost) values (${r.p.id}, ${r.batchNo!}, ${r.expiry}, 0, ${r.cost})
          on conflict (product_id, batch_no) do update set expiry = excluded.expiry, cost = excluded.cost
          returning id`;
        batchId = b.id;
      }
      await moveStock(tx, { productId: r.p.id, delta: r.qty, type: "purchase", batchId, refType: "purchase", refId: pur.id, note: supplierName });
      // ponytail: harga pokok = harga beli terakhir. Rata-rata bergerak kalau selisih harga antar pembelian besar.
      if (r.cost > 0) await tx`update products set cost = ${r.cost} where id = ${r.p.id}`;
    }
    return { id: pur.id as number, number: pur.number as string };
  });
}
