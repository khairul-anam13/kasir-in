import postgres from "postgres";

// Satu koneksi per proses (aman untuk hot-reload dev & serverless). prepare:false → kompatibel dengan pooler Supabase/Neon.
// numeric (1700) & bigint (20) dikembalikan sebagai number — semua nilai uang/stok muat dalam 2^53.
const g = globalThis as unknown as { __kasirSql?: postgres.Sql };
export const sql = (g.__kasirSql ??= postgres(process.env.DATABASE_URL ?? "", {
  prepare: false, max: 5, idle_timeout: 20, onnotice: () => {},
  types: {
    numeric: { to: 1700, from: [1700], serialize: (v: unknown) => String(v), parse: Number },
    bigint: { to: 20, from: [20], serialize: (v: unknown) => String(v), parse: Number },
  },
}));
export type Sql = postgres.Sql;
/** Handle transaksi dari sql.begin — dipakai helper yang harus ikut transaksi pemanggil. */
export type Tx = postgres.TransactionSql;
