"use server";
import { redirect } from "next/navigation";
import { createSession, hashPassword } from "@/lib/auth";
import { readBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { seedCatalog, seedHistory } from "@/lib/demo";
import { fail, flag, isUnique, num, str, type FormState } from "@/lib/form";
import { PROFILES, isProfileId } from "@/lib/profiles";

const TZ = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];

/** Setup pertama: profil usaha + akun admin (+ data contoh bila dicentang). Hanya berjalan jika belum ada usaha. */
export async function completeSetup(_: FormState, fd: FormData): Promise<FormState> {
  const [done] = await sql`select 1 from business`;
  if (done) redirect("/masuk");

  const type = str(fd, "type");
  const name = str(fd, "name", 60), address = str(fd, "address", 120), phone = str(fd, "phone", 30);
  const timezone = str(fd, "timezone") || "Asia/Jakarta";
  const taxMode = str(fd, "tax_mode") || "off";
  const taxRate = num(fd, "tax_rate", 11);
  const username = str(fd, "username", 30).toLowerCase(), adminName = str(fd, "admin_name", 40) || "Admin";
  const password = String(fd.get("password") ?? ""), confirm = String(fd.get("confirm") ?? "");

  if (!isProfileId(type)) return fail("Pilih jenis usaha terlebih dahulu");
  if (name.length < 2) return fail("Nama usaha minimal 2 karakter");
  if (!TZ.includes(timezone)) return fail("Zona waktu tidak valid");
  if (!["off", "exclusive", "inclusive"].includes(taxMode)) return fail("Mode pajak tidak valid");
  if (!(taxRate >= 0 && taxRate <= 100)) return fail("Tarif pajak harus 0–100%");
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return fail("Username 3–30 karakter: huruf kecil, angka, titik, strip, atau garis bawah");
  if (password.length < 8) return fail("Password minimal 8 karakter");
  if (password !== confirm) return fail("Konfirmasi password tidak sama");

  const hash = await hashPassword(password);
  let userId: number;
  try {
    userId = await sql.begin(async (tx) => {
      await tx`insert into business (name, type, address, phone, timezone, tax_mode, tax_rate, service_rate)
               values (${name}, ${type}, ${address}, ${phone}, ${timezone}, ${taxMode}, ${taxRate}, ${PROFILES[type].features.serviceCharge ? 5 : 0})`;
      const [u] = await tx`insert into users (username, name, password_hash) values (${username}, ${adminName}, ${hash}) returning id`;
      if (flag(fd, "demo")) {
        await seedCatalog(tx, type, timezone);
        await seedHistory(tx, type, timezone, (await readBusiness(tx)).rates, adminName);
      } else {
        for (const [i, c] of PROFILES[type].categories.entries()) await tx`insert into categories (name, sort) values (${c}, ${i})`;
      }
      return u.id as number;
    });
  } catch (e) {
    if (isUnique(e)) redirect("/masuk");
    throw e;
  }
  await createSession(userId);
  redirect("/kasir");
}
