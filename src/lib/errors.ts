/** Kesalahan yang pesannya aman & berguna ditampilkan ke pengguna (validasi, stok kurang, dst.). */
export class UserError extends Error {}

/** Jalankan fungsi; ubah UserError menjadi { error } dan biarkan kesalahan lain naik. */
export async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try { return await fn(); } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

/** Untuk aksi tanpa nilai kembali: pesan kesalahan pengguna, atau null bila berhasil. */
export async function attempt(fn: () => Promise<unknown>): Promise<string | null> {
  try { await fn(); return null; } catch (e) {
    if (e instanceof UserError) return e.message;
    throw e;
  }
}
