import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { dateTimeOf, fmtQty, rupiah } from "@/lib/format";

export const metadata = { title: "Detail pembelian" };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { biz } = await getBusiness();
  const [p] = await sql`select * from purchases where id = ${id}`;
  if (!p) notFound();
  const items = await sql<{ id: number; product_id: number | null; name: string; qty: number; cost: number; batch_no: string | null; expiry: string | null }[]>`
    select id, product_id, name, qty, cost, batch_no, to_char(expiry, 'YYYY-MM-DD') expiry from purchase_items where purchase_id = ${id} order by id`;
  return (
    <div className="page">
      <div className="page-head"><div><Link href="/pembelian" className="small">← Pembelian</Link><h1 className="num">{p.number}</h1>
        <p>{dateTimeOf(p.created_at, biz.timezone)} · dicatat oleh {p.created_by}{p.supplier_name && <> · {p.supplier_name}</>}{p.invoice_no && <> · faktur {p.invoice_no}</>}</p></div></div>
      {p.note && <p className="note">{p.note}</p>}
      <div className="card flush"><div className="tbl-wrap"><table>
        <thead><tr><th>Barang</th><th>Batch</th><th className="num">Jumlah</th><th className="num">Harga beli</th><th className="num">Subtotal</th></tr></thead>
        <tbody>{items.map((i) => (
          <tr key={i.id}><td>{i.product_id ? <Link href={`/produk/${i.product_id}`}><b>{i.name}</b></Link> : <b>{i.name}</b>}</td>
            <td className="small">{i.batch_no ?? "—"}{i.expiry && <span className="muted"> · exp {i.expiry}</span>}</td>
            <td className="num">{fmtQty(i.qty)}</td><td className="num">{rupiah(i.cost)}</td><td className="num"><b>{rupiah(Math.round(i.qty * i.cost))}</b></td></tr>
        ))}</tbody>
        <tfoot><tr><td colSpan={4} className="num muted">Total</td><td className="num" style={{ fontWeight: 750, fontSize: "1.05rem" }}>{rupiah(p.total)}</td></tr></tfoot>
      </table></div></div>
    </div>
  );
}
