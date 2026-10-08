import { UserError } from "./errors.ts";
import type { OptionGroup } from "./profiles.ts";

export type Picked = { group: string; choice: string };
export type ChosenOption = { group: string; name: string; price: number };

/** Cocokkan pilihan dari keranjang dengan definisi opsi produk (harga selalu dari database, bukan dari klien). */
export function resolveOptions(groups: OptionGroup[], picked: Picked[], productName = "item"): ChosenOption[] {
  const out: ChosenOption[] = [];
  for (const g of groups) {
    const mine = picked.filter((p) => p.group === g.name);
    if (g.required && mine.length === 0) throw new UserError(`${productName}: pilih ${g.name}`);
    if (!g.multi && mine.length > 1) throw new UserError(`${productName}: ${g.name} hanya boleh satu pilihan`);
    for (const p of mine) {
      const c = g.choices.find((x) => x.name === p.choice);
      if (!c) throw new UserError(`${productName}: pilihan ${g.name} tidak dikenal`);
      out.push({ group: g.name, name: c.name, price: c.price });
    }
  }
  if (picked.some((p) => !groups.some((g) => g.name === p.group))) throw new UserError(`${productName}: opsi tidak dikenal`);
  return out;
}

/** Validasi JSON grup opsi dari formulir produk (editor opsi di klien). */
export function parseOptionGroups(raw: string): OptionGroup[] {
  let data: unknown;
  try { data = JSON.parse(raw || "[]"); } catch { throw new UserError("Data opsi tidak valid"); }
  if (!Array.isArray(data) || data.length > 12) throw new UserError("Maksimal 12 grup opsi");
  const names = new Set<string>();
  return data.map((g: Partial<OptionGroup>) => {
    const name = String(g?.name ?? "").trim().slice(0, 30);
    if (!name) throw new UserError("Setiap grup opsi harus punya nama");
    if (names.has(name.toLowerCase())) throw new UserError(`Nama grup opsi ganda: ${name}`);
    names.add(name.toLowerCase());
    const cs = Array.isArray(g.choices) ? g.choices : [];
    if (cs.length === 0 || cs.length > 30) throw new UserError(`Grup ${name}: isi 1–30 pilihan`);
    const cn = new Set<string>();
    const choices = cs.map((c) => {
      const n = String(c?.name ?? "").trim().slice(0, 30);
      const price = Math.round(Number(c?.price) || 0);
      if (!n) throw new UserError(`Grup ${name}: ada pilihan tanpa nama`);
      if (cn.has(n.toLowerCase())) throw new UserError(`Grup ${name}: pilihan ganda (${n})`);
      if (price < 0 || price > 10_000_000) throw new UserError(`Grup ${name}: harga tambahan tidak valid`);
      cn.add(n.toLowerCase());
      return { name: n, price };
    });
    return { name, required: !!g.required, multi: !!g.multi, choices };
  });
}
