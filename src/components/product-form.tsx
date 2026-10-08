"use client";
import { useState } from "react";
import { saveProduct } from "@/app/(app)/produk/actions";
import type { OptionGroup, Profile } from "@/lib/profiles";
import { ActionForm } from "./action-form";
import { Icon } from "./icons";

export type ProductInput = {
  id: number; name: string; variant_label: string | null; category_id: number | null; unit: string; price: number; cost: number;
  sku: string | null; barcode: string | null; is_service: boolean; min_stock: number; options: OptionGroup[]; requires_rx: boolean; active: boolean;
};

export function ProductForm({ product, categories, profile }: { product?: ProductInput; categories: { id: number; name: string }[]; profile: Pick<Profile, "features" | "words" | "units"> }) {
  const f = profile.features;
  const [noStock, setNoStock] = useState(product ? product.is_service : f.defaultNoStock);
  const [opts, setOpts] = useState<OptionGroup[]>(product?.options ?? []);
  const money = (n?: number) => (n === undefined ? "" : String(n));

  return (
    <ActionForm action={saveProduct} submit={product ? "Simpan perubahan" : "Tambah"}>
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="card form">
        <h2>Informasi dasar</h2>
        <div className="grid2">
          <label className="f"><span>Nama</span><input className="input" name="name" defaultValue={product?.name} required maxLength={80} autoFocus={!product} /></label>
          <label className="f"><span>Kategori</span>
            <select className="input" name="category_id" defaultValue={product?.category_id ?? ""}>
              <option value="">Tanpa kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        {f.variants && (product
          ? <label className="f"><span>Varian <em className="hint">(mis. M / Hitam)</em></span><input className="input" name="variant_label" defaultValue={product.variant_label ?? ""} maxLength={40} /></label>
          : <label className="f"><span>Varian <em className="hint">(opsional, pisahkan dengan koma)</em></span>
              <textarea className="input" name="variant_list" placeholder="M / Hitam, L / Hitam, XL / Hitam" />
              <span className="hint">Setiap varian menjadi satu baris dengan stok dan barcode sendiri. Kosongkan jika produk tanpa varian.</span>
            </label>)}
        <div className="grid3">
          <label className="f"><span>Harga jual (Rp)</span><input className="input money" name="price" inputMode="numeric" defaultValue={money(product?.price)} required /></label>
          <label className="f"><span>Harga beli (Rp)</span><input className="input money" name="cost" inputMode="numeric" defaultValue={money(product?.cost ?? 0)} /></label>
          <label className="f"><span>Satuan</span>
            <input className="input" name="unit" list="units" defaultValue={product?.unit ?? profile.units[0]} maxLength={20} />
            <datalist id="units">{profile.units.map((u) => <option key={u} value={u} />)}</datalist>
          </label>
        </div>
        <div className="grid2">
          <label className="f"><span>SKU / kode <em className="hint">(opsional)</em></span><input className="input" name="sku" defaultValue={product?.sku ?? ""} maxLength={40} /></label>
          {f.barcode && <label className="f"><span>Barcode <em className="hint">(scan langsung di kolom ini)</em></span><input className="input" name="barcode" defaultValue={product?.barcode ?? ""} maxLength={40} inputMode="numeric" /></label>}
        </div>
        {f.rx && <label className="check"><input type="checkbox" name="requires_rx" defaultChecked={product?.requires_rx} /> Obat keras (perlu resep) — kasir diingatkan saat dijual</label>}
      </div>

      <div className="card form">
        <h2>Stok</h2>
        <label className="check"><input type="checkbox" name="no_stock" checked={noStock} onChange={(e) => setNoStock(e.target.checked)} /> {profile.words.noStock}</label>
        {!noStock && (
          <div className="grid2">
            <label className="f"><span>Stok minimum <em className="hint">(peringatan jika di bawah ini)</em></span><input className="input money" name="min_stock" inputMode="decimal" defaultValue={product ? String(product.min_stock).replace(".", ",") : "0"} /></label>
            {!product && !f.batches && <label className="f"><span>Stok awal</span><input className="input money" name="initial_stock" inputMode="decimal" defaultValue="0" /></label>}
          </div>
        )}
        {!noStock && f.batches && !product && <p className="note">Stok obat dicatat per batch. Setelah produk dibuat, masukkan stok lewat menu <b>Pembelian</b> (no. batch dan tanggal kedaluwarsa).</p>}
        {noStock && <p className="note">Item ini tidak dihitung stoknya, selalu bisa dijual.</p>}
      </div>

      {f.options && (
        <div className="card form">
          <div className="spread"><h2>Ukuran &amp; tambahan</h2>
            <button type="button" className="btn soft sm" onClick={() => setOpts([...opts, { name: "", required: false, multi: false, choices: [{ name: "", price: 0 }] }])}><Icon name="plus" />Grup opsi</button>
          </div>
          {opts.length === 0 && <p className="muted small">Belum ada opsi. Tambahkan grup seperti “Ukuran” (wajib pilih satu) atau “Tambahan” (boleh lebih dari satu).</p>}
          {opts.map((g, gi) => {
            const set = (patch: Partial<OptionGroup>) => setOpts(opts.map((x, i) => (i === gi ? { ...x, ...patch } : x)));
            return (
              <div className="optgroup" key={gi}>
                <div className="row wrap">
                  <input className="input grow" style={{ minWidth: 140 }} placeholder="Nama grup, mis. Ukuran" value={g.name} maxLength={30} onChange={(e) => set({ name: e.target.value })} aria-label="Nama grup" />
                  <label className="check"><input type="checkbox" checked={g.required} onChange={(e) => set({ required: e.target.checked })} /> Wajib</label>
                  <label className="check"><input type="checkbox" checked={g.multi} onChange={(e) => set({ multi: e.target.checked })} /> Boleh &gt; 1</label>
                  <button type="button" className="iconbtn danger" aria-label="Hapus grup" onClick={() => setOpts(opts.filter((_, i) => i !== gi))}><Icon name="trash" /></button>
                </div>
                {g.choices.map((c, ci) => {
                  const setC = (patch: Partial<{ name: string; price: number }>) => set({ choices: g.choices.map((x, i) => (i === ci ? { ...x, ...patch } : x)) });
                  return (
                    <div className="optrow" key={ci}>
                      <input className="input" placeholder="Pilihan, mis. Large" value={c.name} maxLength={30} onChange={(e) => setC({ name: e.target.value })} aria-label="Nama pilihan" />
                      <input className="input money" placeholder="+ Rp" inputMode="numeric" value={c.price ? String(c.price) : ""} onChange={(e) => setC({ price: Number(e.target.value.replace(/\D/g, "")) || 0 })} aria-label="Harga tambahan" />
                      <button type="button" className="iconbtn" aria-label="Hapus pilihan" disabled={g.choices.length === 1} onClick={() => set({ choices: g.choices.filter((_, i) => i !== ci) })}><Icon name="x" /></button>
                    </div>
                  );
                })}
                <button type="button" className="btn ghost sm" style={{ justifySelf: "start" }} onClick={() => set({ choices: [...g.choices, { name: "", price: 0 }] })}><Icon name="plus" />Pilihan</button>
              </div>
            );
          })}
          <input type="hidden" name="options_json" value={JSON.stringify(opts)} />
        </div>
      )}

      {product && <label className="check card" style={{ padding: "6px 16px" }}><input type="checkbox" name="active" defaultChecked={product.active} /> Aktif (tampil di layar kasir)</label>}
    </ActionForm>
  );
}
