// Format tampilan — aman dipakai di server maupun client.
export const rupiah = (n: number) => (n < 0 ? "-Rp" : "Rp") + Math.abs(Math.round(n)).toLocaleString("id-ID");

/** Jumlah barang: maksimal 3 desimal, tanpa nol di belakang (2,5 / 12). */
export const fmtQty = (n: number) => Number(n.toFixed(3)).toLocaleString("id-ID", { maximumFractionDigits: 3 });

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, tz: string, o: Intl.DateTimeFormatOptions) {
  const k = key + tz;
  let f = cache.get(k);
  if (!f) cache.set(k, (f = new Intl.DateTimeFormat("id-ID", { ...o, timeZone: tz, hour12: false })));
  return f;
}
const clock = (s: string) => s.replace(/\./g, ":");

export const timeOf = (d: Date | string | number, tz: string) =>
  clock(fmt("t", tz, { hour: "2-digit", minute: "2-digit" }).format(new Date(d)));
export const dateOf = (d: Date | string | number, tz: string) =>
  fmt("d", tz, { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
export const dateTimeOf = (d: Date | string | number, tz: string) =>
  clock(fmt("dt", tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)));

/** yyyy-mm-dd di zona waktu usaha. */
export const isoDayOf = (d: Date | string | number, tz: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date(d));

export const TZ_LABEL: Record<string, string> = {
  "Asia/Jakarta": "WIB (Jawa, Sumatra, Kalimantan Barat/Tengah)",
  "Asia/Makassar": "WITA (Bali, Sulawesi, NTB/NTT, Kalimantan lain)",
  "Asia/Jayapura": "WIT (Maluku, Papua)",
};

export function monthDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/**
 * Muat nama ke `max` karakter untuk nota: nama tengah menjadi inisial ("Muhammad Abdurrahman Putra" → "Muhammad A. Putra"),
 * lalu nama depan + inisial nama belakang, lalu semua inisial, terakhir dipotong dengan "..".
 */
export function fitName(name: string, max: number): string {
  const full = name.trim().replace(/\s+/g, " ");
  if (full.length <= max) return full;
  const w = full.split(" ");
  const ini = (x: string) => x[0].toUpperCase() + ".";
  const tries = [
    w.length > 2 ? [w[0], ...w.slice(1, -1).map(ini), w[w.length - 1]] : w,
    w.length > 1 ? [w[0], ...w.slice(1).map(ini)] : w,
    w.length > 1 ? [...w.slice(0, -1).map(ini), w[w.length - 1]] : w,
    w.length > 1 ? [w[0], ini(w[w.length - 1])] : w,
    w.length > 1 ? w.map(ini) : w,
  ];
  for (const t of tries) { const s = t.join(" "); if (s.length <= max) return s; }
  return full.slice(0, Math.max(1, max - 2)).trimEnd() + "..";
}
