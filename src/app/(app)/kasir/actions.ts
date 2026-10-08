"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { attempt, guard } from "@/lib/errors";
import { fail, int, type FormState } from "@/lib/form";
import { checkout, type CheckoutInput } from "@/lib/sales";
import { openShift } from "@/lib/shifts";

export type CheckoutResult = { ok: true; id: number; number: string } | { error: string };

export async function checkoutAction(input: CheckoutInput): Promise<CheckoutResult> {
  const user = await requireUser();
  const r = await guard(() => checkout(input, user.name));
  if ("error" in r) return r;
  revalidatePath("/", "layout");
  return { ok: true, ...r };
}

export async function openShiftAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const e = await attempt(() => openShift(user.name, int(fd, "opening")));
  if (e) return fail(e);
  revalidatePath("/", "layout");
  return { ok: "Shift dibuka" };
}
