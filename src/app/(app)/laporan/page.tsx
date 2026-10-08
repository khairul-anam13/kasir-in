import Link from "next/link";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { getBusiness, today } from "@/lib/biz";
import { fmtQty, monthDay, rupiah } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/profiles";
import { addDays, expiringBatches, isDate, lowStock, report } from "@/lib/reports";

export const metadata = { title: "Laporan" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireUser();
  const { biz, profile } = await getBusiness();
  const sp = await searchParams;
  const tz = biz.timezone, t0 = today(tz);
  const to = isDate(sp.to) ? sp.to : t0;
  const from = isDate(sp.from) && sp.from <= to && Date.parse(to) - Date.parse(sp.from) <= 366 * 86400_000 ? sp.from : addDays(to, -6);
  const r = await report(tz, from, to);
  const low = await lowStock(t0, 6);
  const expiring = profile.features.batches ? await expiringBatches(t0, 90) : [];
  const t = r.totals;
  const max = Math.max(1, ...r.byDay.map((d) => d.revenue));
  const every = Math.ceil(r.byDay.length / 12);
  const maxCat = Math.max(1, ...r.byCategory.map((c) => c.revenue));
  const sumMethod = r.byMethod.reduce((a, m) => a + m.amount, 0) || 1;
  const preset = (label: string, f: string, tt: string) => <Link key={label} className={`btn sm ${from === f && to === tt ? "" : "ghost"}`} href={`/laporan?from=${f}&to=${tt}`}>{label}</Link>;
  const monthStart = t0.slice(0, 8) + "01";
  const q = `from=${from}&to=${to}`;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Laporan</h1><p>{from === to ? from : `${from} s/d ${to}`}</p></div>
        <div className="row wrap">
          <a className="btn ghost sm" href={`/api/export/transaksi?${q}`}><Icon name="download" />Transaksi</a>
          <a className="btn ghost sm" href={`/api/export/item?${q}`}><Icon name="download" />Item terjual</a>
          <a className="btn ghost sm" href={`/api/export/pembelian?${q}`}><Icon name="download" />Pembelian</a>
        </div>
      </div>

      <div className="toolbar">
        {preset("Hari ini", t0, t0)}{preset("Kemarin", addDays(t0, -1), addDays(t0, -1))}{preset("7 hari", addDays(t0, -6), t0)}{preset("Bulan ini", monthStart, t0)}{preset("30 hari", addDays(t0, -29), t0)}
        <form className="row wrap end" method="get">
          <input className="input" type="date" name="from" defaultValue={from} aria-label="Dari tanggal" style={{ width: 150 }} />
          <span className="muted">–</span>
          <input className="input" type="date" name="to" defaultValue={to} aria-label="Sampai tanggal" style={{ width: 150 }} />
          <button className="btn soft" type="submit">Terapkan</button>
        </form>
      </div>

      {(low.length > 0 || expiring.length > 0) && (
        <div className="card" style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
          <div className="row wrap">
            <Icon name="alert" size={22} />
            <div className="grow">
              <b>Perlu perhatian</b>
              <div className="small">
                {low.length > 0 && <>{low.length >= 6 ? "Beberapa" : low.length} item stok menipis/habis: {low.slice(0, 3).map((p) => `${p.name}${p.variant_label ? ` (${p.variant_label})` : ""}`).join(", ")}{low.length > 3 ? ", …" : ""}. </>}
                {expiring.length > 0 && <>{expiring.filter((b) => b.days_left < 0).length} batch sudah kedaluwarsa, {expiring.filter((b) => b.days_left >= 0).length} akan kedaluwarsa ≤ 90 hari.</>}
              </div>
            </div>
            <Link href="/stok" className="btn sm ghost">Buka stok</Link>
          </div>
        </div>
      )}

      <div className="stats">
        <div className="stat primary"><span className="k">Omzet</span><span className="v">{rupiah(t.revenue)}</span><span className="s">{t.orders} transaksi lunas</span></div>
        <div className="stat"><span className="k">Laba kotor</span><span className="v">{rupiah(t.profit)}</span><span className="s">penjualan bersih − harga pokok{t.net > 0 ? ` · margin ${Math.round((t.profit / t.net) * 100)}%` : ""}</span></div>
        <div className="stat"><span className="k">Rata-rata per transaksi</span><span className="v">{rupiah(t.avg)}</span></div>
        <div className="stat"><span className="k">Pembelian barang</span><span className="v">{rupiah(r.purchases.total)}</span><span className="s">{r.purchases.n} pembelian</span></div>
      </div>
      <div className="row wrap muted small" style={{ gap: 18 }}>
        <span>Diskon <b className="num">{rupiah(t.discount)}</b></span>
        {t.tax > 0 && <span>PPN <b className="num">{rupiah(t.tax)}</b></span>}
        {t.service > 0 && <span>Service <b className="num">{rupiah(t.service)}</b></span>}
        <span>Dibatalkan <b className="num">{t.voided}</b></span>
      </div>

      <div className="card">
        <div className="spread"><h2>Omzet harian</h2><span className="muted small">puncak {rupiah(max === 1 ? 0 : max)}</span></div>
        {t.orders === 0 ? <div className="empty"><Icon name="chart" /><strong>Belum ada penjualan di rentang ini</strong><span>Coba pilih rentang tanggal lain.</span></div> : (
          <div className="bars" role="img" aria-label={`Grafik omzet ${r.byDay.length} hari`}>
            {r.byDay.map((d, i) => (
              <div className="col" key={d.day} title={`${d.day}: ${rupiah(d.revenue)} (${d.orders} transaksi)`}>
                <div className="bar-slot"><div className="bar" style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%`, opacity: d.revenue ? undefined : 0.25 }} /></div>
                <span className="lbl">{i % every === 0 ? monthDay(d.day) : " "}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="split">
        <div className="card flush">
          <div style={{ padding: "14px 18px 0" }}><h2>{profile.words.items} terlaris</h2></div>
          {r.top.length === 0 ? <div className="empty"><strong>Belum ada data</strong></div> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th>Nama</th><th className="num">Terjual</th><th className="num">Omzet</th></tr></thead>
              <tbody>{r.top.map((p, i) => <tr key={i}><td><b>{p.name}</b>{p.variant_label && <span className="muted"> · {p.variant_label}</span>}</td><td className="num">{fmtQty(p.qty)}</td><td className="num"><b>{rupiah(p.revenue)}</b></td></tr>)}</tbody>
            </table></div>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h2>Metode pembayaran</h2>
            {r.byMethod.length === 0 ? <p className="muted">—</p> : (
              <div className="stack" style={{ marginTop: 12 }}>{r.byMethod.map((m) => (
                <div key={m.method}><div className="spread small"><b>{METHOD_LABEL[m.method]}</b><span className="num">{rupiah(m.amount)} · {Math.round((m.amount / sumMethod) * 100)}%</span></div><div className="meter" style={{ marginTop: 4 }}><i style={{ width: `${(m.amount / sumMethod) * 100}%` }} /></div></div>
              ))}</div>
            )}
          </div>
          <div className="card">
            <h2>Per kategori</h2>
            {r.byCategory.length === 0 ? <p className="muted">—</p> : (
              <div className="stack" style={{ marginTop: 12 }}>{r.byCategory.map((c) => (
                <div key={c.name}><div className="spread small"><b>{c.name}</b><span className="num">{rupiah(c.revenue)}</span></div><div className="meter" style={{ marginTop: 4 }}><i style={{ width: `${(c.revenue / maxCat) * 100}%` }} /></div></div>
              ))}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
