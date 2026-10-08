// Perintah database: npm run db -- schema | status | reset --yes
import postgres from "postgres";

try { process.loadEnvFile(".env.local"); } catch { /* produksi: env dari platform */ }
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum diisi");
const sql = postgres(url, { prepare: false, onnotice: () => {} });

const cmds = {
  async schema() { await sql.file("db/schema.sql"); console.log("skema siap"); },
  async status() {
    const [b] = await sql`select name, type from business`;
    const [{ n }] = await sql`select count(*)::int n from products`;
    console.log(b ? `usaha: ${b.name} (${b.type}), ${n} produk` : "belum setup — buka aplikasi lalu selesaikan /setup");
  },
  async reset() {
    if (!process.argv.includes("--yes")) throw new Error("reset menghapus SEMUA data. Tambahkan --yes untuk melanjutkan");
    await sql`drop schema public cascade`;
    await sql`create schema public`;
    await cmds.schema();
  },
};

const cmd = process.argv[2] ?? "schema";
if (!cmds[cmd]) throw new Error(`Perintah tidak dikenal: ${cmd} (schema|status|reset)`);
try { await cmds[cmd](); } finally { await sql.end(); }
