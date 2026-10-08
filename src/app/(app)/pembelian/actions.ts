"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { guard } from "@/lib/errors";
import { fail, flag, int, str, type FormState } from "@/lib/form";
import { receivePurchase, type PurchaseInput } from "@/lib/purchases";

export async function createPurchaseAction(input: PurchaseInput): Promise<{ ok: true; id: number } | { error: string }> {
  const user = await requireUser();
  if (!input || !Array.isArray(input.items)) return { error: "Data pembelian tidak valid" };
  const r = await guard(() => receivePurchase({
    supplierId: Number(input.supplierId) || null, invoiceNo: String(input.invoiceNo ?? ""), note: String(input.note ?? ""),
    items: input.items.map((i) => ({ productId: Number(i.productId), qty: Number(i.qty), cost: Number(i.cost), batchNo: i.batchNo, expiry: i.expiry })),
  }, user.name));
  if ("error" in r) return r;
  revalidatePath("/", "layout");
  return { ok: true, id: r.id };
}

export async function saveSupplier(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = int(fd, "id"), name = str(fd, "name", 80);
  if (!name) return fail("Nama supplier wajib diisi");
  const v = { phone: str(fd, "phone", 30), address: str(fd, "address", 120), note: str(fd, "note", 120), active: id ? flag(fd, "active") : true };
  if (id) await sql`update suppliers set name = ${name}, phone = ${v.phone}, address = ${v.address}, note = ${v.note}, active = ${v.active} where id = ${id}`;
  else await sql`insert into suppliers (name, phone, address, note) values (${name}, ${v.phone}, ${v.address}, ${v.note})`;
  revalidatePath("/", "layout");
  return { ok: "Tersimpan" };
}
