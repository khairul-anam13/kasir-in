"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { guard } from "@/lib/errors";
import { fail, num, str, type FormState } from "@/lib/form";
import { applyOpname, type OpnameRow } from "@/lib/stock";

/** Kolom formulir: "p:<produk>" untuk stok biasa, "b:<batch>:<produk>" untuk stok per batch. Kosong = tidak diubah. */
export async function opnameAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const rows: OpnameRow[] = [];
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || v.trim() === "") continue;
    const m = /^(?:p:(\d+)|b:(\d+):(\d+))$/.exec(k);
    if (!m) continue;
    const counted = num(fd, k, NaN);
    if (!Number.isFinite(counted)) return fail("Ada jumlah hitung yang bukan angka");
    rows.push(m[1] ? { productId: Number(m[1]), counted } : { batchId: Number(m[2]), productId: Number(m[3]), counted });
  }
  if (rows.length === 0) return fail("Isi hasil hitung fisik minimal satu baris");
  const r = await guard(() => applyOpname(rows, str(fd, "note", 120) || "Stok opname"));
  if (typeof r !== "number") return fail(r.error);
  revalidatePath("/", "layout");
  return { ok: r === 0 ? "Semua jumlah sudah sesuai, tidak ada yang diubah" : `${r} baris disesuaikan` };
}
