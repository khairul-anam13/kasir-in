import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { deleteCategory, saveCategory } from "../actions";

export const metadata = { title: "Kategori" };

export default async function CategoriesPage() {
  await requireUser();
  const { profile } = await getBusiness();
  const cats = await sql<{ id: number; name: string; sort: number; n: number }[]>`
    select c.id, c.name, c.sort, (select count(*)::int from products p where p.category_id = c.id) n from categories c order by c.sort, c.name`;
  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div className="page-head"><div><Link href="/produk" className="small">← {profile.words.items}</Link><h1>Kategori</h1><p>Urutan angka kecil tampil lebih dulu di layar kasir.</p></div></div>
      <div className="card stack">
        {cats.map((c) => (
          <div key={c.id} className="row wrap" style={{ alignItems: "flex-start" }}>
            <div className="grow" style={{ minWidth: 240 }}>
              <ActionForm action={saveCategory} submit="Simpan" className="row wrap" variant="soft">
                <input type="hidden" name="id" value={c.id} />
                <input className="input grow" name="name" defaultValue={c.name} maxLength={40} aria-label="Nama kategori" required style={{ minWidth: 160 }} />
                <input className="input money" name="sort" defaultValue={c.sort} inputMode="numeric" aria-label="Urutan" style={{ width: 80 }} />
              </ActionForm>
            </div>
            <div className="row">
              <span className="muted small">{c.n} item</span>
              <ActionForm action={deleteCategory} submit="Hapus" className="row" variant="danger"><input type="hidden" name="id" value={c.id} /></ActionForm>
            </div>
          </div>
        ))}
        {cats.length === 0 && <p className="muted">Belum ada kategori.</p>}
      </div>
      <div className="card">
        <h2>Kategori baru</h2>
        <ActionForm action={saveCategory} submit="Tambah" className="row wrap" clearOnOk>
          <input className="input grow" name="name" placeholder="Nama kategori" maxLength={40} required style={{ minWidth: 180 }} />
          <input className="input money" name="sort" defaultValue={cats.length + 1} inputMode="numeric" aria-label="Urutan" style={{ width: 80 }} />
        </ActionForm>
      </div>
    </div>
  );
}
