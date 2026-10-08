// CSV yang langsung terbuka benar di Excel (Indonesia): pemisah titik koma + BOM UTF-8.
export type Cell = string | number | boolean | null | undefined;

const cell = (v: Cell) => {
  if (v == null) return "";
  let s = String(v);
  // Cegah injeksi rumus saat dibuka di Excel: teks yang diawali = + - @ dijadikan literal.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[;"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export const toCsv = (rows: Cell[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
