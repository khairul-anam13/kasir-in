import { ActionForm } from "@/components/action-form";
import { SubTabs } from "@/components/tabs";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PURCHASE_TABS } from "@/lib/tabs";
import { saveSupplier } from "../actions";

export const metadata = { title: "Supplier" };

export default async function SuppliersPage() {
  await requireUser();
  const rows = await sql<{ id: number; name: string; phone: string; address: string; note: string; active: boolean; n: number }[]>`
    select s.*, (select count(*)::int from purchases p where p.supplier_id = s.id) n from suppliers s order by active desc, name`;
  return (
    <div className="page">
      <div className="page-head"><div><h1>Pembelian</h1><p>Daftar pemasok barang Anda.</p></div></div>
      <SubTabs tabs={PURCHASE_TABS} label="Pembelian" />
      <div className="card">
        <h2>Supplier baru</h2>
        <ActionForm action={saveSupplier} submit="Tambah supplier" clearOnOk>
          <div className="grid2">
            <label className="f"><span>Nama</span><input className="input" name="name" required maxLength={80} /></label>
            <label className="f"><span>No. telepon</span><input className="input" name="phone" maxLength={30} inputMode="tel" /></label>
          </div>
          <div className="grid2">
            <label className="f"><span>Alamat</span><input className="input" name="address" maxLength={120} /></label>
            <label className="f"><span>Catatan</span><input className="input" name="note" maxLength={120} /></label>
          </div>
        </ActionForm>
      </div>
      {rows.map((s) => (
        <details className="card" key={s.id} style={s.active ? undefined : { opacity: 0.6 }}>
          <summary style={{ cursor: "pointer" }}><b>{s.name}</b> <span className="muted small">· {s.phone || "tanpa telepon"} · {s.n} pembelian{!s.active && " · nonaktif"}</span></summary>
          <ActionForm action={saveSupplier} submit="Simpan">
            <input type="hidden" name="id" value={s.id} />
            <div className="grid2" style={{ marginTop: 12 }}>
              <label className="f"><span>Nama</span><input className="input" name="name" defaultValue={s.name} required maxLength={80} /></label>
              <label className="f"><span>No. telepon</span><input className="input" name="phone" defaultValue={s.phone} maxLength={30} inputMode="tel" /></label>
            </div>
            <div className="grid2">
              <label className="f"><span>Alamat</span><input className="input" name="address" defaultValue={s.address} maxLength={120} /></label>
              <label className="f"><span>Catatan</span><input className="input" name="note" defaultValue={s.note} maxLength={120} /></label>
            </div>
            <label className="check"><input type="checkbox" name="active" defaultChecked={s.active} /> Aktif</label>
          </ActionForm>
        </details>
      ))}
    </div>
  );
}
