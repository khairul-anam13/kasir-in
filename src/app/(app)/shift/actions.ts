"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { attempt } from "@/lib/errors";
import { fail, int, str, type FormState } from "@/lib/form";
import { addCashMove, closeShift, currentShift } from "@/lib/shifts";

export async function closeShiftAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const s = await currentShift();
  if (!s) return fail("Tidak ada shift yang terbuka");
  if (str(fd, "counted") === "") return fail("Isi jumlah uang tunai hasil hitung");
  const e = await attempt(() => closeShift(s.id, int(fd, "counted"), str(fd, "note", 200)));
  if (e) return fail(e);
  revalidatePath("/", "layout");
  return { ok: "Shift ditutup" };
}

export async function cashMoveAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const s = await currentShift();
  if (!s) return fail("Tidak ada shift yang terbuka");
  const kind = str(fd, "kind") === "in" ? "in" : "out";
  const e = await attempt(() => addCashMove(s.id, kind, int(fd, "amount"), str(fd, "note", 120)));
  if (e) return fail(e);
  revalidatePath("/", "layout");
  return { ok: "Tercatat" };
}
