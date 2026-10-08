// scrypt dari stdlib — tanpa dependensi. Format: s1$<salt b64>$<key b64>. Dipakai juga oleh scripts/db.mjs.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const derive = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `s1$${salt.toString("base64")}$${(await derive(pw, salt)).toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  const [v, salt, key] = (stored ?? "").split("$");
  if (v !== "s1" || !salt || !key) return false;
  const want = Buffer.from(key, "base64");
  const got = await derive(pw, Buffer.from(salt, "base64"));
  return want.length === got.length && timingSafeEqual(want, got);
}
