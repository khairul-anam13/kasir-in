import { ActionForm } from "@/components/action-form";
import { Icon, PROFILE_ICON } from "@/components/icons";
import { Receipt, type ReceiptData } from "@/components/receipt";
import { ThemePicker } from "@/components/theme-picker";
import { LogoField } from "@/components/logo-field";
import { readLogo } from "@/lib/biz";
import { RECEIPT_ACTIONS, RECEIPT_TEMPLATES } from "@/lib/receipt";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { TZ_LABEL } from "@/lib/format";
import { changePasswordAction, resetAllAction, saveBusinessAction, saveReceiptAction, saveStockPolicyAction, saveTaxAction } from "./actions";

export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await requireUser();
  const { biz, profile } = await getBusiness();
  const pct = (n: number) => String(n).replace(".", ",");
  const logo = await readLogo();
  // Contoh nota untuk pratinjau desain. Sengaja memuat nama kasir & item yang panjang agar terlihat cara wrap/singkatnya.
  const sample: ReceiptData = {
    biz: { ...biz, logo }, orderFields: profile.orderFields.slice(0, 1),
    order: { id: 0, number: "INV-261001-0042", shift_id: null, cashier_name: "Muhammad Abdurrahman Wicaksono", status: "paid", subtotal: 81000, discount: 0, service: 0, tax: 0, total: 81000, cogs: 0, change: 19000,
      meta: { customer: "Bu Sari" }, note: "", void_reason: null, voided_at: null, created_at: new Date() },
    items: [
      { id: 1, product_id: null, name: "Produk contoh", variant_label: null, unit: "pcs", qty: 2, price: 18000, cost: 0, discount: 0, options: [], note: "", total: 36000 },
      { id: 2, product_id: null, name: "Produk dengan nama yang cukup panjang sekali", variant_label: "L / Hitam", unit: "pcs", qty: 1, price: 45000, cost: 0, discount: 0, options: [], note: "", total: 45000 },
    ],
    payments: [{ id: 1, method: "cash", amount: 81000, tendered: 100000 }],
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div><h1>Pengaturan</h1><p>Semua perubahan langsung berlaku di kasir dan struk.</p></div>
      </div>

      <div className="card row">
        <span className="type" style={{ "--h": profile.hue, padding: 0, border: 0, background: "none", cursor: "default" } as React.CSSProperties}><span className="ico"><Icon name={PROFILE_ICON[profile.id]} /></span></span>
        <div><b>{profile.name}</b><div className="muted small">{profile.tagline}. Jenis usaha dipilih saat setup; untuk mengganti, gunakan “Mulai dari awal” di bawah.</div></div>
      </div>

      <div className="card">
        <h2>Tema tampilan</h2>
        <p className="muted small" style={{ margin: "4px 0 12px" }}>Berlaku seketika untuk seluruh aplikasi di semua perangkat. Warna aksen tetap mengikuti jenis usaha.</p>
        <ThemePicker current={biz.uiTheme} />
      </div>

      <div className="card">
        <h2>Data usaha</h2>
        <ActionForm action={saveBusinessAction} submit="Simpan">
          <label className="f"><span>Nama usaha</span><input className="input" name="name" defaultValue={biz.name} required maxLength={60} /></label>
          <div className="grid2">
            <label className="f"><span>Alamat</span><input className="input" name="address" defaultValue={biz.address} maxLength={120} /></label>
            <label className="f"><span>No. telepon</span><input className="input" name="phone" defaultValue={biz.phone} maxLength={30} inputMode="tel" /></label>
          </div>
          <label className="f"><span>Zona waktu</span>
            <select className="input" name="timezone" defaultValue={biz.timezone}>{Object.entries(TZ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </ActionForm>
      </div>

      <div className="card">
        <h2>Pajak{profile.features.serviceCharge ? " & service charge" : ""}</h2>
        <ActionForm action={saveTaxAction} submit="Simpan">
          <div className="f"><span className="lbl">PPN</span>
            <div className="segmented" role="radiogroup" aria-label="PPN" style={{ justifySelf: "start" }}>
              {[["off", "Tanpa PPN"], ["exclusive", "Ditambahkan ke harga"], ["inclusive", "Sudah termasuk harga"]].map(([v, l]) => (
                <label key={v}><input type="radio" name="tax_mode" value={v} defaultChecked={biz.taxMode === v} /><span>{l}</span></label>
              ))}
            </div>
          </div>
          <div className="grid2">
            <label className="f"><span>Tarif PPN (%)</span><input className="input money" name="tax_rate" defaultValue={pct(biz.taxRate)} inputMode="decimal" /></label>
            {profile.features.serviceCharge
              ? <label className="f"><span>Service charge (%)</span><input className="input money" name="service_rate" defaultValue={pct(biz.serviceRate)} inputMode="decimal" /><span className="hint">Dihitung dari total sebelum PPN. Isi 0 jika tidak dipakai.</span></label>
              : <input type="hidden" name="service_rate" value="0" />}
          </div>
        </ActionForm>
      </div>

      <div className="card">
        <h2>Struk</h2>
        <ActionForm action={saveReceiptAction} submit="Simpan">
          <LogoField initial={logo} size={biz.logoSize} showName={biz.logoName} />
          <div className="f"><span className="lbl">Desain nota</span>
            <div className="tplgrid" role="radiogroup" aria-label="Desain nota">
              {RECEIPT_TEMPLATES.map((t) => (
                <label key={t.id} className="tplpick">
                  <input type="radio" name="receipt_template" value={t.id} defaultChecked={biz.receiptTemplate === t.id} />
                  <span className="shot" aria-hidden><Receipt template={t.id} data={sample} /></span>
                  <b>{t.name}</b><span className="muted small">{t.note}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="f"><span className="lbl">Tombol "Cetak struk" di kasir</span>
            <div className="stack">
              {RECEIPT_ACTIONS.map((a) => (
                <label key={a.id} className="check" style={{ flexDirection: "row", justifyContent: "flex-start" }}>
                  <input type="radio" name="receipt_action" value={a.id} defaultChecked={biz.receiptAction === a.id} style={{ width: 22, height: 22, accentColor: "var(--accent)" }} />
                  <span><b>{a.label}</b><span className="muted small"> — {a.note}</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className="f"><span className="lbl">Lebar kertas printer</span>
            <div className="segmented" role="radiogroup" aria-label="Lebar kertas" style={{ justifySelf: "start" }}>
              {[["58", "58 mm"], ["80", "80 mm"]].map(([v, l]) => <label key={v}><input type="radio" name="paper_width" value={v} defaultChecked={String(biz.paperWidth) === v} /><span>{l}</span></label>)}
            </div>
          </div>
          <label className="f"><span>Pesan di bawah struk</span><input className="input" name="receipt_footer" defaultValue={biz.receiptFooter} maxLength={160} /></label>
        </ActionForm>
        <p className="muted small" style={{ marginTop: 10 }}>Pratinjau memakai nama kasir dan item yang panjang untuk menunjukkan cara teks dipotong rapi. Struk dicetak lewat dialog cetak browser; pilih printer thermal dan matikan “Header dan footer”. Desain bisa dicoba per struk lewat tab di halaman struk.</p>
      </div>

      {!profile.features.batches && (
        <div className="card">
          <h2>Kebijakan stok</h2>
          <ActionForm action={saveStockPolicyAction} submit="Simpan">
            <label className="check"><input type="checkbox" name="allow_negative_stock" defaultChecked={biz.allowNegativeStock} /> Izinkan penjualan walau stok di sistem kosong (stok menjadi minus)</label>
            <p className="muted small">Berguna jika stok di sistem belum akurat. Sebaiknya dimatikan setelah stok opname.</p>
          </ActionForm>
        </div>
      )}

      <div className="card">
        <h2>Akun</h2>
        <ActionForm action={changePasswordAction} submit="Simpan akun">
          <p className="muted small">Username: <b>{user.username}</b></p>
          <label className="f"><span>Nama tampilan</span><input className="input" name="name" defaultValue={user.name} maxLength={40} /></label>
          <label className="f"><span>Password saat ini</span><input className="input" name="current" type="password" autoComplete="current-password" required /></label>
          <div className="grid2">
            <label className="f"><span>Password baru <em className="hint">(kosongkan jika tidak diganti)</em></span><input className="input" name="next" type="password" autoComplete="new-password" minLength={8} /></label>
            <label className="f"><span>Ulangi password baru</span><input className="input" name="confirm" type="password" autoComplete="new-password" /></label>
          </div>
        </ActionForm>
      </div>

      <details className="card" style={{ borderColor: "var(--bad)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 650, color: "var(--bad)" }}>Mulai dari awal</summary>
        <ActionForm action={resetAllAction} submit="Hapus semua data dan mulai dari awal" variant="danger">
          <p className="muted small" style={{ marginTop: 10 }}>Menghapus <b>semua</b> produk, transaksi, stok, dan akun, lalu kembali ke layar setup — berguna untuk mengganti jenis usaha atau serah-terima ke pelanggan baru. Tidak bisa diurungkan.</p>
          <label className="f"><span>Ketik <b>{biz.name}</b> untuk mengonfirmasi</span><input className="input" name="confirm" autoComplete="off" required /></label>
        </ActionForm>
      </details>
    </div>
  );
}
