import Link from "next/link";
import { Icon } from "@/components/icons";
import { SubTabs } from "@/components/tabs";
import { STOCK_TABS } from "@/lib/tabs";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { dateTimeOf, fmtQty } from "@/lib/format";

export const metadata = { title: "Riwayat stok" };

const TYPE: Record<string, [string, string]> = {
  sale: ["Penjualan", ""], void: ["Pembatalan", "accent"], purchase: ["Pembelian", "ok"], opname: ["Opname", "warn"], adjust: ["Penyesuaian", "warn"],
};

type Row = { id: number; created_at: Date; type: string; qty: number; balance: number; ref_type: string | null; ref_id: number | null; note: string; name: string; variant_label: string | null; unit: string; batch_no: string | null; product_id: number };

export default async function MovesPage({ searchParams }: { searchParams: Promise<{ p?: string; type?: string }> }) {
  await requireUser();
  const { biz } = await getBusiness();
  const sp = await searchParams;
  const pid = Number(sp.p) || 0;
  const type = sp.type && sp.type in TYPE ? sp.type : "";
  const rows = await sql<Row[]>`
    select m.id, m.created_at, m.type, m.qty, m.balance, m.ref_type, m.ref_id, m.note, p.id product_id, p.name, p.variant_label, p.unit, b.batch_no
    from stock_moves m join products p on p.id = m.product_id left join stock_batches b on b.id = m.batch_id
    where true ${pid ? sql`and m.product_id = ${pid}` : sql``} ${type ? sql`and m.type = ${type}` : sql``}
    order by m.id desc limit 200`;
  const [prod] = pid ? await sql`select name, variant_label from products where id = ${pid}` : [];

  return (
    <div className="page">
      <div className="page-head"><div><h1>Stok</h1><p>{prod ? <>Riwayat untuk <b>{prod.name}{prod.variant_label ? ` · ${prod.variant_label}` : ""}</b> · <Link href="/stok/mutasi">lihat semua</Link></> : "200 mutasi terbaru: penjualan, pembelian, dan penyesuaian."}</p></div></div>
      <SubTabs tabs={STOCK_TABS} label="Stok" />
      <form className="toolbar" method="get">
        {pid > 0 && <input type="hidden" name="p" value={pid} />}
        <select className="input" name="type" defaultValue={type} aria-label="Jenis mutasi" style={{ width: 200 }}>
          <option value="">Semua jenis</option>{Object.entries(TYPE).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="btn soft" type="submit">Terapkan</button>
      </form>
      <div className="card flush">
        {rows.length === 0 ? <div className="empty"><Icon name="stock" /><strong>Belum ada mutasi stok</strong><span>Penjualan, pembelian, dan opname akan tercatat di sini.</span></div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Waktu</th><th>Item</th><th>Jenis</th><th className="num">Jumlah</th><th className="num">Saldo</th><th>Keterangan</th></tr></thead>
            <tbody>{rows.map((m) => (
              <tr key={m.id}>
                <td className="nowrap">{dateTimeOf(m.created_at, biz.timezone)}</td>
                <td><Link href={`/stok/mutasi?p=${m.product_id}`}><b>{m.name}</b></Link>{m.variant_label && <span className="muted"> · {m.variant_label}</span>}{m.batch_no && <span className="faint small"> · batch {m.batch_no}</span>}</td>
                <td><span className={`badge ${TYPE[m.type][1]}`}>{TYPE[m.type][0]}</span></td>
                <td className="num" style={{ color: m.qty < 0 ? "var(--bad)" : "var(--ok)", fontWeight: 650 }}>{m.qty > 0 ? "+" : ""}{fmtQty(m.qty)} {m.unit}</td>
                <td className="num">{fmtQty(m.balance)}</td>
                <td className="muted small">
                  {m.ref_type === "order" && m.ref_id ? <Link href={`/transaksi/${m.ref_id}`}>transaksi #{m.ref_id}</Link> : m.ref_type === "purchase" && m.ref_id ? <Link href={`/pembelian/${m.ref_id}`}>pembelian #{m.ref_id}</Link> : null}
                  {m.note && <> {m.note}</>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
