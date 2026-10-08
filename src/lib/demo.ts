import "server-only";
import type { Tx } from "./db";
import { isoDayOf } from "./format.ts";
import { computeTotals, lineTotal, type Rates } from "./pricing.ts";
import { PROFILES, type OptionGroup, type ProfileId } from "./profiles.ts";
import { moveStock } from "./stock.ts";

type Demo = {
  cat: string; name: string; variant?: string; unit?: string; price: number; cost: number;
  stock?: number; min?: number; noStock?: boolean; rx?: boolean; options?: OptionGroup[];
  /** apotek: batch [hari sampai kedaluwarsa, jumlah] */
  batches?: [number, number][];
};

const og = (name: string, required: boolean, multi: boolean, ...choices: [string, number][]): OptionGroup =>
  ({ name, required, multi, choices: choices.map(([n, price]) => ({ name: n, price })) });

const UKURAN = og("Ukuran", true, false, ["Regular", 0], ["Large", 5000]);
const SUHU = og("Suhu", true, false, ["Panas", 0], ["Dingin", 0]);
const GULA = og("Gula", false, false, ["Normal", 0], ["Sedikit", 0], ["Tanpa gula", 0]);
const TAMBAH = og("Tambahan", false, true, ["Extra shot", 6000], ["Susu oat", 7000], ["Boba", 5000]);
const PEDAS = og("Level pedas", true, false, ["Tidak pedas", 0], ["Sedang", 0], ["Pedas", 0]);
const LAUK = og("Tambahan", false, true, ["Telur", 5000], ["Ayam suwir", 8000], ["Kerupuk", 2000]);

function variants(base: Omit<Demo, "variant" | "stock">, labels: string[], stocks: number[]): Demo[] {
  return labels.map((variant, i) => ({ ...base, variant, stock: stocks[i % stocks.length] }));
}

const DEMO: Record<ProfileId, Demo[]> = {
  retail: [
    { cat: "Makanan", name: "Mi Instan Goreng", price: 3500, cost: 2900, stock: 120, min: 24 },
    { cat: "Makanan", name: "Biskuit Kelapa 300g", unit: "pak", price: 12500, cost: 10000, stock: 36, min: 10 },
    { cat: "Makanan", name: "Roti Tawar", price: 16000, cost: 13500, stock: 14, min: 5 },
    { cat: "Makanan", name: "Telur Ayam", unit: "kg", price: 28000, cost: 25500, stock: 18.5, min: 5 },
    { cat: "Makanan", name: "Keripik Kentang 70g", price: 9500, cost: 7600, stock: 40, min: 10 },
    { cat: "Minuman", name: "Air Mineral 600ml", unit: "botol", price: 4000, cost: 2800, stock: 96, min: 24 },
    { cat: "Minuman", name: "Teh Botol 450ml", unit: "botol", price: 5500, cost: 4200, stock: 60, min: 12 },
    { cat: "Minuman", name: "Kopi Sachet", unit: "sachet", price: 2000, cost: 1500, stock: 150, min: 30 },
    { cat: "Minuman", name: "Susu UHT Coklat 200ml", price: 6500, cost: 5200, stock: 48, min: 12 },
    { cat: "Minuman", name: "Minuman Isotonik 500ml", unit: "botol", price: 7500, cost: 5800, stock: 30, min: 12 },
    { cat: "Sembako", name: "Beras Premium", unit: "kg", price: 14500, cost: 12800, stock: 85, min: 20 },
    { cat: "Sembako", name: "Gula Pasir", unit: "kg", price: 17500, cost: 15800, stock: 40, min: 10 },
    { cat: "Sembako", name: "Minyak Goreng", unit: "liter", price: 18500, cost: 16800, stock: 35, min: 12 },
    { cat: "Sembako", name: "Tepung Terigu", unit: "kg", price: 12000, cost: 10400, stock: 22, min: 8 },
    { cat: "Sembako", name: "Garam Halus 250g", price: 3500, cost: 2500, stock: 50, min: 10 },
    { cat: "Kebutuhan Rumah", name: "Sabun Cuci Piring 400ml", price: 9500, cost: 7700, stock: 28, min: 8 },
    { cat: "Kebutuhan Rumah", name: "Deterjen Bubuk 800g", unit: "pak", price: 21500, cost: 18400, stock: 15, min: 6 },
    { cat: "Kebutuhan Rumah", name: "Tisu Gulung", price: 6000, cost: 4300, stock: 40, min: 10 },
    { cat: "Kebutuhan Rumah", name: "Sabun Mandi Batang", price: 4500, cost: 3300, stock: 3, min: 10 },
  ],
  fnb: [
    { cat: "Kopi", name: "Espresso", price: 18000, cost: 5500, noStock: true, options: [TAMBAH] },
    { cat: "Kopi", name: "Americano", price: 22000, cost: 6000, noStock: true, options: [UKURAN, SUHU, TAMBAH] },
    { cat: "Kopi", name: "Cafe Latte", price: 28000, cost: 9000, noStock: true, options: [UKURAN, SUHU, GULA, TAMBAH] },
    { cat: "Kopi", name: "Cappuccino", price: 28000, cost: 9000, noStock: true, options: [UKURAN, SUHU, GULA, TAMBAH] },
    { cat: "Kopi", name: "Kopi Susu Gula Aren", price: 26000, cost: 8500, noStock: true, options: [UKURAN, SUHU, GULA, TAMBAH] },
    { cat: "Non-Kopi", name: "Matcha Latte", price: 30000, cost: 11000, noStock: true, options: [UKURAN, SUHU, GULA] },
    { cat: "Non-Kopi", name: "Teh Lemon", price: 18000, cost: 4500, noStock: true, options: [UKURAN, SUHU, GULA] },
    { cat: "Non-Kopi", name: "Coklat Panas", price: 26000, cost: 9500, noStock: true, options: [UKURAN, SUHU] },
    { cat: "Non-Kopi", name: "Air Mineral", unit: "botol", price: 8000, cost: 3000, stock: 48, min: 12 },
    { cat: "Makanan Berat", name: "Nasi Goreng Kampung", unit: "porsi", price: 32000, cost: 12000, noStock: true, options: [PEDAS, LAUK] },
    { cat: "Makanan Berat", name: "Mi Goreng Jawa", unit: "porsi", price: 30000, cost: 11000, noStock: true, options: [PEDAS, LAUK] },
    { cat: "Makanan Berat", name: "Ayam Geprek", unit: "porsi", price: 28000, cost: 11500, noStock: true, options: [PEDAS, LAUK] },
    { cat: "Camilan", name: "Kentang Goreng", unit: "porsi", price: 20000, cost: 6500, noStock: true },
    { cat: "Camilan", name: "Roti Bakar Coklat Keju", unit: "porsi", price: 22000, cost: 7500, noStock: true },
    { cat: "Camilan", name: "Pisang Goreng", unit: "porsi", price: 18000, cost: 5500, noStock: true },
    { cat: "Dessert", name: "Brownies", unit: "porsi", price: 20000, cost: 8000, noStock: true },
  ],
  apotek: [
    { cat: "Obat Bebas", name: "Paracetamol 500mg", unit: "strip", price: 4500, cost: 3000, min: 20, batches: [[300, 60], [40, 14]] },
    { cat: "Obat Bebas", name: "Antasida Doen", unit: "strip", price: 3500, cost: 2200, min: 20, batches: [[420, 80]] },
    { cat: "Obat Bebas", name: "Vitamin C 500mg", unit: "strip", price: 6000, cost: 4000, min: 15, batches: [[380, 50]] },
    { cat: "Obat Bebas Terbatas", name: "CTM 4mg", unit: "strip", price: 2500, cost: 1500, min: 20, batches: [[250, 70]] },
    { cat: "Obat Bebas Terbatas", name: "Sirup Batuk 60ml", unit: "botol", price: 15000, cost: 11000, min: 8, batches: [[200, 18], [-12, 3]] },
    { cat: "Obat Keras", name: "Amoxicillin 500mg", unit: "strip", price: 12000, cost: 8500, min: 15, rx: true, batches: [[330, 40]] },
    { cat: "Obat Keras", name: "Metformin 500mg", unit: "strip", price: 9000, cost: 5500, min: 15, rx: true, batches: [[410, 45]] },
    { cat: "Obat Keras", name: "Amlodipine 5mg", unit: "strip", price: 11000, cost: 6500, min: 15, rx: true, batches: [[365, 30]] },
    { cat: "Vitamin & Suplemen", name: "Multivitamin Dewasa", unit: "botol", price: 45000, cost: 33000, min: 5, batches: [[500, 20]] },
    { cat: "Vitamin & Suplemen", name: "Minyak Ikan Omega-3", unit: "botol", price: 78000, cost: 60000, min: 4, batches: [[450, 4]] },
    { cat: "Alat Kesehatan", name: "Masker Medis 50 pcs", unit: "box", price: 25000, cost: 17000, min: 6, batches: [[600, 25]] },
    { cat: "Alat Kesehatan", name: "Termometer Digital", unit: "pcs", price: 45000, cost: 32000, min: 3, batches: [[900, 8]] },
    { cat: "Alat Kesehatan", name: "Plester Luka", unit: "box", price: 12000, cost: 8000, min: 8, batches: [[700, 30]] },
    { cat: "Perawatan", name: "Hand Sanitizer 100ml", unit: "botol", price: 12000, cost: 8000, min: 10, batches: [[480, 35]] },
    { cat: "Perawatan", name: "Minyak Kayu Putih 60ml", unit: "botol", price: 18000, cost: 13500, min: 10, batches: [[540, 28]] },
  ],
  jasa: [
    { cat: "Layanan", name: "Servis Ringan Motor", unit: "kali", price: 65000, cost: 10000, noStock: true },
    { cat: "Layanan", name: "Servis Besar Motor", unit: "kali", price: 185000, cost: 35000, noStock: true },
    { cat: "Layanan", name: "Ganti Oli (jasa)", unit: "kali", price: 15000, cost: 0, noStock: true },
    { cat: "Layanan", name: "Tambal Ban", unit: "kali", price: 15000, cost: 2000, noStock: true },
    { cat: "Layanan", name: "Cuci Motor", unit: "kali", price: 20000, cost: 3000, noStock: true },
    { cat: "Layanan", name: "Cuci Mobil", unit: "kali", price: 45000, cost: 8000, noStock: true },
    { cat: "Paket", name: "Paket Hemat Servis + Cuci", unit: "paket", price: 75000, cost: 13000, noStock: true },
    { cat: "Suku Cadang / Produk", name: "Oli Mesin 1L", unit: "liter", price: 55000, cost: 42000, stock: 24, min: 6 },
    { cat: "Suku Cadang / Produk", name: "Kampas Rem Depan", unit: "set", price: 85000, cost: 60000, stock: 10, min: 3 },
    { cat: "Suku Cadang / Produk", name: "Busi", unit: "pcs", price: 28000, cost: 19000, stock: 30, min: 8 },
    { cat: "Suku Cadang / Produk", name: "Filter Udara", unit: "pcs", price: 45000, cost: 31000, stock: 2, min: 4 },
  ],
  fashion: [
    ...variants({ cat: "Atasan", name: "Kaos Polos Premium", price: 75000, cost: 38000, min: 3 }, ["M / Hitam", "L / Hitam", "XL / Hitam", "M / Putih", "L / Putih", "XL / Putih"], [12, 15, 8, 10, 14, 2]),
    ...variants({ cat: "Atasan", name: "Kemeja Flanel Kotak", price: 189000, cost: 105000, min: 2 }, ["M / Merah", "L / Merah", "XL / Merah"], [6, 8, 4]),
    ...variants({ cat: "Atasan", name: "Blouse Linen", price: 149000, cost: 80000, min: 2 }, ["S / Sage", "M / Sage", "L / Sage"], [5, 7, 3]),
    ...variants({ cat: "Bawahan", name: "Celana Chino Slim", price: 259000, cost: 140000, min: 2 }, ["30 / Khaki", "32 / Khaki", "34 / Khaki", "30 / Navy", "32 / Navy", "34 / Navy"], [4, 6, 5, 3, 7, 4]),
    ...variants({ cat: "Bawahan", name: "Rok Plisket", price: 129000, cost: 70000, min: 2 }, ["All size / Hitam", "All size / Navy"], [9, 6]),
    ...variants({ cat: "Outer", name: "Jaket Denim", price: 349000, cost: 190000, min: 1 }, ["M / Biru", "L / Biru"], [4, 3]),
    ...variants({ cat: "Outer", name: "Hoodie Zip", price: 229000, cost: 125000, min: 2 }, ["M / Abu", "L / Abu", "XL / Abu"], [7, 9, 5]),
    ...variants({ cat: "Sepatu", name: "Sneakers Canvas", price: 299000, cost: 165000, min: 2 }, ["39 / Putih", "40 / Putih", "41 / Putih", "42 / Putih"], [3, 6, 6, 4]),
    { cat: "Tas & Aksesori", name: "Tote Bag Kanvas", price: 89000, cost: 42000, stock: 18, min: 4 },
    ...variants({ cat: "Tas & Aksesori", name: "Topi Baseball", price: 65000, cost: 30000, min: 3 }, ["Hitam", "Krem"], [12, 9]),
  ],
};

/** PRNG kecil berbiji supaya data demo selalu sama. */
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400_000).toISOString().slice(0, 10);

/** Isi kategori + produk contoh (+ stok awal/batch) untuk jenis usaha ini. Mengembalikan jumlah produk. */
export async function seedCatalog(tx: Tx, type: ProfileId, tz: string): Promise<number> {
  const profile = PROFILES[type];
  const today = isoDayOf(new Date(), tz);
  const cats = new Map<string, number>();
  for (const [i, name] of profile.categories.entries()) {
    const [c] = await tx`insert into categories (name, sort) values (${name}, ${i}) on conflict (name) do update set sort = excluded.sort returning id`;
    cats.set(name, c.id);
  }
  const typeNo = Object.keys(PROFILES).indexOf(type) + 1;
  let n = 0;
  for (const d of DEMO[type]) {
    n++;
    const tracked = !d.noStock;
    const barcode = profile.features.barcode ? `899${typeNo}${String(n).padStart(8, "0")}` : null;
    const [p] = await tx`
      insert into products (category_id, name, variant_label, sku, barcode, unit, price, cost, is_service, min_stock, options, requires_rx)
      values (${cats.get(d.cat) ?? null}, ${d.name}, ${d.variant ?? null}, ${`${type.slice(0, 2).toUpperCase()}-${String(n).padStart(3, "0")}`}, ${barcode}, ${d.unit ?? profile.units[0]},
              ${d.price}, ${d.cost}, ${!tracked}, ${d.min ?? 0}, ${tx.json(d.options ?? [])}, ${d.rx ?? false})
      returning id`;
    if (!tracked) continue;
    if (profile.features.batches) {
      for (const [i, [days, qty]] of (d.batches ?? []).entries()) {
        const [b] = await tx`insert into stock_batches (product_id, batch_no, expiry, qty, cost)
                             values (${p.id}, ${`B${String(n).padStart(2, "0")}${i + 1}`}, ${addDays(today, days)}::date, 0, ${d.cost}) returning id`;
        await moveStock(tx, { productId: p.id, delta: qty, type: "adjust", batchId: b.id, note: "Stok awal (data contoh)" });
      }
    } else if (d.stock) {
      await moveStock(tx, { productId: p.id, delta: d.stock, type: "adjust", note: "Stok awal (data contoh)" });
    }
  }
  return n;
}

/**
 * Riwayat penjualan contoh `days` hari ke belakang (shift sudah ditutup), supaya dashboard & laporan tidak kosong saat demo.
 * ponytail: stok tidak dikurangi oleh riwayat ini (stok demo = kondisi sekarang). Hapus lewat "Mulai dari awal" di Pengaturan.
 */
export async function seedHistory(tx: Tx, type: ProfileId, tz: string, rates: Rates, cashier: string, days = 10) {
  const rnd = mulberry32(2026);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const prods = await tx`select id, name, variant_label, unit, price, cost, options from products where active order by id`;
  if (!prods.length) return;
  const today = isoDayOf(new Date(), tz);
  const metaFor = (): Record<string, string> => {
    const f = PROFILES[type].orderFields.find((x) => x.choices);
    return f ? { [f.key]: pick(f.choices!) } : {};
  };

  for (let back = days; back >= 1; back--) {
    const day = addDays(today, -back);
    const weekend = [0, 6].includes(new Date(day).getUTCDay());
    const count = Math.round((weekend ? 14 : 9) + rnd() * 6);
    const opening = 200000;
    const [sh] = await tx`insert into shifts (cashier_name, opened_at, opening_cash) values (${cashier}, (${day}::date + time '07:55') at time zone ${tz}, ${opening}) returning id`;
    let cash = 0;
    const times = Array.from({ length: count }, () => 8 * 60 + Math.floor(rnd() * 13 * 60)).sort((a, b) => a - b);
    for (const [i, mins] of times.entries()) {
      const hhmm = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 3.5) }, () => {
        const p = pick(prods);
        const groups = (p.options ?? []) as OptionGroup[];
        const chosen = groups.filter((g) => g.required).map((g) => ({ group: g.name, name: g.choices[0].name, price: g.choices[0].price }));
        const price = p.price + chosen.reduce((a, c) => a + c.price, 0);
        const qty = 1 + Math.floor(rnd() * (p.price < 20000 ? 3 : 2));
        return { p, chosen, price, qty, total: lineTotal(price, qty) };
      });
      const t = computeTotals(lines.map((l) => l.total), rates);
      const r = rnd();
      const method = r < 0.55 ? "cash" : r < 0.85 ? "qris" : r < 0.93 ? "transfer" : "card";
      const tendered = method === "cash" ? Math.ceil(t.total / 5000) * 5000 : t.total;
      const change = tendered - t.total;
      const cogs = lines.reduce((a, l) => a + Math.round(l.p.cost * l.qty), 0);
      const key = `INV-${day.slice(2).replaceAll("-", "")}`;
      const [o] = await tx`
        insert into orders (number, shift_id, cashier_name, subtotal, discount, service, tax, total, cogs, change, meta, created_at)
        values (${`${key}-${String(i + 1).padStart(4, "0")}`}, ${sh.id}, ${cashier}, ${t.subtotal}, ${t.discount}, ${t.service}, ${t.tax}, ${t.total}, ${cogs}, ${change}, ${tx.json(metaFor())},
                (${day}::date + ${hhmm}::time) at time zone ${tz})
        returning id`;
      await tx`insert into order_items ${tx(lines.map((l) => ({
        order_id: o.id, product_id: l.p.id, name: l.p.name, variant_label: l.p.variant_label, unit: l.p.unit, qty: l.qty,
        price: l.price, cost: l.p.cost, discount: 0, options: tx.json(l.chosen), total: l.total,
      })))}`;
      if (t.total > 0) await tx`insert into payments (order_id, method, amount, tendered) values (${o.id}, ${method}, ${t.total}, ${tendered})`;
      if (method === "cash") cash += t.total;
    }
    const diff = rnd() < 0.3 ? -Math.floor(rnd() * 3) * 1000 : 0;
    await tx`update shifts set closed_at = (${day}::date + time '21:30') at time zone ${tz}, expected_cash = ${opening + cash}, counted_cash = ${opening + cash + diff} where id = ${sh.id}`;
    await tx`insert into counters (key, n) values (${`INV-${day.slice(2).replaceAll("-", "")}`}, ${count}) on conflict (key) do update set n = greatest(counters.n, excluded.n)`;
  }
}
