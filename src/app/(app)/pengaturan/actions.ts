"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { readBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { fail, flag, int, num, str, type FormState } from "@/lib/form";
import { checkLogoDataUrl } from "@/lib/logo";
import { isLogoSize, isReceiptAction, isTemplate, isUiTheme } from "@/lib/receipt";

const saved = (): FormState => { revalidatePath("/", "layout"); return { ok: "Tersimpan" }; };

export async function saveBusinessAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const name = str(fd, "name", 60), tz = str(fd, "timezone");
  if (name.length < 2) return fail("Nama usaha minimal 2 karakter");
  if (!["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"].includes(tz)) return fail("Zona waktu tidak valid");
  await sql`update business set name = ${name}, address = ${str(fd, "address", 120)}, phone = ${str(fd, "phone", 30)}, timezone = ${tz}`;
  return saved();
}

export async function saveTaxAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const mode = str(fd, "tax_mode"), rate = num(fd, "tax_rate", 11), service = num(fd, "service_rate", 0);
  if (!["off", "exclusive", "inclusive"].includes(mode)) return fail("Mode pajak tidak valid");
  if (!(rate >= 0 && rate <= 100) || !(service >= 0 && service <= 100)) return fail("Persentase harus 0–100");
  await sql`update business set tax_mode = ${mode}, tax_rate = ${rate}, service_rate = ${service}`;
  return saved();
}

export async function saveReceiptAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const width = int(fd, "paper_width", 58);
  if (width !== 58 && width !== 80) return fail("Lebar kertas tidak valid");
  const tpl = str(fd, "receipt_template");
  if (!isTemplate(tpl)) return fail("Pilih salah satu desain nota");
  const logo = String(fd.get("receipt_logo") ?? "").trim() || null;  // kosong = tanpa logo
  const logoSize = str(fd, "logo_size");
  if (logo) { const bad = checkLogoDataUrl(logo); if (bad) return fail(bad); }
  if (!isLogoSize(logoSize)) return fail("Ukuran logo tidak valid");
  const action = str(fd, "receipt_action");
  if (!isReceiptAction(action)) return fail("Aksi cetak struk tidak valid");
  await sql`update business set paper_width = ${width}, receipt_footer = ${str(fd, "receipt_footer", 160)}, receipt_template = ${tpl},
            receipt_logo = ${logo}, logo_size = ${logoSize}, logo_name = ${flag(fd, "logo_name")}, receipt_action = ${action}`;
  return saved();
}

export async function saveStockPolicyAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  await sql`update business set allow_negative_stock = ${flag(fd, "allow_negative_stock")}`;
  return saved();
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const cur = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? ""), confirm = String(fd.get("confirm") ?? "");
  const name = str(fd, "name", 40);
  const [u] = await sql`select password_hash from users where id = ${user.id}`;
  if (!(await verifyPassword(cur, u.password_hash))) return fail("Password saat ini salah");
  if (next && next.length < 8) return fail("Password baru minimal 8 karakter");
  if (next !== confirm) return fail("Konfirmasi password tidak sama");
  const hash = next ? await hashPassword(next) : u.password_hash;
  await sql`update users set name = ${name || user.name}, password_hash = ${hash} where id = ${user.id}`;
  return saved();
}

/** Hapus SEMUA data dan kembali ke setup awal (untuk demo ulang atau serah-terima ke pelanggan baru). */
export async function resetAllAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const { biz } = await readBusiness();
  if (str(fd, "confirm", 80) !== biz.name) return fail("Ketik nama usaha persis seperti tertulis untuk melanjutkan");
  await sql`truncate business, users, sessions, categories, products, stock_batches, stock_moves, suppliers, purchases, purchase_items,
            shifts, cash_moves, counters, orders, order_items, payments restart identity cascade`;
  await destroySession();
  redirect("/setup");
}

/** Dipanggil langsung dari pemilih tema (berlaku seketika, tanpa tombol simpan). */
export async function saveThemeAction(theme: string): Promise<{ ok: boolean }> {
  await requireUser();
  if (!isUiTheme(theme)) return { ok: false };
  await sql`update business set ui_theme = ${theme}`;
  revalidatePath("/", "layout");
  return { ok: true };
}
