// Desain nota yang bisa dipilih di Pengaturan. Murni data — dipakai server & klien.
export const RECEIPT_TEMPLATES = [
  { id: "klasik", name: "Klasik", note: "Font mesin kasir, garis putus-putus. Lengkap dan akrab." },
  { id: "ringkas", name: "Ringkas", note: "Padat, hemat kertas. Satu baris per item." },
  { id: "modern", name: "Modern", note: "Huruf sans, total dalam kotak, rapi dan lega." },
] as const;
export type ReceiptTemplate = (typeof RECEIPT_TEMPLATES)[number]["id"];
export const isTemplate = (v: unknown): v is ReceiptTemplate => RECEIPT_TEMPLATES.some((t) => t.id === v);

// Tema tampilan aplikasi (dipilih di Pengaturan).
export const UI_THEMES = [
  { id: "default", name: "Default", note: "Bersih dan lugas: kartu putih, sidebar tegas, cepat dibaca." },
  { id: "ios", name: "iOS", note: "Kaca tembus, tombol kapsul, tab bar melayang, gaya iOS yang modern." },
] as const;
export type UiTheme = (typeof UI_THEMES)[number]["id"];
export const isUiTheme = (v: unknown): v is UiTheme => UI_THEMES.some((t) => t.id === v);

// Logo di nota: lebar relatif terhadap lebar kertas.
export const LOGO_SIZES = [{ id: "kecil", label: "Kecil", pct: 35 }, { id: "sedang", label: "Sedang", pct: 55 }, { id: "besar", label: "Besar", pct: 80 }] as const;
export type LogoSize = (typeof LOGO_SIZES)[number]["id"];
export const isLogoSize = (v: unknown): v is LogoSize => LOGO_SIZES.some((s) => s.id === v);
export const LOGO_MAX_PX = 384; // lebar maksimum hasil olahan di klien (cukup tajam untuk 58/80 mm)

// Aksi tombol "Cetak struk" setelah pembayaran: tampilkan pratinjau dalam panel, atau langsung kirim ke printer (dialog cetak).
export const RECEIPT_ACTIONS = [
  { id: "popup", label: "Tampilkan pratinjau", note: "Struk muncul dalam panel; kasir menekan Cetak bila perlu." },
  { id: "print", label: "Cetak langsung", note: "Dialog cetak terbuka otomatis setelah pembayaran berhasil." },
] as const;
export type ReceiptAction = (typeof RECEIPT_ACTIONS)[number]["id"];
export const isReceiptAction = (v: unknown): v is ReceiptAction => RECEIPT_ACTIONS.some((a) => a.id === v);
