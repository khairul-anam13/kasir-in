"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { attempt } from "@/lib/errors";
import { fail, int, str, type FormState } from "@/lib/form";
import { voidOrder } from "@/lib/sales";

export async function voidAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const e = await attempt(() => voidOrder(int(fd, "id"), str(fd, "reason", 200)));
  if (e) return fail(e);
  revalidatePath("/", "layout");
  return { ok: "Transaksi dibatalkan dan stok dikembalikan" };
}
