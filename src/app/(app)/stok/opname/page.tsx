import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { SubTabs } from "@/components/tabs";
import { STOCK_TABS } from "@/lib/tabs";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { fmtQty } from "@/lib/format";
import { opnameAction } from "../actions";

export const metadata = { title: "Stok opname" };

type Row = { key: string; name: string; variant_label: string | null; unit: string; batch_no: string | null; expiry: string | null; qty: number };

export default async function OpnamePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { profile } = await getBusiness();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const like = "%" + q.replace(/[%_\\]/g, "\\$&") + "%";
  const filter = q ? sql`and (p.name ilike ${like} or p.variant_label ilike ${like} or p.sku ilike ${like} or p.barcode = ${q})` : sql``;
  const rows = profile.features.batches
    ? await sql<Row[]>`select 'b:' || b.id || ':' || p.id as key, p.name, p.variant_label, p.unit, b.batch_no, to_char(b.expiry, 'YYYY-MM-DD') expiry, b.qty
        from stock_batches b join products p on p.id = b.product_id where p.active and not p.is_service ${filter} order by p.name, b.expiry nulls last limit 300`
    : await sql<Row[]>`select 'p:' || p.id as key, p.name, p.variant_label, p.unit, null batch_no, null expiry, p.stock qty
        from products p where p.active and not p.is_service ${filter} order by p.name, p.variant_label limit 300`;

  return (
    <div className="page">
      <div className="page-head"><div><h1>Stok</h1><p>Isi hasil hitung fisik. Baris yang dikosongkan tidak diubah.</p></div></div>
      <SubTabs tabs={STOCK_TABS} label="Stok" />
      <form className="toolbar" method="get">
        <input className="input search" type="search" name="q" defaultValue={q} placeholder="Cari nama atau barcode…" aria-label="Cari" />
        <button className="btn soft" type="submit">Cari</button>
      </form>
      {rows.length === 0 ? (
        <div className="card empty"><Icon name="stock" /><strong>Tidak ada item bersatuan stok</strong><span>Tambahkan produk yang dihitung stoknya terlebih dahulu.</span></div>
      ) : (
        <ActionForm action={opnameAction} submit="Simpan penyesuaian" className="stack" clearOnOk>
          <div className="card flush">
            <div className="tbl-wrap"><table>
              <thead><tr><th>Item</th>{profile.features.batches && <th>Batch</th>}<th className="num">Stok sistem</th><th className="num" style={{ width: 160 }}>Hitung fisik</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.key}>
                  <td><b>{r.name}</b>{r.variant_label && <span className="muted"> · {r.variant_label}</span>}</td>
                  {profile.features.batches && <td className="small">{r.batch_no}{r.expiry && <span className="muted"> · exp {r.expiry}</span>}</td>}
                  <td className="num">{fmtQty(r.qty)} {r.unit}</td>
                  <td className="num"><input className="input money" name={r.key} inputMode="decimal" placeholder="—" aria-label={`Hitung fisik ${r.name}`} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
          <label className="f"><span>Catatan <em className="hint">(opsional)</em></span><input className="input" name="note" maxLength={120} placeholder="mis. opname akhir bulan" /></label>
        </ActionForm>
      )}
    </div>
  );
}
