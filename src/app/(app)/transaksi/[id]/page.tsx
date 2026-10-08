import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { dateTimeOf, fmtQty, rupiah } from "@/lib/format";
import { getOrder } from "@/lib/orders";
import { METHOD_LABEL } from "@/lib/profiles";
import { voidAction } from "../actions";

export const metadata = { title: "Detail transaksi" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const data = await getOrder(Number((await params).id));
  if (!data) notFound();
  const { biz, profile } = await getBusiness();
  const { order: o, items, payments } = data;
  const tz = biz.timezone;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href="/transaksi" className="small">← Semua transaksi</Link>
          <h1 className="num">{o.number} {o.status === "void" ? <span className="badge bad">Dibatalkan</span> : <span className="badge ok">Lunas</span>}</h1>
          <p>{dateTimeOf(o.created_at, tz)} · Kasir {o.cashier_name}</p>
        </div>
        <Link href={`/struk/${o.id}`} className="btn soft"><Icon name="print" />Struk</Link>
      </div>

      <div className="split">
        <div className="card flush">
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Harga</th><th className="num">Jumlah</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <b>{i.name}</b>{i.variant_label && <span className="muted"> · {i.variant_label}</span>}
                      {(i.options.length > 0 || i.note) && <div className="muted small">{[...i.options.map((x) => x.name), i.note && `“${i.note}”`].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="num">{fmtQty(i.qty)} {i.unit}</td>
                    <td className="num">{rupiah(i.price)}</td>
                    <td className="num">{rupiah(i.total)}{i.discount > 0 && <div className="muted small">diskon -{rupiah(i.discount)}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <dl className="kv">
              <dt>Subtotal</dt><dd>{rupiah(o.subtotal)}</dd>
              {o.discount > 0 && <><dt>Diskon</dt><dd>-{rupiah(o.discount)}</dd></>}
              {o.service > 0 && <><dt>Service</dt><dd>{rupiah(o.service)}</dd></>}
              {o.tax > 0 && <><dt>PPN</dt><dd>{rupiah(o.tax)}</dd></>}
              <dt className="total">Total</dt><dd className="total">{rupiah(o.total)}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>Pembayaran</h2>
            <dl className="kv" style={{ marginTop: 10 }}>
              {payments.map((p) => <Fragment key={p.id}><dt>{METHOD_LABEL[p.method] ?? p.method}</dt><dd>{rupiah(p.tendered)}</dd></Fragment>)}
              {o.change > 0 && <><dt>Kembalian</dt><dd>{rupiah(o.change)}</dd></>}
              {payments.length === 0 && <><dt>Tanpa pembayaran</dt><dd>—</dd></>}
            </dl>
          </div>
          {profile.orderFields.some((f) => o.meta[f.key]) && (
            <div className="card">
              <h2>Detail pesanan</h2>
              <dl className="kv" style={{ marginTop: 10 }}>
                {profile.orderFields.filter((f) => o.meta[f.key]).map((f) => <Fragment key={f.key}><dt>{f.label}</dt><dd>{o.meta[f.key]}</dd></Fragment>)}
              </dl>
            </div>
          )}
          {o.status === "void" ? (
            <div className="note"><b>Dibatalkan</b> {o.voided_at && dateTimeOf(o.voided_at, tz)}<br />Alasan: {o.void_reason}</div>
          ) : (
            <details className="card">
              <summary style={{ cursor: "pointer", fontWeight: 650 }}>Batalkan transaksi</summary>
              <ActionForm action={voidAction} submit="Batalkan transaksi ini" variant="danger" className="form">
                <p className="muted small" style={{ marginTop: 10 }}>Stok dikembalikan dan transaksi tidak dihitung di laporan. Tindakan ini tidak bisa diurungkan.</p>
                <input type="hidden" name="id" value={o.id} />
                <label className="f"><span>Alasan pembatalan</span><input className="input" name="reason" required maxLength={200} placeholder="mis. salah input, pelanggan batal" /></label>
              </ActionForm>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
