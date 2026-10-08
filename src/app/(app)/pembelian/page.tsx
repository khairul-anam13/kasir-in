import Link from "next/link";
import { Icon } from "@/components/icons";
import { SubTabs } from "@/components/tabs";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { dateTimeOf, rupiah } from "@/lib/format";
import { PURCHASE_TABS } from "@/lib/tabs";

export const metadata = { title: "Pembelian" };

export default async function PurchasesPage() {
  await requireUser();
  const { biz } = await getBusiness();
  const rows = await sql<{ id: number; number: string; created_at: Date; supplier_name: string; invoice_no: string; total: number; n: number }[]>`
    select p.id, p.number, p.created_at, p.supplier_name, p.invoice_no, p.total, (select count(*)::int from purchase_items i where i.purchase_id = p.id) n
    from purchases p order by p.id desc limit 200`;
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Pembelian</h1><p>Barang masuk dari supplier. Stok bertambah otomatis.</p></div>
        <Link href="/pembelian/baru" className="btn"><Icon name="plus" />Catat pembelian</Link>
      </div>
      <SubTabs tabs={PURCHASE_TABS} label="Pembelian" />
      <div className="card flush">
        {rows.length === 0 ? (
          <div className="empty"><Icon name="truck" /><strong>Belum ada pembelian</strong><span>Catat barang masuk agar stok dan harga beli selalu terbarui.</span><Link href="/pembelian/baru" className="btn">Catat pembelian</Link></div>
        ) : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>No</th><th>Tanggal</th><th>Supplier</th><th>No. faktur</th><th className="num">Baris</th><th className="num">Total</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/pembelian/${r.id}`}><b className="num">{r.number}</b></Link></td>
                <td className="nowrap">{dateTimeOf(r.created_at, biz.timezone)}</td>
                <td>{r.supplier_name || <span className="faint">—</span>}</td>
                <td className="muted">{r.invoice_no || "—"}</td>
                <td className="num">{r.n}</td>
                <td className="num"><b>{rupiah(r.total)}</b></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
