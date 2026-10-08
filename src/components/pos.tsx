"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkoutAction } from "@/app/(app)/kasir/actions";
import { fmtQty, rupiah } from "@/lib/format";
import { computeTotals, lineTotal, settle, type DiscountInput, type Rates } from "@/lib/pricing";
import { PAYMENT_METHODS, isFractionalUnit, type OptionGroup, type OrderField } from "@/lib/profiles";
import type { ReceiptAction } from "@/lib/receipt";
import { Icon } from "./icons";
import { MoneyInput } from "./money-input";
import { Sheet } from "./sheet";

export type PosProduct = {
  id: number; name: string; variant: string | null; unit: string; price: number; service: boolean;
  avail: number | null; min: number; barcode: string | null; sku: string | null;
  options: OptionGroup[]; rx: boolean; cat: number | null;
};
type Picked = { group: string; choice: string };
type Line = { key: string; id: number; qty: number; discount: number; note: string; options: Picked[] };
type Saved = { lines: Line[]; discount: DiscountInput | null; meta: Record<string, string> };
type Hold = { id: string; label: string; at: number; saved: Saved };
type Props = {
  products: PosProduct[]; categories: { id: number; name: string }[];
  words: { item: string }; hasBarcode: boolean; orderFields: OrderField[];
  rates: Rates; allowNegative: boolean; receiptAction: ReceiptAction;
};

const CART_KEY = "kasir.cart.v1", HOLD_KEY = "kasir.holds.v1";
const uid = () => Math.random().toString(36).slice(2, 9);
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privat / penuh: abaikan */ } };

export function Pos({ products, categories, words, hasBarcode, orderFields, rates, allowNegative, receiptAction }: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState<DiscountInput | null>(null);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [holds, setHolds] = useState<Hold[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<number | "all">("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [sheet, setSheet] = useState<null | { kind: "options"; p: PosProduct } | { kind: "variants"; name: string } | { kind: "line"; key: string } | { kind: "meta" } | { kind: "holds" } | { kind: "pay" }>(null);
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);
  const [done, setDone] = useState<null | { id: number; number: string; change: number; total: number }>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<number | null>(null);               // id transaksi yang strukya tampil di panel
  const [printJob, setPrintJob] = useState<{ id: number; n: number } | null>(null); // iframe tersembunyi yang langsung memanggil dialog cetak

  /* ---- simpan/muat keranjang di perangkat ini ---- */
  useEffect(() => {
    const s = read<Saved | null>(CART_KEY, null);
    if (s) { setLines(s.lines.filter((l) => byId.has(l.id))); setDiscount(s.discount); setMeta(s.meta ?? {}); }
    setHolds(read<Hold[]>(HOLD_KEY, []));
    setLoaded(true);
  }, [byId]);
  useEffect(() => { if (loaded) write(CART_KEY, { lines, discount, meta } satisfies Saved); }, [lines, discount, meta, loaded]);
  useEffect(() => { if (loaded) write(HOLD_KEY, holds); }, [holds, loaded]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const say = (msg: string, bad = false) => setToast({ msg, bad });

  /* ---- hitung ---- */
  const optPrice = (p: PosProduct, picked: Picked[]) =>
    picked.reduce((a, o) => a + (p.options.find((g) => g.name === o.group)?.choices.find((c) => c.name === o.choice)?.price ?? 0), 0);
  const unit = (l: Line) => { const p = byId.get(l.id)!; return p.price + optPrice(p, l.options); };
  const rows = lines.map((l) => ({ l, p: byId.get(l.id)!, price: unit(l), total: lineTotal(unit(l), l.qty, l.discount) }));
  const totals = computeTotals(rows.map((r) => r.total), rates, discount ?? undefined);
  const count = lines.reduce((a, l) => a + (isFractionalUnit(byId.get(l.id)!.unit) ? 1 : l.qty), 0);
  const inCart = (id: number) => lines.filter((l) => l.id === id).reduce((a, l) => a + l.qty, 0);

  /* ---- tambah / ubah ---- */
  const add = useCallback((p: PosProduct, picked: Picked[] = [], qty = 1, note = "") => {
    if (p.avail !== null && !allowNegative && inCart(p.id) + qty > p.avail) { say(p.avail <= 0 ? `${p.name} habis` : `Stok ${p.name} hanya ${fmtQty(p.avail)}`, true); return; }
    setLines((ls) => {
      const same = ls.find((l) => l.id === p.id && !l.note && !note && !l.discount && JSON.stringify(l.options) === JSON.stringify(picked));
      if (same) return ls.map((l) => (l === same ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { key: uid(), id: p.id, qty, discount: 0, note, options: picked }];
    });
    if (p.rx) say(`${p.name}: obat keras, periksa resep`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, allowNegative]);

  const tap = (p: PosProduct) => (p.options.length ? setSheet({ kind: "options", p }) : add(p));
  const setQty = (key: string, qty: number) => setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, qty } : l))));
  const step = (l: Line, dir: 1 | -1) => {
    const p = byId.get(l.id)!;
    if (dir === 1 && p.avail !== null && !allowNegative && inCart(p.id) + 1 > p.avail) return say(`Stok ${p.name} hanya ${fmtQty(p.avail)}`, true);
    setQty(l.key, Math.round((l.qty + dir) * 1000) / 1000);
  };
  const reset = () => { setLines([]); setDiscount(null); setMeta({}); };

  /* ---- scan barcode ---- */
  const scan = useCallback((code: string) => {
    const p = products.find((x) => x.barcode === code || x.sku?.toLowerCase() === code.toLowerCase());
    if (!p) return say(`Kode ${code} tidak ditemukan`, true);
    tap(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, add]);
  const busy = useRef(false);
  busy.current = sheet !== null;
  const scanRef = useRef(scan);
  scanRef.current = scan;
  useEffect(() => {
    let buf = "", last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (busy.current || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      const now = Date.now();
      if (now - last > 80) buf = "";
      last = now;
      if (e.key === "Enter") { if (buf.length >= 4) { e.preventDefault(); scanRef.current(buf); } buf = ""; return; }
      if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---- tahan / lanjutkan ---- */
  const hold = () => {
    if (!lines.length) return;
    const label = meta.table ? `Meja ${meta.table}` : meta.customer || `Pesanan ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":")}`;
    setHolds((h) => [{ id: uid(), label, at: Date.now(), saved: { lines, discount, meta } }, ...h]);
    reset(); setCartOpen(false); say("Pesanan ditahan");
  };
  const resume = (h: Hold) => {
    if (lines.length) { say("Selesaikan atau tahan keranjang saat ini dulu", true); return; }
    setLines(h.saved.lines.filter((l) => byId.has(l.id))); setDiscount(h.saved.discount); setMeta(h.saved.meta);
    setHolds((x) => x.filter((y) => y.id !== h.id)); setSheet(null); setCartOpen(true);
  };

  /* ---- daftar tampil ---- */
  const tiles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (p: PosProduct) => (cat === "all" || p.cat === cat) &&
      (!needle || `${p.name} ${p.variant ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(needle) || p.barcode === q.trim());
    const out: ({ t: "p"; p: PosProduct } | { t: "g"; name: string; vs: PosProduct[] })[] = [];
    const groups = new Map<string, PosProduct[]>();
    for (const p of products) {
      if (!hit(p)) continue;
      if (p.variant) {
        const k = `${p.cat}|${p.name}`;
        let g = groups.get(k);
        if (!g) { groups.set(k, (g = [])); out.push({ t: "g", name: p.name, vs: g }); }
        g.push(p);
      } else out.push({ t: "p", p });
    }
    return out;
  }, [products, q, cat]);

  const onSearchEnter = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = q.trim();
    const exact = code && products.find((x) => x.barcode === code || x.sku?.toLowerCase() === code.toLowerCase());
    if (exact) { tap(exact); setQ(""); } else if (code && tiles.length === 1 && tiles[0].t === "p") { tap(tiles[0].p); setQ(""); }
  };

  const editing = sheet?.kind === "line" ? rows.find((r) => r.l.key === sheet.key) : undefined;
  const needsRx = rows.some((r) => r.p.rx);
  const metaText = orderFields.map((f) => meta[f.key]).filter(Boolean).join(" · ");

  return (
    <div className="pos">
      <section className="pos-main" aria-label="Pilih item">
        <div className="pos-tools">
          <div className="searchbox">
            <Icon name="search" />
            <input ref={searchRef} className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchEnter}
              placeholder={hasBarcode ? `Cari ${words.item.toLowerCase()} atau scan barcode…` : `Cari ${words.item.toLowerCase()}…`} aria-label={`Cari ${words.item}`} enterKeyHint="search" />
          </div>
          <div className="chips" role="group" aria-label="Kategori">
            <button type="button" className="chip" aria-pressed={cat === "all"} onClick={() => setCat("all")}>Semua</button>
            {categories.map((c) => <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>)}
          </div>
        </div>
        <div className="pos-grid">
          {tiles.length === 0 && (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              <Icon name="search" />
              <strong>{products.length ? "Tidak ada yang cocok" : `Belum ada ${words.item.toLowerCase()}`}</strong>
              <span>{products.length ? "Coba kata kunci atau kategori lain." : `Tambahkan di menu ${words.item}.`}</span>
            </div>
          )}
          {tiles.map((t) => t.t === "p" ? <Tile key={t.p.id} p={t.p} allowNegative={allowNegative} onTap={() => tap(t.p)} /> : (
            <button key={t.name + t.vs[0].id} type="button" className="tile" onClick={() => setSheet({ kind: "variants", name: t.name })}
              disabled={!allowNegative && t.vs.every((v) => v.avail !== null && v.avail <= 0)}>
              <span className="bar" aria-hidden />
              <span className="nm">{t.name}</span>
              <span><span className="sub">{t.vs.length} varian</span><br /><span className="pr">{rupiah(Math.min(...t.vs.map((v) => v.price)))}{new Set(t.vs.map((v) => v.price)).size > 1 ? "+" : ""}</span></span>
            </button>
          ))}
        </div>
      </section>

      <aside className={`pos-cart ${cartOpen ? "open" : ""}`} aria-label="Keranjang">
        <div className="paper">
          <div className="paper-head">
            <button type="button" className="iconbtn only-mobile" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang"><Icon name="x" /></button>
            <h2>Pesanan</h2>
            <div className="row" style={{ gap: 2 }}>
              {orderFields.length > 0 && <button type="button" className="btn soft sm" onClick={() => setSheet({ kind: "meta" })}><Icon name="edit" />{metaText ? <span className="ellipsis" style={{ maxWidth: 130 }}>{metaText}</span> : "Detail"}</button>}
              <button type="button" className="iconbtn" onClick={() => setSheet({ kind: "holds" })} aria-label={`Pesanan tertahan (${holds.length})`} title="Pesanan tertahan" style={{ position: "relative" }}>
                <Icon name="pause" />{holds.length > 0 && <span className="badge accent" style={{ position: "absolute", top: -2, right: -2, padding: "0 6px" }}>{holds.length}</span>}
              </button>
            </div>
          </div>
          <div className="lines">
            {rows.length === 0 && <div className="empty"><Icon name="cart" /><strong>Keranjang kosong</strong><span>{hasBarcode ? "Ketuk item atau scan barcode." : "Ketuk item untuk menambahkan."}</span></div>}
            {rows.map(({ l, p, price, total }) => (
              <div className="line" key={l.key}>
                <button type="button" className="t" onClick={() => setSheet({ kind: "line", key: l.key })}>
                  {p.name}{p.variant ? ` · ${p.variant}` : ""}{p.rx && <span className="badge warn" style={{ marginLeft: 6 }}>Resep</span>}
                </button>
                <div className="sum">{rupiah(total)}{l.discount > 0 && <s>{rupiah(price * l.qty)}</s>}</div>
                <div className="m">
                  {rupiah(price)} / {p.unit}
                  {l.options.length > 0 && ` · ${l.options.map((o) => o.choice).join(", ")}`}
                  {l.note && ` · “${l.note}”`}
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => step(l, -1)} aria-label={`Kurangi ${p.name}`}><Icon name={l.qty <= 1 ? "trash" : "minus"} /></button>
                  <button type="button" className="q" onClick={() => setSheet({ kind: "line", key: l.key })} aria-label={`Ubah jumlah ${p.name}`}>{fmtQty(l.qty)}</button>
                  <button type="button" onClick={() => step(l, 1)} aria-label={`Tambah ${p.name}`}><Icon name="plus" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="paper-foot">
            <div className="r"><span>Subtotal</span><span>{rupiah(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="r"><span>Diskon</span><span>-{rupiah(totals.discount)}</span></div>}
            {totals.service > 0 && <div className="r"><span>Service {rates.serviceRate}%</span><span>{rupiah(totals.service)}</span></div>}
            {totals.tax > 0 && <div className="r"><span>PPN {rates.taxRate}%{rates.taxMode === "inclusive" ? " (termasuk)" : ""}</span><span>{rupiah(totals.tax)}</span></div>}
            <div className="r tot"><span>Total</span><span>{rupiah(totals.total)}</span></div>
          </div>
        </div>
        <div className="cart-actions">
          <button type="button" className="btn ghost lg" onClick={hold} disabled={!lines.length} aria-label="Tahan pesanan"><Icon name="pause" />Tahan</button>
          <button type="button" className="btn lg" onClick={() => setSheet({ kind: "pay" })} disabled={!lines.length}>Bayar {lines.length > 0 && rupiah(totals.total)}</button>
        </div>
      </aside>

      <button type="button" className="cartbar" onClick={() => setCartOpen(true)} aria-label="Buka keranjang">
        <span className="n">{fmtQty(count)}</span><span>{lines.length ? "Lihat pesanan" : "Keranjang kosong"}</span><span className="tot">{rupiah(totals.total)}</span>
      </button>

      {sheet?.kind === "options" && <OptionsSheet p={sheet.p} onClose={() => setSheet(null)} onAdd={(picked, qty, note) => { add(sheet.p, picked, qty, note); setSheet(null); }} />}
      {sheet?.kind === "variants" && (
        <Sheet title={sheet.name} onClose={() => setSheet(null)}>
          <div className="stack">
            {products.filter((p) => p.variant && p.name === sheet.name).map((p) => {
              const out = p.avail !== null && p.avail <= 0 && !allowNegative;
              return (
                <button key={p.id} type="button" className="btn ghost lg" style={{ justifyContent: "space-between" }} disabled={out}
                  onClick={() => { add(p); setSheet(null); }}>
                  <span>{p.variant}</span>
                  <span className="row"><span className={`badge ${out ? "bad" : p.avail !== null && p.avail <= p.min ? "warn" : ""}`}>{out ? "Habis" : p.avail !== null ? `Stok ${fmtQty(p.avail)}` : "—"}</span><b className="num">{rupiah(p.price)}</b></span>
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
      {editing && (
        <LineSheet r={editing} allowNegative={allowNegative} others={inCart(editing.p.id) - editing.l.qty} onClose={() => setSheet(null)}
          onSave={(patch) => { setLines((ls) => ls.map((l) => (l.key === editing.l.key ? { ...l, ...patch } : l))); setSheet(null); }}
          onRemove={() => { setQty(editing.l.key, 0); setSheet(null); }} />
      )}
      {sheet?.kind === "meta" && (
        <Sheet title="Detail pesanan" onClose={() => setSheet(null)}>
          <div className="form">
            {orderFields.map((f) => (
              <label className="f" key={f.key}><span>{f.label}</span>
                {f.choices
                  ? <select className="input" value={meta[f.key] ?? ""} onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })}><option value="">—</option>{f.choices.map((c) => <option key={c}>{c}</option>)}</select>
                  : <input className="input" value={meta[f.key] ?? ""} placeholder={f.placeholder} maxLength={80} onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })} />}
              </label>
            ))}
            <button type="button" className="btn" onClick={() => setSheet(null)}>Selesai</button>
          </div>
        </Sheet>
      )}
      {sheet?.kind === "holds" && (
        <Sheet title="Pesanan tertahan" onClose={() => setSheet(null)}>
          {holds.length === 0 ? <div className="empty"><Icon name="pause" /><strong>Tidak ada pesanan tertahan</strong><span>Ketuk “Tahan” di keranjang untuk menyimpan pesanan sementara.</span></div> : (
            <div className="stack">
              {holds.map((h) => {
                const tot = computeTotals(h.saved.lines.filter((l) => byId.has(l.id)).map((l) => { const p = byId.get(l.id)!; return lineTotal(p.price + optPrice(p, l.options), l.qty, l.discount); }), rates, h.saved.discount ?? undefined).total;
                return (
                  <div key={h.id} className="row card" style={{ padding: 12 }}>
                    <div className="grow"><b>{h.label}</b><div className="muted small">{h.saved.lines.length} baris · {rupiah(tot)}</div></div>
                    <button type="button" className="btn soft sm" onClick={() => resume(h)}>Lanjutkan</button>
                    <button type="button" className="iconbtn danger" aria-label={`Hapus ${h.label}`} onClick={() => setHolds((x) => x.filter((y) => y.id !== h.id))}><Icon name="trash" /></button>
                  </div>
                );
              })}
            </div>
          )}
        </Sheet>
      )}
      {sheet?.kind === "pay" && (
        <PaySheet totals={totals} discount={discount} setDiscount={setDiscount} needsRx={needsRx}
          subtotal={rows.reduce((a, r) => a + r.total, 0)}
          onClose={() => setSheet(null)}
          onPaid={(d) => { setSheet(null); setDone(d); reset(); setCartOpen(false); router.refresh(); if (receiptAction === "print") setPrintJob({ id: d.id, n: Date.now() }); }}
          submit={(payments) => checkoutAction({ lines: lines.map((l) => ({ productId: l.id, qty: l.qty, discount: l.discount, note: l.note, options: l.options })), discount: discount ?? undefined, payments, meta })} />
      )}
      {done && !preview && (
        <Sheet title="Pembayaran berhasil" onClose={() => { setDone(null); setPrintJob(null); }}>
          <div className="done">
            <span className="tick"><Icon name="check" /></span>
            <div><b className="num">{done.number}</b><div className="muted">{rupiah(done.total)}</div></div>
            {done.change > 0 && <div><div className="muted small">Kembalian</div><div className="chg">{rupiah(done.change)}</div></div>}
          </div>
          <div className="grid2">
            <button type="button" className="btn ghost lg" onClick={() => (receiptAction === "print" ? setPrintJob({ id: done.id, n: Date.now() }) : setPreview(done.id))}>
              <Icon name="print" />{receiptAction === "print" ? "Cetak ulang struk" : "Cetak struk"}
            </button>
            <button type="button" className="btn lg" data-autofocus onClick={() => { setDone(null); setPrintJob(null); }}>Transaksi baru</button>
          </div>
        </Sheet>
      )}
      {preview && <ReceiptSheet id={preview} onClose={() => setPreview(null)} />}
      {printJob && <iframe key={printJob.n} className="rcpframe-hidden" title="Cetak struk" src={`/struk/${printJob.id}?embed=1&print=1`} />}
      {toast && <div className={`toast ${toast.bad ? "bad" : ""}`} role="status">{toast.msg}</div>}
    </div>
  );
}

function Tile({ p, allowNegative, onTap }: { p: PosProduct; allowNegative: boolean; onTap: () => void }) {
  const out = p.avail !== null && p.avail <= 0;
  const low = p.avail !== null && !out && p.min > 0 && p.avail <= p.min;
  return (
    <button type="button" className="tile" onClick={onTap} disabled={out && !allowNegative}>
      <span className="bar" aria-hidden />
      <span className="nm">{p.name}</span>
      <span>
        <span className="sub">{p.unit}{p.options.length ? " · pilih opsi" : ""}{out ? <b className="st-out"> · Habis</b> : low ? <b className="st-low"> · Sisa {fmtQty(p.avail!)}</b> : null}</span>
        <br /><span className="pr">{rupiah(p.price)}</span>
      </span>
    </button>
  );
}

function OptionsSheet({ p, onClose, onAdd }: { p: PosProduct; onClose: () => void; onAdd: (picked: Picked[], qty: number, note: string) => void }) {
  const [picked, setPicked] = useState<Picked[]>(() => p.options.filter((g) => g.required && !g.multi).map((g) => ({ group: g.name, choice: g.choices[0].name })));
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const toggle = (g: OptionGroup, choice: string) => setPicked((ps) => {
    const on = ps.some((x) => x.group === g.name && x.choice === choice);
    if (g.multi) return on ? ps.filter((x) => !(x.group === g.name && x.choice === choice)) : [...ps, { group: g.name, choice }];
    return on && !g.required ? ps.filter((x) => x.group !== g.name) : [...ps.filter((x) => x.group !== g.name), { group: g.name, choice }];
  });
  const missing = p.options.find((g) => g.required && !picked.some((x) => x.group === g.name));
  const extra = picked.reduce((a, o) => a + (p.options.find((g) => g.name === o.group)?.choices.find((c) => c.name === o.choice)?.price ?? 0), 0);
  return (
    <Sheet title={p.name} onClose={onClose}>
      {p.options.map((g) => (
        <div className="f" key={g.name}>
          <span className="lbl">{g.name}{g.required ? "" : " (opsional)"}{g.multi ? " · boleh lebih dari satu" : ""}</span>
          <div className="quick" role="group" aria-label={g.name}>
            {g.choices.map((c) => {
              const on = picked.some((x) => x.group === g.name && x.choice === c.name);
              return <button key={c.name} type="button" aria-pressed={on} onClick={() => toggle(g, c.name)}
                style={on ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" } : undefined}>{c.name}{c.price ? ` +${rupiah(c.price)}` : ""}</button>;
            })}
          </div>
        </div>
      ))}
      <label className="f"><span>Catatan <em className="hint">(opsional)</em></span><input className="input" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="mis. tanpa es, pisah saus" /></label>
      <div className="spread">
        <div className="stepper">
          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Kurangi"><Icon name="minus" /></button>
          <span className="q num">{qty}</span>
          <button type="button" onClick={() => setQty(qty + 1)} aria-label="Tambah"><Icon name="plus" /></button>
        </div>
        <button type="button" className="btn lg" disabled={!!missing} onClick={() => onAdd(picked, qty, note.trim())}>
          {missing ? `Pilih ${missing.name}` : `Tambah · ${rupiah((p.price + extra) * qty)}`}
        </button>
      </div>
    </Sheet>
  );
}

function LineSheet({ r, onClose, onSave, onRemove, others, allowNegative }: {
  r: { l: Line; p: PosProduct; price: number }; onClose: () => void; onRemove: () => void; others: number; allowNegative: boolean;
  onSave: (patch: { qty: number; discount: number; note: string }) => void;
}) {
  const { l, p, price } = r;
  const frac = isFractionalUnit(p.unit);
  const [qty, setQty] = useState(String(l.qty).replace(".", ","));
  const [disc, setDisc] = useState(l.discount);
  const [note, setNote] = useState(l.note);
  const n = Number(qty.replace(",", "."));
  const max = p.avail !== null && !allowNegative ? p.avail - others : Infinity;
  const err = !(n > 0) ? "Jumlah harus lebih dari 0" : !frac && !Number.isInteger(n) ? "Jumlah harus bilangan bulat" : n > max ? `Stok tersedia ${fmtQty(max)}` : disc > Math.round(price * n) ? "Diskon melebihi harga" : "";
  return (
    <Sheet title={`${p.name}${p.variant ? ` · ${p.variant}` : ""}`} onClose={onClose}>
      <div className="grid2">
        <label className="f"><span>Jumlah ({p.unit})</span>
          <input className="input money" data-autofocus inputMode={frac ? "decimal" : "numeric"} value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d,.]/g, ""))} onFocus={(e) => e.target.select()} />
        </label>
        <label className="f"><span>Diskon item (Rp)</span><MoneyInput value={disc} onChange={setDisc} /></label>
      </div>
      <label className="f"><span>Catatan</span><input className="input" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="grid2">
        <button type="button" className="btn danger soft lg" onClick={onRemove}><Icon name="trash" />Hapus</button>
        <button type="button" className="btn lg" disabled={!!err} onClick={() => onSave({ qty: n, discount: disc, note: note.trim() })}>Simpan</button>
      </div>
    </Sheet>
  );
}

function PaySheet({ totals, discount, setDiscount, onClose, onPaid, submit, needsRx, subtotal }: {
  totals: ReturnType<typeof computeTotals>; discount: DiscountInput | null; setDiscount: (d: DiscountInput | null) => void;
  onClose: () => void; needsRx: boolean; subtotal: number;
  onPaid: (d: { id: number; number: string; change: number; total: number }) => void;
  submit: (p: { method: string; amount: number }[]) => Promise<{ ok: true; id: number; number: string } | { error: string }>;
}) {
  const [pays, setPays] = useState<{ id: string; method: string; amount: number }[]>([{ id: "a", method: "cash", amount: totals.total }]);
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [dv, setDv] = useState(discount?.value ?? 0);
  const [dt, setDt] = useState<"pct" | "amt">(discount?.type ?? "pct");
  const total = totals.total;

  // Selama pembayaran belum disentuh, baris pertama selalu "uang pas" mengikuti total (diskon bisa berubah).
  useEffect(() => { if (!touched) setPays((p) => [{ ...p[0], amount: total }, ...p.slice(1)]); }, [total, touched]);
  const applyDiscount = (value: number, type: "pct" | "amt") => { setDv(value); setDt(type); setDiscount(value > 0 ? { type, value } : null); };

  const res = settle(total, pays);
  const paid = pays.reduce((a, p) => a + p.amount, 0);
  const diff = paid - total;
  const cashRow = pays.find((p) => p.method === "cash");
  const quick = [...new Set([total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000])].filter((x) => x >= total).slice(0, 4);

  const setRow = (id: string, patch: Partial<{ method: string; amount: number }>) => { setTouched(true); setPays((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))); };
  const addRow = () => { setTouched(true); setPays((ps) => [...ps, { id: Math.random().toString(36).slice(2, 6), method: ps.some((p) => p.method === "qris") ? "transfer" : "qris", amount: Math.max(0, total - paid) }]); };

  const go = () => {
    setErr("");
    if (!res.ok) return setErr(res.error);
    start(async () => {
      const r = await submit(pays.filter((p) => p.amount > 0));
      if ("error" in r) return setErr(r.error);
      onPaid({ id: r.id, number: r.number, change: res.change, total });
    });
  };

  return (
    <Sheet title="Pembayaran" onClose={onClose}>
      <div className="pay-total"><span className="small">Total tagihan</span><span className="v">{rupiah(total)}</span></div>
      {needsRx && <p className="note"><b>Ada obat keras.</b> Pastikan resep sudah diperiksa dan isi nama dokter / no. resep di Detail pesanan.</p>}
      <div className="f"><span className="lbl">Diskon transaksi {subtotal > 0 && <em className="hint">dari {rupiah(subtotal)}</em>}</span>
        <div className="row">
          <div className="segmented" role="radiogroup" aria-label="Jenis diskon">
            <label><input type="radio" checked={dt === "pct"} onChange={() => applyDiscount(dv, "pct")} /><span>%</span></label>
            <label><input type="radio" checked={dt === "amt"} onChange={() => applyDiscount(dv, "amt")} /><span>Rp</span></label>
          </div>
          <MoneyInput className="input money grow" value={dv} onChange={(v) => applyDiscount(dt === "pct" ? Math.min(100, v) : v, dt)} aria-label="Nilai diskon" placeholder="0" />
        </div>
      </div>
      <div className="stack">
        {pays.map((p) => (
          <div className="payrow" key={p.id}>
            <select className="input" value={p.method} onChange={(e) => setRow(p.id, { method: e.target.value })} aria-label="Metode bayar">
              {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <MoneyInput value={p.amount} onChange={(v) => setRow(p.id, { amount: v })} aria-label="Jumlah dibayar" data-autofocus={p.id === "a" ? true : undefined} />
            {pays.length > 1 ? <button type="button" className="iconbtn danger" aria-label="Hapus baris" onClick={() => { setTouched(true); setPays((ps) => ps.filter((x) => x.id !== p.id)); }}><Icon name="x" /></button> : <span />}
          </div>
        ))}
        <div className="row wrap">
          {cashRow && pays.length === 1 && <div className="quick" aria-label="Uang cepat">{quick.map((x, i) => <button key={x} type="button" onClick={() => setRow(cashRow.id, { amount: x })}>{i === 0 ? "Uang pas" : rupiah(x)}</button>)}</div>}
          <button type="button" className="btn ghost sm end" onClick={addRow}><Icon name="plus" />Metode lain</button>
        </div>
      </div>
      <div className={`balance ${diff < 0 ? "short" : diff > 0 ? "change" : ""}`} role="status">
        <span>{diff < 0 ? "Kurang" : diff > 0 ? "Kembalian" : "Pas"}</span><span>{diff === 0 ? "" : rupiah(Math.abs(diff))}</span>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn lg block" disabled={pending || !res.ok} onClick={go}>{pending ? "Memproses…" : "Selesaikan pembayaran"}</button>
    </Sheet>
  );
}

/** Pratinjau struk dalam panel (iframe ke halaman struk mode embed) dengan tombol Cetak. */
function ReceiptSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const fit = () => { const f = frame.current, d = f?.contentDocument; if (f && d) f.style.height = d.documentElement.scrollHeight + "px"; };
  return (
    <Sheet title="Struk" onClose={onClose}>
      <div className="rcpwrap"><iframe ref={frame} className="rcpframe" title="Pratinjau struk" src={`/struk/${id}?embed=1`} onLoad={fit} style={{ height: 360 }} /></div>
      <div className="grid2">
        <button type="button" className="btn ghost lg" onClick={onClose}>Tutup</button>
        <button type="button" className="btn lg" data-autofocus onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }}><Icon name="print" />Cetak</button>
      </div>
    </Sheet>
  );
}
