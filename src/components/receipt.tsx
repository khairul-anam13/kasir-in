import type { Business } from "@/lib/biz";
import { dateTimeOf, fitName, fmtQty, rupiah } from "@/lib/format";
import type { ItemRow, OrderRow, PaymentRow } from "@/lib/orders";
import { METHOD_LABEL, type OrderField } from "@/lib/profiles";
import { LOGO_SIZES, type ReceiptTemplate } from "@/lib/receipt";

export type ReceiptData = {
  biz: Pick<Business, "name" | "address" | "phone" | "paperWidth" | "receiptFooter" | "serviceRate" | "taxRate" | "taxMode" | "timezone" | "logo" | "logoSize" | "logoName">;
  orderFields: OrderField[]; order: OrderRow; items: ItemRow[]; payments: PaymentRow[];
};

/**
 * Nota. Tiga desain berbagi data yang sama; yang berbeda hanya tata letak (kelas t-klasik/t-ringkas/t-modern di pos.css).
 * Teks panjang tidak pernah melewati lebar kertas: nama kasir disingkat (fitName), sisanya wrap per kata/huruf lewat CSS.
 */
export function Receipt({ data, template }: { data: ReceiptData; template: ReceiptTemplate }) {
  const { biz, order: o, items, payments } = data;
  const tz = biz.timezone;
  const cashier = fitName(o.cashier_name, biz.paperWidth === 58 ? 16 : 26);
  const meta = data.orderFields.filter((f) => o.meta[f.key]).map((f) => [f.label, o.meta[f.key]] as const);
  const when = dateTimeOf(o.created_at, tz);
  const ppn = `PPN ${biz.taxRate}%${biz.taxMode === "inclusive" ? " (termasuk)" : ""}`;

  /** label ........ jumlah (jumlah tidak pernah terpotong) */
  const amt = (l: string, r: string, cls = "", key?: string | number) => <div key={key} className={`tr ${cls}`}><span>{l}</span><span>{r}</span></div>;
  /** label ........ teks bebas (boleh banyak baris, rata kanan) */
  const kv = (l: string, v: string, key?: string | number) => <div key={key} className="tr kv"><span>{l}</span><span>{v}</span></div>;
  const itemName = (i: ItemRow) => `${i.name}${i.variant_label ? ` (${i.variant_label})` : ""}`;
  const details = (i: ItemRow) => <>
    {i.options.length > 0 && <div className="sub">{i.options.map((x) => x.name).join(", ")}</div>}
    {i.note && <div className="sub">“{i.note}”</div>}
    {i.discount > 0 && <div className="sub">Diskon -{rupiah(i.discount)}</div>}
  </>;

  const head = (
    <header className="rh">
      {biz.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="logo" src={biz.logo} alt={biz.name} style={{ width: `${LOGO_SIZES.find((x) => x.id === biz.logoSize)?.pct ?? 55}%` }} />
      )}
      {(!biz.logo || biz.logoName) && <h1>{biz.name}</h1>}
      {biz.address && <div className="c">{biz.address}</div>}
      {biz.phone && <div className="c">{biz.phone}</div>}
    </header>
  );
  const voided = o.status === "void" && <div className="c big stamp">*** DIBATALKAN ***</div>;
  const totals = <>
    {amt("Subtotal", rupiah(o.subtotal))}
    {o.discount > 0 && amt("Diskon", `-${rupiah(o.discount)}`)}
    {o.service > 0 && amt(`Service ${biz.serviceRate}%`, rupiah(o.service))}
    {o.tax > 0 && amt(ppn, rupiah(o.tax))}
  </>;
  const pays = <>
    {payments.map((p) => amt(METHOD_LABEL[p.method] ?? p.method, rupiah(p.tendered), "", p.id))}
    {o.change > 0 && amt("Kembali", rupiah(o.change), "b")}
  </>;
  const foot = <>
    <div className="c">{biz.receiptFooter}</div>
    <div className="c faintp">Dicetak dengan Kasir-in</div>
  </>;
  const cls = `thermal t-${template}`;
  const style = { "--paper": `${biz.paperWidth}mm` } as React.CSSProperties;

  if (template === "ringkas") {
    return (
      <article className={cls} style={style} aria-label={`Struk ${o.number}`}>
        {head}
        <hr />
        <div className="c">{o.number} · {when}</div>
        <div className="c">Kasir: {cashier}</div>
        {meta.length > 0 && <div className="c">{meta.map(([, v]) => v).join(" · ")}</div>}
        <hr />
        {voided}
        {items.map((i) => (
          <div className="it" key={i.id}>
            {amt(`${fmtQty(i.qty)}x ${itemName(i)}`, rupiah(i.total))}
            {details(i)}
          </div>
        ))}
        <hr />
        {totals}
        {amt("TOTAL", rupiah(o.total), "big")}
        {pays}
        <hr />
        <div className="c">{biz.receiptFooter}</div>
      </article>
    );
  }

  if (template === "modern") {
    return (
      <article className={cls} style={style} aria-label={`Struk ${o.number}`}>
        {head}
        <div className="rule" />
        <div className="rno">{o.number}</div>
        <div className="meta">
          {kv("Tanggal", when)}
          {kv("Kasir", cashier)}
          {meta.map(([l, v]) => kv(l, v, l))}
        </div>
        <div className="rule" />
        {voided}
        {items.map((i) => (
          <div className="it" key={i.id}>
            <div className="nm">{itemName(i)}</div>
            {amt(`${fmtQty(i.qty)} ${i.unit} × ${rupiah(i.price)}`, rupiah(i.total), "muted")}
            {details(i)}
          </div>
        ))}
        <div className="rule" />
        {totals}
        <div className="box"><span>TOTAL</span><b>{rupiah(o.total)}</b></div>
        {pays}
        <div className="rule" />
        {foot}
      </article>
    );
  }

  return (
    <article className={cls} style={style} aria-label={`Struk ${o.number}`}>
      {head}
      <hr />
      {kv("No", o.number)}
      {kv("Tanggal", when)}
      {kv("Kasir", cashier)}
      {meta.map(([l, v]) => kv(l, v, l))}
      <hr />
      {voided}
      {items.map((i) => (
        <div className="it" key={i.id}>
          <div className="nm">{itemName(i)}</div>
          {details(i)}
          {amt(`${fmtQty(i.qty)} ${i.unit} x ${rupiah(i.price)}`, rupiah(i.price * i.qty))}
        </div>
      ))}
      <hr />
      {totals}
      {amt("TOTAL", rupiah(o.total), "big")}
      <hr />
      {pays}
      <hr />
      {foot}
    </article>
  );
}
