import { Fragment } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { dateTimeOf, rupiah } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/profiles";
import { currentShift, shiftSummary } from "@/lib/shifts";
import { openShiftAction } from "../kasir/actions";
import { cashMoveAction, closeShiftAction } from "./actions";

export const metadata = { title: "Shift" };

export default async function ShiftPage() {
  const user = await requireUser();
  const { biz } = await getBusiness();
  const tz = biz.timezone;
  const cur = await currentShift();
  const sum = cur ? await shiftSummary(cur.id) : null;
  const history = await sql<{ id: number; cashier_name: string; opened_at: Date; closed_at: Date; opening_cash: number; expected_cash: number; counted_cash: number; note: string; n: number; sales: number }[]>`
    select s.*, (select count(*)::int from orders o where o.shift_id = s.id and o.status = 'paid') n,
           (select coalesce(sum(total), 0)::int from orders o where o.shift_id = s.id and o.status = 'paid') sales
    from shifts s where s.closed_at is not null order by s.id desc limit 30`;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Shift</h1><p>{cur ? <>Dibuka {dateTimeOf(cur.opened_at, tz)} oleh <b>{cur.cashier_name}</b></> : "Belum ada shift yang terbuka. Buka shift untuk mulai mencatat penjualan."}</p></div>
        {cur ? <span className="badge ok">Shift berjalan</span> : <span className="badge warn">Tidak ada shift</span>}
      </div>

      {sum && cur ? (
        <>
          <div className="stats">
            <div className="stat"><span className="k">Modal awal</span><span className="v">{rupiah(cur.opening_cash)}</span></div>
            <div className="stat"><span className="k">Penjualan ({sum.orders} transaksi)</span><span className="v">{rupiah(sum.sales)}</span>{sum.voided > 0 && <span className="s">{sum.voided} dibatalkan</span>}</div>
            <div className="stat"><span className="k">Tunai dari penjualan</span><span className="v">{rupiah(sum.cashSales)}</span></div>
            <div className="stat primary"><span className="k">Seharusnya ada di laci</span><span className="v">{rupiah(sum.expected)}</span><span className="s">modal + tunai + kas masuk − kas keluar</span></div>
          </div>
          <div className="split">
            <div className="stack">
              <div className="card">
                <h2>Kas masuk / keluar</h2>
                <p className="muted small" style={{ margin: "4px 0 12px" }}>Catat uang yang dimasukkan atau diambil dari laci selain penjualan (beli galon, tambah uang kembalian, setor ke pemilik).</p>
                <ActionForm action={cashMoveAction} submit="Catat" clearOnOk>
                  <div className="grid3">
                    <div className="f"><span className="lbl">Jenis</span>
                      <div className="segmented"><label><input type="radio" name="kind" value="out" defaultChecked /><span>Keluar</span></label><label><input type="radio" name="kind" value="in" /><span>Masuk</span></label></div>
                    </div>
                    <label className="f"><span>Jumlah (Rp)</span><input className="input money" name="amount" inputMode="numeric" required /></label>
                    <label className="f"><span>Keterangan</span><input className="input" name="note" required maxLength={120} /></label>
                  </div>
                </ActionForm>
                {sum.moves.length > 0 && (
                  <div className="tbl-wrap" style={{ marginTop: 12 }}><table><tbody>{sum.moves.map((m) => (
                    <tr key={m.id}><td className="nowrap muted">{dateTimeOf(m.created_at, tz)}</td><td>{m.note}</td>
                      <td className="num" style={{ color: m.kind === "in" ? "var(--ok)" : "var(--bad)", fontWeight: 650 }}>{m.kind === "in" ? "+" : "-"}{rupiah(m.amount)}</td></tr>
                  ))}</tbody></table></div>
                )}
              </div>
              <div className="card">
                <h2>Penjualan per metode</h2>
                {sum.methods.length === 0 ? <p className="muted">Belum ada penjualan di shift ini.</p> : (
                  <dl className="kv" style={{ marginTop: 10 }}>{sum.methods.map((m) => <Fragment key={m.method}><dt>{METHOD_LABEL[m.method]}</dt><dd>{rupiah(m.amount)}</dd></Fragment>)}</dl>
                )}
              </div>
            </div>
            <div className="card">
              <h2>Tutup shift</h2>
              <p className="muted small" style={{ margin: "4px 0 12px" }}>Hitung uang tunai di laci, lalu isi jumlahnya. Selisih dicatat untuk pemeriksaan.</p>
              <ActionForm action={closeShiftAction} submit="Tutup shift" variant="danger">
                <label className="f"><span>Uang tunai di laci (Rp)</span><input className="input money" name="counted" inputMode="numeric" required /></label>
                <label className="f"><span>Catatan <em className="hint">(opsional)</em></span><input className="input" name="note" maxLength={200} /></label>
              </ActionForm>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ maxWidth: 480 }}>
          <h2>Buka shift</h2>
          <ActionForm action={openShiftAction} submit="Buka shift">
            <p className="muted small" style={{ marginTop: 8 }}>Kasir: <b>{user.name}</b></p>
            <label className="f"><span>Modal awal (Rp)</span><input className="input money" name="opening" inputMode="numeric" defaultValue="0" /></label>
          </ActionForm>
        </div>
      )}

      <div className="card flush">
        <div style={{ padding: "14px 18px 0" }}><h2>Riwayat shift</h2></div>
        {history.length === 0 ? <div className="empty"><strong>Belum ada shift selesai</strong></div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Kasir</th><th>Buka</th><th>Tutup</th><th className="num">Transaksi</th><th className="num">Penjualan</th><th className="num">Seharusnya</th><th className="num">Dihitung</th><th className="num">Selisih</th></tr></thead>
            <tbody>{history.map((h) => {
              const d = h.counted_cash - h.expected_cash;
              return (
                <tr key={h.id}><td>{h.cashier_name}</td><td className="nowrap">{dateTimeOf(h.opened_at, tz)}</td><td className="nowrap">{dateTimeOf(h.closed_at, tz)}</td>
                  <td className="num">{h.n}</td><td className="num">{rupiah(h.sales)}</td><td className="num">{rupiah(h.expected_cash)}</td><td className="num">{rupiah(h.counted_cash)}</td>
                  <td className="num"><span className={`badge ${d === 0 ? "ok" : "bad"}`}>{d === 0 ? "Pas" : (d > 0 ? "+" : "") + rupiah(d)}</span></td></tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
      <p className="muted small"><Link href="/transaksi">Lihat semua transaksi →</Link></p>
    </div>
  );
}
