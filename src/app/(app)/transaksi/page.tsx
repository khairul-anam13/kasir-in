import Link from "next/link";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { getBusiness, today } from "@/lib/biz";
import { sql } from "@/lib/db";
import { dateTimeOf, rupiah } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/profiles";
import { addDays, isDate } from "@/lib/reports";

export const metadata = { title: "Transaksi" };

type Row = { id: number; number: string; created_at: Date; status: string; total: number; cashier_name: string; n: number; methods: string | null; meta: Record<string, string> };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; status?: string; q?: string }> }) {
  await requireUser();
  const { biz, profile } = await getBusiness();
  const sp = await searchParams;
  const tz = biz.timezone, t0 = today(tz);
  const to = isDate(sp.to) ? sp.to : t0;
  const from = isDate(sp.from) && sp.from <= to ? sp.from : to;
  const status = sp.status === "paid" || sp.status === "void" ? sp.status : "";
  const q = (sp.q ?? "").trim().slice(0, 40);

  const rows = await sql<Row[]>`
    select o.id, o.number, o.created_at, o.status, o.total, o.cashier_name, o.meta,
           (select count(*)::int from order_items i where i.order_id = o.id) n,
           (select string_agg(distinct p.method, ',') from payments p where p.order_id = o.id) methods
    from orders o
    where (o.created_at at time zone ${tz})::date between ${from}::date and ${to}::date
      ${status ? sql`and o.status = ${status}` : sql``}
      ${q ? sql`and (o.number ilike ${"%" + q.replace(/[%_\\]/g, "\\$&") + "%"} or o.meta::text ilike ${"%" + q.replace(/[%_\\]/g, "\\$&") + "%"})` : sql``}
    order by o.id desc limit 300`;
  const paid = rows.filter((r) => r.status === "paid");
  const sum = paid.reduce((a, r) => a + r.total, 0);
  const preset = (label: string, f: string, tt: string) => <Link key={label} className={`btn sm ${from === f && to === tt ? "" : "ghost"}`} href={`/transaksi?from=${f}&to=${tt}`}>{label}</Link>;
  const who = (m: Record<string, string>) => profile.orderFields.map((f) => m[f.key]).filter(Boolean).join(" · ");

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Transaksi</h1><p>{rows.length >= 300 ? "300 transaksi terbaru" : `${rows.length} transaksi`} · {paid.length} lunas · <b className="num">{rupiah(sum)}</b></p></div>
      </div>
      <div className="toolbar">
        {preset("Hari ini", t0, t0)}{preset("Kemarin", addDays(t0, -1), addDays(t0, -1))}{preset("7 hari", addDays(t0, -6), t0)}{preset("30 hari", addDays(t0, -29), t0)}
      </div>
      <form className="toolbar" method="get">
        <input className="input" type="date" name="from" defaultValue={from} aria-label="Dari tanggal" style={{ width: 160 }} />
        <span className="muted">sampai</span>
        <input className="input" type="date" name="to" defaultValue={to} aria-label="Sampai tanggal" style={{ width: 160 }} />
        <select className="input" name="status" defaultValue={status} aria-label="Status" style={{ width: 130 }}>
          <option value="">Semua</option><option value="paid">Lunas</option><option value="void">Dibatalkan</option>
        </select>
        <input className="input search" type="search" name="q" defaultValue={q} placeholder="Cari no. transaksi atau nama…" aria-label="Cari" />
        <button className="btn soft" type="submit">Terapkan</button>
      </form>
      <div className="card flush">
        {rows.length === 0 ? (
          <div className="empty"><Icon name="receipt" /><strong>Belum ada transaksi</strong><span>Transaksi dari layar kasir akan muncul di sini.</span></div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>No</th><th>Waktu</th><th>Keterangan</th><th>Bayar</th><th className="num">Item</th><th className="num">Total</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === "void" ? "void" : ""}>
                    <td><Link href={`/transaksi/${r.id}`}><b className="num">{r.number}</b></Link></td>
                    <td className="nowrap">{dateTimeOf(r.created_at, tz)}</td>
                    <td className="muted">{who(r.meta) || "—"}</td>
                    <td>{(r.methods ?? "").split(",").filter(Boolean).map((m) => METHOD_LABEL[m] ?? m).join(", ") || "—"}</td>
                    <td className="num">{r.n}</td>
                    <td className="num"><b>{rupiah(r.total)}</b></td>
                    <td>{r.status === "void" ? <span className="badge bad">Dibatalkan</span> : <span className="badge ok">Lunas</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
