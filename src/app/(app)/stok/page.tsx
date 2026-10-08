import Link from "next/link";
import { Icon } from "@/components/icons";
import { SubTabs } from "@/components/tabs";
import { STOCK_TABS } from "@/lib/tabs";
import { requireUser } from "@/lib/auth";
import { getBusiness, today } from "@/lib/biz";
import { sql } from "@/lib/db";
import { fmtQty, rupiah } from "@/lib/format";
import { expiringBatches, lowStock } from "@/lib/reports";

export const metadata = { title: "Stok" };

export default async function StockPage() {
  await requireUser();
  const { biz, profile } = await getBusiness();
  const day = today(biz.timezone);
  const [s] = await sql<{ items: number; value: number }[]>`
    select count(*)::int items, coalesce(sum(stock * cost), 0) value from products where active and not is_service`;
  const low = await lowStock(day, 500);
  const out = low.filter((p) => p.stock <= 0).length;
  const expiring = profile.features.batches ? await expiringBatches(day, 90) : [];
  const expired = expiring.filter((b) => b.days_left < 0);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Stok</h1><p>Kondisi persediaan saat ini.</p></div>
        <a className="btn ghost" href="/api/export/stok"><Icon name="download" />Unduh CSV</a>
      </div>
      <SubTabs tabs={STOCK_TABS} label="Stok" />
      <div className="stats">
        <div className="stat"><span className="k">Item dengan stok</span><span className="v">{s.items}</span></div>
        <div className="stat"><span className="k">Nilai stok (harga beli)</span><span className="v">{rupiah(s.value)}</span></div>
        <div className={`stat ${low.length - out ? "warn" : ""}`}><span className="k">Stok menipis</span><span className="v">{low.length - out}</span></div>
        <div className={`stat ${out ? "bad" : ""}`}><span className="k">Stok habis</span><span className="v">{out}</span></div>
        {profile.features.batches && <div className={`stat ${expired.length ? "bad" : expiring.length ? "warn" : ""}`}><span className="k">Batch kedaluwarsa / ≤ 90 hari</span><span className="v">{expired.length} / {expiring.length - expired.length}</span></div>}
      </div>

      {profile.features.batches && expiring.length > 0 && (
        <div className="card flush">
          <div className="spread" style={{ padding: "14px 18px 0" }}><h2>Perlu perhatian: kedaluwarsa</h2><span className="muted small">Batch lewat tanggal tidak bisa dijual di kasir.</span></div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>Obat</th><th>Batch</th><th>Kedaluwarsa</th><th className="num">Sisa</th></tr></thead>
            <tbody>{expiring.map((b) => (
              <tr key={b.id}><td><Link href={`/produk/${b.product_id}`}><b>{b.name}</b></Link></td><td>{b.batch_no}</td>
                <td><span className={`badge ${b.days_left < 0 ? "bad" : "warn"}`}>{b.expiry} · {b.days_left < 0 ? `lewat ${-b.days_left} hari` : `${b.days_left} hari lagi`}</span></td>
                <td className="num">{fmtQty(b.qty)} {b.unit}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      <div className="card flush">
        <div className="spread" style={{ padding: "14px 18px 0" }}>
          <h2>Perlu restock</h2><Link href="/pembelian/baru" className="btn soft sm"><Icon name="truck" />Catat pembelian</Link>
        </div>
        {low.length === 0 ? (
          <div className="empty"><Icon name="check" /><strong>Semua stok aman</strong><span>Barang yang mencapai batas minimum akan muncul di sini.</span></div>
        ) : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Nama</th><th className="num">Stok</th><th className="num">Minimum</th></tr></thead>
            <tbody>{low.map((p) => (
              <tr key={p.id}><td><Link href={`/produk/${p.id}`}><b>{p.name}</b></Link>{p.variant_label && <span className="muted"> · {p.variant_label}</span>}</td>
                <td className="num"><span className={`badge ${p.stock <= 0 ? "bad" : "warn"}`}>{fmtQty(p.stock)} {p.unit}</span></td>
                <td className="num muted">{fmtQty(p.min_stock)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
