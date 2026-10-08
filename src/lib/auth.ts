import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { hashPassword, verifyPassword } from "./password.ts";

export type User = { id: number; username: string; name: string };

const COOKIE = "kasir_sid";
const DAYS = 30;
const MAX_FAILS = 5;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: DAYS * 86400 };

/** Buat sesi untuk pengguna dan pasang cookie (dipanggil dari server action). */
export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await sql`delete from sessions where expires_at < now()`;
  await sql`insert into sessions (id, user_id, expires_at) values (${sha(token)}, ${userId}, now() + make_interval(days => ${DAYS}::int))`;
  // Secure hanya bila diakses lewat HTTPS (Vercel/proxy mengirim x-forwarded-proto). Di LAN lewat http://IP cookie secure akan ditolak browser.
  const secure = (await headers()).get("x-forwarded-proto")?.split(",")[0] === "https";
  (await cookies()).set(COOKIE, token, { ...cookieOpts, secure });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await sql`delete from sessions where id = ${sha(t)}`;
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const [u] = await sql<User[]>`
    select u.id, u.username, u.name from sessions s join users u on u.id = s.user_id
    where s.id = ${sha(t)} and s.expires_at > now()`;
  return u ?? null;
});

/** Dipakai semua halaman & server action. Belum setup → /setup; belum login → /masuk. */
export async function requireUser(): Promise<User> {
  const [b] = await sql`select 1 from business`;
  if (!b) redirect("/setup");
  const u = await getUser();
  if (!u) redirect("/masuk");
  return u;
}

const DUMMY = await hashPassword("dummy-untuk-menyamakan-waktu");

/** Login admin. Kunci 15 menit setelah 5 kali gagal. */
export async function login(username: string, password: string): Promise<{ error?: string }> {
  const [u] = await sql`select id, password_hash, locked_until from users where username = ${username.trim().toLowerCase()}`;
  if (u?.locked_until && u.locked_until > new Date()) return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  const ok = await verifyPassword(password, u?.password_hash ?? DUMMY);
  if (!u || !ok) {
    if (u) await sql`update users set
      locked_until = case when failed_logins + 1 >= ${MAX_FAILS} then now() + interval '15 minutes' else locked_until end,
      failed_logins = case when failed_logins + 1 >= ${MAX_FAILS} then 0 else failed_logins + 1 end
      where id = ${u.id}`;
    return { error: "Username atau password salah." };
  }
  await sql`update users set failed_logins = 0, locked_until = null where id = ${u.id}`;
  await createSession(u.id);
  return {};
}

export { hashPassword, verifyPassword };
