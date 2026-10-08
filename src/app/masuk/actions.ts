"use server";
import { redirect } from "next/navigation";
import { login } from "@/lib/auth";
import { fail, str, type FormState } from "@/lib/form";

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await login(str(fd, "username", 40), String(fd.get("password") ?? "").slice(0, 200));
  if (r.error) return fail(r.error);
  redirect("/kasir");
}
