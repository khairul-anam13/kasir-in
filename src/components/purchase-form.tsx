"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseAction } from "@/app/(app)/pembelian/actions";
import { fmtQty, rupiah } from "@/lib/format";
import { Icon } from "./icons";
import { MoneyInput } from "./money-input";

type Prod = { id: number; name: string; variant: string | null; unit: string; cost: number; sku: string | null };
type Item = { key: number; label: string; productId: number; qty: string; cost: number; batchNo: string; expiry: string };

export function PurchaseForm({ products, suppliers, batches }: { products: Prod[]; suppliers: { id: number; name: string }[]; batches: boolean }) {
  const router = useRouter();
  const labels = useMemo(() => {
    const m = new Map<string, Prod>();
    for (const p of products) {
      const base = `${p.name}${p.variant ? ` (${p.variant})` : ""}`;
      m.set(m.has(base) ? `${base} · ${p.sku ?? `#${p.id}`}` : base, p);
    }
    return m;
  }, [products]);
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const add = (text: string) => {
    const p = labels.get(text);
    if (!p) return;
    setItems((xs) => [...xs, { key: Date.now() + Math.random(), label: text, productId: p.id, qty: "1", cost: p.cost, batchNo: "", expiry: "" }]);
    setDraft("");
  };
  const patch = (key: number, x: Partial<Item>) => setItems((xs) => xs.map((i) => (i.key === key ? { ...i, ...x } : i)));
  const total = items.reduce((a, i) => a + Math.round((Number(i.qty.replace(",", ".")) || 0) * i.cost), 0);

  const save = () => {
    setErr("");
    if (!items.length) return setErr("Tambahkan minimal satu barang");
    start(async () => {
      const r = await createPurchaseAction({
        supplierId: supplier ? Number(supplier) : null, invoiceNo: invoice, note,
        items: items.map((i) => ({ productId: i.productId, qty: Number(i.qty.replace(",", ".")), cost: i.cost, batchNo: i.batchNo, expiry: i.expiry })),
      });
      if ("error" in r) return setErr(r.error);
      router.push(`/pembelian/${r.id}`);
    });
  };

  return (
    <div className="stack-lg">
      <div className="card form">
        <div className="grid3">
          <label className="f"><span>Supplier</span>
            <select className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              <option value="">Tanpa supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="f"><span>No. faktur supplier</span><input className="input" value={invoice} maxLength={60} onChange={(e) => setInvoice(e.target.value)} /></label>
          <label className="f"><span>Catatan</span><input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
      </div>

      <div className="card flush">
        <div style={{ padding: 16 }}>
          <label className="f"><span>Tambah barang</span>
            <input className="input" list="purchase-products" value={draft} placeholder="Ketik nama lalu pilih dari daftar…" autoComplete="off"
              onChange={(e) => { setDraft(e.target.value); if (labels.has(e.target.value)) add(e.target.value); }} />
            <datalist id="purchase-products">{[...labels.keys()].map((l) => <option key={l} value={l} />)}</datalist>
          </label>
        </div>
        {items.length > 0 && (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Barang</th><th className="num" style={{ width: 110 }}>Jumlah</th><th className="num" style={{ width: 150 }}>Harga beli</th>{batches && <><th style={{ width: 130 }}>No. batch</th><th style={{ width: 160 }}>Kedaluwarsa</th></>}<th className="num">Jumlah (Rp)</th><th /></tr></thead>
            <tbody>{items.map((i) => {
              const unit = products.find((p) => p.id === i.productId)?.unit;
              return (
                <tr key={i.key}>
                  <td><b>{i.label}</b>{unit && <span className="faint small"> · {unit}</span>}</td>
                  <td><input className="input money" inputMode="decimal" value={i.qty} onChange={(e) => patch(i.key, { qty: e.target.value.replace(/[^\d,.]/g, "") })} aria-label={`Jumlah ${i.label}`} /></td>
                  <td><MoneyInput value={i.cost} onChange={(v) => patch(i.key, { cost: v })} aria-label={`Harga beli ${i.label}`} /></td>
                  {batches && <>
                    <td><input className="input" value={i.batchNo} maxLength={40} onChange={(e) => patch(i.key, { batchNo: e.target.value })} aria-label={`No. batch ${i.label}`} required /></td>
                    <td><input className="input" type="date" value={i.expiry} onChange={(e) => patch(i.key, { expiry: e.target.value })} aria-label={`Kedaluwarsa ${i.label}`} required /></td>
                  </>}
                  <td className="num"><b>{rupiah(Math.round((Number(i.qty.replace(",", ".")) || 0) * i.cost))}</b></td>
                  <td><button type="button" className="iconbtn danger" aria-label={`Hapus ${i.label}`} onClick={() => setItems((xs) => xs.filter((x) => x.key !== i.key))}><Icon name="trash" /></button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        {items.length === 0 && <div className="empty"><Icon name="truck" /><strong>Belum ada barang</strong><span>Cari barang di atas untuk menambahkannya ke pembelian ini.</span></div>}
      </div>

      {err && <p className="err" role="alert">{err}</p>}
      <div className="spread">
        <div><span className="muted">Total pembelian</span> <b className="num" style={{ fontSize: "1.4rem", marginLeft: 8 }}>{rupiah(total)}</b>{items.length > 0 && <span className="faint small"> · {fmtQty(items.length)} baris</span>}</div>
        <button type="button" className="btn lg" onClick={save} disabled={pending || !items.length}>{pending ? "Menyimpan…" : "Simpan & tambah stok"}</button>
      </div>
    </div>
  );
}
