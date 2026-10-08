"use client";
import { startTransition, useActionState, useRef, useState } from "react";
import { Icon, PROFILE_ICON } from "@/components/icons";
import { PROFILE_LIST, type ProfileId } from "@/lib/profiles";
import { TZ_LABEL } from "@/lib/format";
import { completeSetup } from "./actions";

const STEPS = ["Jenis usaha", "Data usaha", "Akun admin"];

export function Wizard() {
  const [state, fire, pending] = useActionState(completeSetup, undefined);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ProfileId | "">("");
  const [tax, setTax] = useState("off");
  const box = useRef<HTMLDivElement>(null);

  const pick = (id: ProfileId, hue: number) => {
    setType(id);
    document.documentElement.style.setProperty("--hue", String(hue)); // pratinjau warna aplikasi
  };
  const next = () => {
    const sec = box.current?.querySelectorAll<HTMLElement>(`[data-step="${step}"] input, [data-step="${step}"] select`);
    for (const el of sec ?? []) if (!(el as HTMLInputElement).reportValidity()) return;
    setStep((s) => s + 1);
  };

  return (
    <form className="stack-lg" ref={box as never}
      onSubmit={(e) => { e.preventDefault(); if (step < 2) return next(); const fd = new FormData(e.currentTarget); startTransition(() => fire(fd)); }}>
      <div className="stack">
        <div className="steps" aria-hidden>{STEPS.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
        <div>
          <h1>{step === 0 ? "Usaha Anda bergerak di bidang apa?" : step === 1 ? "Ceritakan sedikit tentang usaha Anda" : "Buat akun admin"}</h1>
          <p className="muted">
            {step === 0 ? "Pilihan ini menyesuaikan istilah, isian transaksi, dan fitur. Data contoh bisa dihapus kapan saja."
              : step === 1 ? "Nama dan alamat akan tampil di struk. Semuanya bisa diubah nanti di Pengaturan."
              : "Akun ini dipakai untuk masuk ke kasir dan laporan."}
          </p>
        </div>
      </div>

      <div data-step="0" hidden={step !== 0} className="stack">
        <div className="types" role="radiogroup" aria-label="Jenis usaha">
          {PROFILE_LIST.map((p) => (
            <label key={p.id} className="type" style={{ "--h": p.hue } as React.CSSProperties}>
              <input type="radio" name="type" value={p.id} required checked={type === p.id} onChange={() => pick(p.id, p.hue)} />
              <span className="ico"><Icon name={PROFILE_ICON[p.id]} /></span>
              <b>{p.name}</b>
              <span className="muted small">{p.tagline}</span>
              <span className="faint small">{p.examples}</span>
            </label>
          ))}
        </div>
      </div>

      <div data-step="1" hidden={step !== 1} className="card form">
        <label className="f"><span>Nama usaha</span><input className="input" name="name" maxLength={60} required autoComplete="organization" /></label>
        <div className="grid2">
          <label className="f"><span>Alamat <em className="hint">(opsional)</em></span><input className="input" name="address" maxLength={120} /></label>
          <label className="f"><span>No. telepon <em className="hint">(opsional)</em></span><input className="input" name="phone" maxLength={30} inputMode="tel" /></label>
        </div>
        <label className="f"><span>Zona waktu</span>
          <select className="input" name="timezone" defaultValue="Asia/Jakarta">
            {Object.entries(TZ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div className="f"><span className="lbl">Pajak (PPN)</span>
          <div className="row wrap">
            <div className="segmented" role="radiogroup" aria-label="Pajak">
              {[["off", "Tanpa PPN"], ["exclusive", "PPN ditambahkan"], ["inclusive", "Harga sudah termasuk PPN"]].map(([v, l]) => (
                <label key={v}><input type="radio" name="tax_mode" value={v} checked={tax === v} onChange={() => setTax(v)} /><span>{l}</span></label>
              ))}
            </div>
            {tax !== "off" && (
              <label className="row small"><span className="muted">Tarif</span>
                <input className="input money" style={{ width: 88 }} name="tax_rate" defaultValue="11" inputMode="decimal" aria-label="Tarif PPN (persen)" /> %
              </label>
            )}
          </div>
        </div>
      </div>

      <div data-step="2" hidden={step !== 2} className="card form">
        <div className="grid2">
          <label className="f"><span>Nama Anda</span><input className="input" name="admin_name" maxLength={40} autoComplete="name" placeholder="Admin" /></label>
          <label className="f"><span>Username</span><input className="input" name="username" maxLength={30} autoCapitalize="none" autoComplete="username" required pattern="[A-Za-z0-9_.\-]{3,30}" title="3–30 karakter: huruf, angka, titik, strip, garis bawah" /></label>
        </div>
        <div className="grid2">
          <label className="f"><span>Password</span><input className="input" name="password" type="password" minLength={8} autoComplete="new-password" required /><span className="hint">Minimal 8 karakter</span></label>
          <label className="f"><span>Ulangi password</span><input className="input" name="confirm" type="password" minLength={8} autoComplete="new-password" required /></label>
        </div>
        <label className="check"><input type="checkbox" name="demo" defaultChecked /> Isi dengan data contoh (produk dan riwayat penjualan 10 hari) agar bisa langsung dicoba</label>
      </div>

      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <div className="row">
        {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Kembali</button>}
        {step < 2
          ? <button type="button" className="btn end" onClick={next}>Lanjut</button>
          : <button type="submit" className="btn end" disabled={pending}>{pending ? "Menyiapkan…" : "Mulai pakai Kasir-in"}</button>}
      </div>
    </form>
  );
}
