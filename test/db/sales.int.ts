// Tes integrasi ke Postgres (database kasir_in_test, dibuat ulang skemanya di setiap proses).
// Jalankan: npm run test:db
import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://kasir:kasir_dev_local@127.0.0.1:5432/kasir_in_test";
const { sql } = await import("../../src/lib/db.ts");
const { checkout, voidOrder } = await import("../../src/lib/sales.ts");
const { receivePurchase } = await import("../../src/lib/purchases.ts");
const { applyOpname } = await import("../../src/lib/stock.ts");
const { openShift, closeShift, addCashMove, shiftSummary } = await import("../../src/lib/shifts.ts");
const { report, lowStock } = await import("../../src/lib/reports.ts");

await sql`drop schema public cascade`;
await sql`create schema public`;
await sql.file("db/schema.sql");
after(() => sql.end());

const TABLES = "business, users, sessions, categories, products, stock_batches, stock_moves, suppliers, purchases, purchase_items, shifts, cash_moves, counters, orders, order_items, payments";
const day = (n = 0) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function setup(type: string, opts: Record<string, unknown> = {}) {
  await sql.unsafe(`truncate ${TABLES} restart identity cascade`);
  await sql`insert into business (name, type, tax_mode, tax_rate, service_rate) values ('Uji', ${type}, ${(opts.tax as string) ?? "off"}, 11, ${(opts.service as number) ?? 0})`;
  await openShift("Kasir Uji", 100000);
}
const product = async (name: string, o: { price?: number; cost?: number; stock?: number; service?: boolean; options?: unknown[]; unit?: string } = {}) => {
  const [p] = await sql`insert into products (name, price, cost, stock, is_service, options, unit) values (${name}, ${o.price ?? 10000}, ${o.cost ?? 6000}, ${o.stock ?? 0}, ${o.service ?? false}, ${sql.json((o.options ?? []) as never)}, ${o.unit ?? "pcs"}) returning id`;
  return p.id as number;
};
const stockOf = async (id: number) => (await sql`select stock from products where id = ${id}`)[0].stock as number;
const cash = (amount: number) => [{ method: "cash", amount }];

beforeEach(() => setup("retail"));

test("checkout retail: total, kembalian, HPP, stok, nomor urut", async () => {
  const a = await product("Mi", { price: 3500, cost: 2900, stock: 10 });
  const b = await product("Beras", { price: 14500, cost: 12800, stock: 20, unit: "kg" });
  const r = await checkout({ lines: [{ productId: a, qty: 2 }, { productId: b, qty: 2.5 }], payments: cash(50000) }, "Kasir Uji");
  assert.match(r.number, /^INV-\d{6}-0001$/);
  const [o] = await sql`select * from orders where id = ${r.id}`;
  assert.equal(o.total, 7000 + 36250);
  assert.equal(o.change, 50000 - 43250);
  assert.equal(o.cogs, 5800 + 32000);
  assert.equal(await stockOf(a), 8);
  assert.equal(await stockOf(b), 17.5);
  const [p] = await sql`select amount, tendered from payments where order_id = ${r.id}`;
  assert.deepEqual([p.amount, p.tendered], [43250, 50000]);
  const r2 = await checkout({ lines: [{ productId: a, qty: 1 }], payments: cash(3500) }, "Kasir Uji");
  assert.match(r2.number, /-0002$/);
});

test("checkout: stok kurang menggagalkan seluruh transaksi (tidak ada baris tertinggal)", async () => {
  const a = await product("Mi", { stock: 5 });
  const b = await product("Teh", { stock: 1 });
  await assert.rejects(checkout({ lines: [{ productId: a, qty: 2 }, { productId: b, qty: 2 }], payments: cash(100000) }, "K"), /Stok Teh tidak cukup/);
  assert.equal(await stockOf(a), 5);
  assert.equal((await sql`select count(*)::int n from orders`)[0].n, 0);
});

test("checkout: pecahan untuk kg, bilangan bulat untuk pcs, pembayaran kurang ditolak", async () => {
  const a = await product("Mi", { stock: 5 });
  await assert.rejects(checkout({ lines: [{ productId: a, qty: 1.5 }], payments: cash(99999) }, "K"), /bilangan bulat/);
  await assert.rejects(checkout({ lines: [{ productId: a, qty: 1 }], payments: cash(5000) }, "K"), /kurang/i);
  await assert.rejects(checkout({ lines: [], payments: [] }, "K"), /kosong/);
});

test("checkout: butuh shift terbuka", async () => {
  const a = await product("Mi", { stock: 5 });
  await sql`update shifts set closed_at = now()`;
  await assert.rejects(checkout({ lines: [{ productId: a, qty: 1 }], payments: cash(10000) }, "K"), /shift/i);
});

test("checkout: layanan tanpa stok tidak mengurangi stok & tidak diblokir", async () => {
  const s = await product("Cuci", { service: true, price: 20000 });
  const r = await checkout({ lines: [{ productId: s, qty: 3 }], payments: cash(60000) }, "K");
  assert.ok(r.id);
  assert.equal((await sql`select count(*)::int n from stock_moves`)[0].n, 0);
});

test("checkout: diskon baris + transaksi dan PPN dihitung server", async () => {
  await setup("retail", { tax: "exclusive" });
  const a = await product("Jaket", { price: 100000, cost: 60000, stock: 5 });
  const r = await checkout({ lines: [{ productId: a, qty: 2, discount: 20000 }], discount: { type: "pct", value: 10 }, payments: cash(200000) }, "K");
  const [o] = await sql`select subtotal, discount, tax, total, cogs from orders where id = ${r.id}`;
  assert.deepEqual([o.subtotal, o.discount, o.tax, o.total], [180000, 18000, 17820, 179820]);
  assert.equal(o.cogs, 120000);
});

test("void: stok kembali, transaksi tidak dihitung laporan, tidak bisa dua kali", async () => {
  const a = await product("Mi", { price: 5000, stock: 10 });
  const r = await checkout({ lines: [{ productId: a, qty: 4 }], payments: cash(20000) }, "K");
  assert.equal(await stockOf(a), 6);
  await voidOrder(r.id, "salah input");
  assert.equal(await stockOf(a), 10);
  await assert.rejects(voidOrder(r.id, "lagi"), /sudah dibatalkan/);
  await assert.rejects(voidOrder(r.id, " "), /Alasan/);
  const rep = await report("Asia/Jakarta", day(-1), day(1));
  assert.equal(rep.totals.orders, 0);
  assert.equal(rep.totals.voided, 1);
});

test("dua kasir bersamaan berebut stok terakhir: hanya satu yang berhasil", async () => {
  const a = await product("Langka", { stock: 1 });
  const go = () => checkout({ lines: [{ productId: a, qty: 1 }], payments: cash(10000) }, "K").then(() => "ok", () => "gagal");
  const res = await Promise.all([go(), go(), go()]);
  assert.equal(res.filter((x) => x === "ok").length, 1);
  assert.equal(await stockOf(a), 0);
});

test("opsi kafe: harga dari database, opsi wajib dicek, harga palsu tidak dipakai", async () => {
  await setup("fnb");
  const opts = [{ name: "Ukuran", required: true, multi: false, choices: [{ name: "Regular", price: 0 }, { name: "Large", price: 5000 }] }];
  const p = await product("Latte", { price: 28000, service: true, options: opts });
  await assert.rejects(checkout({ lines: [{ productId: p, qty: 1 }], payments: cash(100000) }, "K"), /pilih Ukuran/);
  const r = await checkout({ lines: [{ productId: p, qty: 2, options: [{ group: "Ukuran", choice: "Large" }], price: 1 } as never], payments: cash(100000), meta: { table: "7", type: "Makan di tempat", hack: "x" } }, "K");
  const [o] = await sql`select total, meta from orders where id = ${r.id}`;
  assert.equal(o.total, 66000);
  assert.deepEqual(o.meta, { table: "7", type: "Makan di tempat" });
});

test("apotek FEFO: batch terdekat dulu, kedaluwarsa dilewati, void mengembalikan ke batch asal", async () => {
  await setup("apotek");
  const p = await product("Paracetamol", { price: 4500 });
  const [old, soon, late] = await sql`
    insert into stock_batches (product_id, batch_no, expiry, qty) values
      (${p}, 'EXP', ${day(-5)}, 0), (${p}, 'SOON', ${day(30)}, 0), (${p}, 'LATE', ${day(300)}, 0) returning id`;
  const { moveStock } = await import("../../src/lib/stock.ts");
  await sql.begin(async (tx) => {
    await moveStock(tx, { productId: p, batchId: old.id, delta: 50, type: "adjust" });
    await moveStock(tx, { productId: p, batchId: soon.id, delta: 4, type: "adjust" });
    await moveStock(tx, { productId: p, batchId: late.id, delta: 10, type: "adjust" });
  });
  const r = await checkout({ lines: [{ productId: p, qty: 6 }], payments: cash(27000) }, "K");
  const q = async (id: number) => (await sql`select qty from stock_batches where id = ${id}`)[0].qty as number;
  assert.deepEqual([await q(old.id), await q(soon.id), await q(late.id)], [50, 0, 8]);
  await assert.rejects(checkout({ lines: [{ productId: p, qty: 9 }], payments: cash(99999) }, "K"), /tidak cukup/);
  await voidOrder(r.id, "batal");
  assert.deepEqual([await q(old.id), await q(soon.id), await q(late.id)], [50, 4, 10]);
  assert.equal(await stockOf(p), 64);
});

test("pembelian apotek: wajib batch + kedaluwarsa; batch sama ditambah; harga pokok diperbarui", async () => {
  await setup("apotek");
  const p = await product("Amox", { cost: 1000 });
  await assert.rejects(receivePurchase({ supplierId: null, invoiceNo: "", note: "", items: [{ productId: p, qty: 10, cost: 2000 }] }, "K"), /batch/);
  await assert.rejects(receivePurchase({ supplierId: null, invoiceNo: "", note: "", items: [{ productId: p, qty: 10, cost: 2000, batchNo: "B1" }] }, "K"), /kedaluwarsa/);
  const r = await receivePurchase({ supplierId: null, invoiceNo: "F-1", note: "", items: [{ productId: p, qty: 10, cost: 2000, batchNo: "B1", expiry: day(200) }] }, "K");
  assert.match(r.number, /^PB-\d{6}-0001$/);
  await receivePurchase({ supplierId: null, invoiceNo: "", note: "", items: [{ productId: p, qty: 5, cost: 2500, batchNo: "B1", expiry: day(200) }] }, "K");
  const [b] = await sql`select qty from stock_batches where product_id = ${p} and batch_no = 'B1'`;
  assert.equal(b.qty, 15);
  assert.equal(await stockOf(p), 15);
  assert.equal((await sql`select cost from products where id = ${p}`)[0].cost, 2500);
});

test("pembelian retail menambah stok; layanan ditolak", async () => {
  const a = await product("Mi", { stock: 2 });
  const s = await product("Jasa", { service: true });
  await receivePurchase({ supplierId: null, invoiceNo: "", note: "", items: [{ productId: a, qty: 10, cost: 3000 }] }, "K");
  assert.equal(await stockOf(a), 12);
  await assert.rejects(receivePurchase({ supplierId: null, invoiceNo: "", note: "", items: [{ productId: s, qty: 1, cost: 1 }] }, "K"), /tidak memiliki stok/);
});

test("stok opname: menyamakan stok, hanya selisih yang dicatat", async () => {
  const a = await product("A", { stock: 10 });
  const b = await product("B", { stock: 5 });
  const n = await applyOpname([{ productId: a, counted: 8 }, { productId: b, counted: 5 }], "akhir bulan");
  assert.equal(n, 1);
  assert.equal(await stockOf(a), 8);
  const [m] = await sql`select type, qty, balance, note from stock_moves where product_id = ${a}`;
  assert.deepEqual([m.type, m.qty, m.balance, m.note], ["opname", -2, 8, "akhir bulan"]);
  await assert.rejects(applyOpname([{ productId: a, counted: -1 }], ""), /tidak valid/);
});

test("shift: kas seharusnya = modal + tunai + kas masuk − kas keluar; void tidak dihitung; hanya satu shift terbuka", async () => {
  const a = await product("Mi", { price: 10000, stock: 50 });
  await checkout({ lines: [{ productId: a, qty: 3 }], payments: cash(30000) }, "K");                              // tunai 30.000
  await checkout({ lines: [{ productId: a, qty: 2 }], payments: [{ method: "qris", amount: 20000 }] }, "K");     // non-tunai
  const v = await checkout({ lines: [{ productId: a, qty: 1 }], payments: cash(10000) }, "K");
  await voidOrder(v.id, "batal");
  const [s] = await sql`select id from shifts where closed_at is null`;
  await addCashMove(s.id, "out", 5000, "beli galon");
  await addCashMove(s.id, "in", 20000, "tambah kembalian");
  const sum = await shiftSummary(s.id);
  assert.equal(sum.expected, 100000 + 30000 + 20000 - 5000);
  assert.equal(sum.orders, 2);
  await assert.rejects(openShift("Lain", 0), /Sudah ada shift/);
  await closeShift(s.id, 144000, "kurang seribu");
  const [c] = await sql`select expected_cash, counted_cash, closed_at from shifts where id = ${s.id}`;
  assert.deepEqual([c.expected_cash, c.counted_cash, c.closed_at !== null], [145000, 144000, true]);
  await assert.rejects(addCashMove(s.id, "in", 1000, "x"), /ditutup/);
});

test("laporan: omzet, laba, dan stok menipis", async () => {
  const a = await product("Mi", { price: 10000, cost: 7000, stock: 3 });
  await sql`update products set min_stock = 5 where id = ${a}`;
  await checkout({ lines: [{ productId: a, qty: 1 }], payments: cash(10000) }, "K");
  const r = await report("Asia/Jakarta", day(-1), day(1));
  assert.deepEqual([r.totals.orders, r.totals.revenue, r.totals.profit], [1, 10000, 3000]);
  assert.equal(r.top[0].name, "Mi");
  assert.equal((await lowStock(day(0))).length, 1);
});
