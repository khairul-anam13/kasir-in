// Perhitungan tagihan & pembayaran. Fungsi murni — dipakai UI kasir (pratinjau) dan server (yang menentukan).

export type TaxMode = "off" | "exclusive" | "inclusive";
export type DiscountInput = { type: "pct" | "amt"; value: number };
export type Rates = { taxMode: TaxMode; taxRate: number; serviceRate: number };
export type Totals = {
  subtotal: number;   // jumlah baris setelah diskon baris
  discount: number;   // diskon transaksi (nominal)
  service: number;
  tax: number;
  total: number;
  netSales: number;   // penjualan bersih tanpa pajak & service (dasar hitung laba)
};

const rp = (n: number) => Math.round(n);

/** Jumlah satu baris: harga × qty − diskon baris (tidak pernah negatif). */
export const lineTotal = (price: number, qty: number, discount = 0) =>
  Math.max(0, rp(price * qty) - Math.min(rp(price * qty), Math.max(0, rp(discount))));

export function computeTotals(lines: number[], rates: Rates, discount?: DiscountInput): Totals {
  const subtotal = lines.reduce((a, b) => a + b, 0);
  const d = !discount || !(discount.value > 0) ? 0
    : discount.type === "pct" ? rp(subtotal * Math.min(100, discount.value) / 100)
    : Math.min(subtotal, rp(discount.value));
  const base = subtotal - d;
  const service = rp(base * rates.serviceRate / 100);
  const gross = base + service;
  const tax = rates.taxMode === "off" ? 0
    : rates.taxMode === "exclusive" ? rp(gross * rates.taxRate / 100)
    : rp(gross * rates.taxRate / (100 + rates.taxRate));
  const total = rates.taxMode === "exclusive" ? gross + tax : gross;
  return { subtotal, discount: d, service, tax, total, netSales: total - tax - service };
}

export type PaymentInput = { method: string; amount: number };
export type AppliedPayment = { method: string; amount: number; tendered: number };
export type PaymentResult =
  | { ok: true; payments: AppliedPayment[]; change: number }
  | { ok: false; error: string };

/**
 * Validasi pembayaran (boleh gabungan beberapa metode). Kelebihan bayar hanya boleh dari tunai dan menjadi kembalian;
 * nilai tunai yang dicatat = uang diterima − kembalian.
 */
export function settle(total: number, inputs: PaymentInput[]): PaymentResult {
  const byMethod = new Map<string, number>();
  for (const p of inputs) {
    const a = rp(p.amount);
    if (!(a > 0)) continue;
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + a);
  }
  const sum = [...byMethod.values()].reduce((a, b) => a + b, 0);
  if (sum < total) return { ok: false, error: `Pembayaran kurang Rp${(total - sum).toLocaleString("id-ID")}` };
  const excess = sum - total;
  const cash = byMethod.get("cash") ?? 0;
  if (excess > 0 && excess >= cash) return { ok: false, error: "Kelebihan bayar hanya boleh dari tunai dan harus lebih kecil dari uang tunai" };
  const payments = [...byMethod].map(([method, tendered]) => ({ method, tendered, amount: method === "cash" ? tendered - excess : tendered }));
  return { ok: true, payments, change: excess };
}
