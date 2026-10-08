import { LOGO_MAX_PX } from "./receipt.ts";

/**
 * Validasi logo dari formulir: harus PNG (hasil olahan canvas di klien), ukuran kecil, dimensi wajar.
 * Mengembalikan pesan kesalahan, atau null bila aman disimpan. Tidak pernah mempercayai data klien.
 */
export function checkLogoDataUrl(v: string): string | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!m || v.length > 200_000) return "Logo tidak valid atau terlalu besar";
  const b = Buffer.from(m[1], "base64");
  const sig = b.length > 33 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a && b.toString("ascii", 12, 16) === "IHDR";
  if (!sig) return "Berkas logo bukan PNG yang valid";
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  if (!(w >= 8 && h >= 8 && w <= LOGO_MAX_PX * 2 && h <= 800)) return "Dimensi logo tidak wajar";
  return null;
}
