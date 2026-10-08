// Profil jenis usaha. Satu instalasi = satu usaha; jenisnya dipilih saat setup pertama dan hanya mengubah
// istilah, isian, dan fitur yang tampil — skema database sama untuk semua jenis.
// Aman dipakai di server maupun client (tanpa import server-only).

export type ProfileId = "retail" | "fnb" | "apotek" | "jasa" | "fashion";

export type OptionGroup = { name: string; required: boolean; multi: boolean; choices: { name: string; price: number }[] };
export type OrderField = { key: string; label: string; placeholder?: string; choices?: string[] };

export type Profile = {
  id: ProfileId;
  name: string;
  tagline: string;
  examples: string;
  /** Hue OKLCH untuk warna aksen seluruh aplikasi. */
  hue: number;
  words: {
    item: string;       // "Produk" / "Menu" / "Obat" / "Layanan"
    items: string;      // judul menu navigasi
    noStock: string;    // label centang "tanpa stok"
  };
  features: {
    barcode: boolean;
    batches: boolean;   // batch + tanggal kedaluwarsa (FEFO)
    options: boolean;   // grup opsi/tambahan per produk
    variants: boolean;  // varian ukuran/warna
    rx: boolean;        // tanda obat keras / perlu resep
    serviceCharge: boolean;
    /** Produk baru dianggap tanpa stok secara default (menu dibuat saat dipesan, layanan jasa). */
    defaultNoStock: boolean;
  };
  orderFields: OrderField[];
  units: string[];
  categories: string[];
};

export const PROFILES: Record<ProfileId, Profile> = {
  retail: {
    id: "retail", name: "Toko Retail", tagline: "Minimarket, toko sembako, toko kelontong, grosir kecil",
    examples: "Barcode, satuan (pcs/kg/dus), stok & minimum stok",
    hue: 255,
    words: { item: "Produk", items: "Produk", noStock: "Tanpa stok (jasa/tidak dihitung)" },
    features: { barcode: true, batches: false, options: false, variants: false, rx: false, serviceCharge: false, defaultNoStock: false },
    orderFields: [{ key: "customer", label: "Nama pelanggan", placeholder: "Opsional" }],
    units: ["pcs", "pak", "dus", "botol", "sachet", "kg", "gram", "liter", "lusin"],
    categories: ["Makanan", "Minuman", "Sembako", "Kebutuhan Rumah", "Rokok", "Lainnya"],
  },
  fnb: {
    id: "fnb", name: "Kafe / Restoran", tagline: "Kafe, kedai kopi, warung makan, resto, food court",
    examples: "Menu dengan ukuran & tambahan, tipe pesanan, no. meja, service charge",
    hue: 42,
    words: { item: "Menu", items: "Menu", noStock: "Tanpa stok (dibuat saat dipesan)" },
    features: { barcode: false, batches: false, options: true, variants: false, rx: false, serviceCharge: true, defaultNoStock: true },
    orderFields: [
      { key: "type", label: "Tipe pesanan", choices: ["Makan di tempat", "Bawa pulang", "Antar"] },
      { key: "table", label: "No. meja", placeholder: "mis. 7" },
      { key: "customer", label: "Nama pemesan", placeholder: "Opsional" },
    ],
    units: ["porsi", "gelas", "pcs", "botol", "paket"],
    categories: ["Kopi", "Non-Kopi", "Makanan Berat", "Camilan", "Dessert"],
  },
  apotek: {
    id: "apotek", name: "Apotek / Toko Obat", tagline: "Apotek, toko obat, toko alat kesehatan",
    examples: "Batch & tanggal kedaluwarsa (FEFO), obat keras, nama dokter & no. resep",
    hue: 165,
    words: { item: "Obat & Produk", items: "Obat", noStock: "Tanpa stok (jasa/tidak dihitung)" },
    features: { barcode: true, batches: true, options: false, variants: false, rx: true, serviceCharge: false, defaultNoStock: false },
    orderFields: [
      { key: "customer", label: "Nama pelanggan / pasien", placeholder: "Opsional" },
      { key: "doctor", label: "Dokter", placeholder: "Jika ada resep" },
      { key: "rx", label: "No. resep", placeholder: "Jika ada resep" },
    ],
    units: ["strip", "tablet", "botol", "tube", "box", "sachet", "ampul", "pcs"],
    categories: ["Obat Bebas", "Obat Bebas Terbatas", "Obat Keras", "Vitamin & Suplemen", "Alat Kesehatan", "Perawatan"],
  },
  jasa: {
    id: "jasa", name: "Jasa & Servis", tagline: "Bengkel, salon, barbershop, laundry, klinik kecantikan",
    examples: "Layanan tanpa stok + suku cadang/produk, petugas, plat/nomor referensi",
    hue: 295,
    words: { item: "Layanan & Barang", items: "Layanan", noStock: "Layanan (tanpa stok)" },
    features: { barcode: false, batches: false, options: false, variants: false, rx: false, serviceCharge: false, defaultNoStock: true },
    orderFields: [
      { key: "customer", label: "Nama pelanggan", placeholder: "Opsional" },
      { key: "phone", label: "No. HP", placeholder: "Opsional" },
      { key: "ref", label: "Plat / keterangan unit", placeholder: "mis. AD 1234 XY" },
      { key: "staff", label: "Petugas", placeholder: "Teknisi / stylist" },
    ],
    units: ["kali", "jam", "paket", "unit", "pcs", "kg", "set"],
    categories: ["Layanan", "Paket", "Suku Cadang / Produk"],
  },
  fashion: {
    id: "fashion", name: "Toko Fashion", tagline: "Pakaian, sepatu, tas, aksesori, butik",
    examples: "Varian ukuran & warna dengan stok per varian, barcode per varian",
    hue: 350,
    words: { item: "Produk", items: "Produk", noStock: "Tanpa stok (jasa/tidak dihitung)" },
    features: { barcode: true, batches: false, options: false, variants: true, rx: false, serviceCharge: false, defaultNoStock: false },
    orderFields: [
      { key: "customer", label: "Nama pelanggan", placeholder: "Opsional" },
      { key: "phone", label: "No. HP", placeholder: "Opsional" },
    ],
    units: ["pcs", "pasang", "set"],
    categories: ["Atasan", "Bawahan", "Outer", "Sepatu", "Tas & Aksesori"],
  },
};

export const PROFILE_LIST = Object.values(PROFILES);
export const isProfileId = (v: unknown): v is ProfileId => typeof v === "string" && v in PROFILES;

/** Satuan yang boleh berpecahan (2,5 kg). Selain itu jumlah dibulatkan ke bilangan bulat di UI. */
const FRACTIONAL = new Set(["kg", "gram", "liter", "meter", "jam"]);
export const isFractionalUnit = (u: string) => FRACTIONAL.has(u.toLowerCase());

export const PAYMENT_METHODS = [
  { id: "cash", label: "Tunai" },
  { id: "qris", label: "QRIS" },
  { id: "transfer", label: "Transfer" },
  { id: "card", label: "Kartu" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
export const METHOD_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label]));
export const isMethod = (v: unknown): v is PaymentMethod => PAYMENT_METHODS.some((m) => m.id === v);
