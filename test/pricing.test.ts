import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, lineTotal, settle } from "../src/lib/pricing.ts";

const off = { taxMode: "off", taxRate: 11, serviceRate: 0 } as const;

test("lineTotal: pembulatan, diskon tidak membuat negatif", () => {
  assert.equal(lineTotal(1000, 2.5), 2500);
  assert.equal(lineTotal(3333, 3, 100), 9899);
  assert.equal(lineTotal(1000, 1, 5000), 0);
});

test("computeTotals: tanpa pajak + diskon persen & nominal", () => {
  assert.deepEqual(computeTotals([50000, 25000], off), { subtotal: 75000, discount: 0, service: 0, tax: 0, total: 75000, netSales: 75000 });
  assert.equal(computeTotals([100000], off, { type: "pct", value: 10 }).total, 90000);
  assert.equal(computeTotals([100000], off, { type: "amt", value: 150000 }).total, 0); // diskon dibatasi subtotal
  assert.equal(computeTotals([100000], off, { type: "pct", value: 250 }).total, 0);
});

test("computeTotals: PPN ditambahkan (exclusive)", () => {
  const t = computeTotals([100000], { taxMode: "exclusive", taxRate: 11, serviceRate: 0 });
  assert.equal(t.tax, 11000);
  assert.equal(t.total, 111000);
  assert.equal(t.netSales, 100000);
});

test("computeTotals: PPN sudah termasuk (inclusive) tidak menambah total", () => {
  const t = computeTotals([111000], { taxMode: "inclusive", taxRate: 11, serviceRate: 0 });
  assert.equal(t.total, 111000);
  assert.equal(t.tax, 11000);
  assert.equal(t.netSales, 100000);
});

test("computeTotals: service charge dihitung sebelum PPN", () => {
  const t = computeTotals([100000], { taxMode: "exclusive", taxRate: 10, serviceRate: 5 }, { type: "amt", value: 10000 });
  assert.equal(t.service, 4500);          // 5% dari 90.000
  assert.equal(t.tax, 9450);              // 10% dari 94.500
  assert.equal(t.total, 103950);
  assert.equal(t.netSales, 90000);
});

test("settle: uang pas, kembalian tunai, dan pembayaran gabungan", () => {
  assert.deepEqual(settle(50000, [{ method: "cash", amount: 50000 }]), { ok: true, payments: [{ method: "cash", tendered: 50000, amount: 50000 }], change: 0 });
  const r = settle(42500, [{ method: "cash", amount: 50000 }]);
  assert.ok(r.ok && r.change === 7500 && r.payments[0].amount === 42500 && r.payments[0].tendered === 50000);
  const split = settle(100000, [{ method: "qris", amount: 60000 }, { method: "cash", amount: 50000 }]);
  assert.ok(split.ok && split.change === 10000);
  assert.equal(split.ok && split.payments.find((p) => p.method === "cash")?.amount, 40000);
});

test("settle: kurang bayar & kelebihan non-tunai ditolak", () => {
  assert.equal(settle(50000, [{ method: "cash", amount: 20000 }]).ok, false);
  assert.equal(settle(50000, [{ method: "qris", amount: 60000 }]).ok, false);
  assert.equal(settle(50000, [{ method: "qris", amount: 50000 }, { method: "cash", amount: 10000 }]).ok, false); // kembalian = seluruh uang tunai
});

test("settle: baris metode sama digabung, nominal nol diabaikan", () => {
  const r = settle(30000, [{ method: "cash", amount: 10000 }, { method: "cash", amount: 20000 }, { method: "card", amount: 0 }]);
  assert.ok(r.ok && r.payments.length === 1 && r.payments[0].tendered === 30000);
});
