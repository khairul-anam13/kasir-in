"use client";
import { useEffect, useRef, useState } from "react";
import { LOGO_MAX_PX, LOGO_SIZES, type LogoSize } from "@/lib/receipt";
import { Icon } from "./icons";

type Mode = "bw" | "gray";
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Logo untuk nota. Gambar diolah di browser (dikecilkan, latar transparan jadi putih, diubah ke hitam-putih/abu-abu)
 * karena printer thermal hanya mencetak hitam-putih; hasilnya PNG kecil yang dikirim lewat input tersembunyi
 * `receipt_logo`, bersama `logo_size` dan `logo_name`, dan disimpan oleh tombol Simpan formulir Struk.
 */
export function LogoField({ initial, size: initialSize, showName }: { initial: string | null; size: LogoSize; showName: boolean }) {
  const [out, setOut] = useState(initial ?? "");
  const [mode, setMode] = useState<Mode>("bw");
  const [threshold, setThreshold] = useState(150);
  const [size, setSize] = useState<LogoSize>(initialSize);
  const [name, setName] = useState(showName);
  const [err, setErr] = useState("");
  const img = useRef<HTMLImageElement | null>(null);

  const render = (m: Mode, t: number) => {
    const im = img.current;
    if (!im) return;
    for (const maxW of [LOGO_MAX_PX, 256, 160]) {
      const sc = Math.min(1, maxW / im.naturalWidth, 240 / im.naturalHeight);
      const w = Math.max(8, Math.round(im.naturalWidth * sc)), h = Math.max(8, Math.round(im.naturalHeight * sc));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      if (!g) return setErr("Browser tidak mendukung pengolahan gambar");
      g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);   // latar transparan → putih (printer tidak punya "transparan")
      g.drawImage(im, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h), px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const v = m === "bw" ? (l < t ? 0 : 255) : l;
        px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      const url = c.toDataURL("image/png");
      if (url.length <= 190_000) { setOut(url); setErr(""); return; }
    }
    setErr("Gambar terlalu rumit. Pakai logo yang lebih sederhana atau mode hitam-putih.");
  };

  useEffect(() => { if (img.current) render(mode, threshold); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode, threshold]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(f.type)) return setErr("Pilih berkas gambar PNG, JPG, WEBP, GIF, atau SVG");
    if (f.size > MAX_BYTES) return setErr("Berkas terlalu besar (maksimal 6 MB)");
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      if (!im.naturalWidth || !im.naturalHeight) return setErr("Gambar tidak bisa dibaca");
      img.current = im; render(mode, threshold);
    };
    im.onerror = () => { URL.revokeObjectURL(url); setErr("Gambar tidak bisa dibaca"); };
    im.src = url;
  };

  const pct = LOGO_SIZES.find((s) => s.id === size)!.pct;
  return (
    <div className="f"><span className="lbl">Logo usaha <em className="hint">(opsional)</em></span>
      <div className="logofield">
        <div className="logoprev" aria-label="Pratinjau logo pada kertas">
          {out
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={out} alt="Logo usaha" style={{ width: `${pct}%` }} />
            : <span className="muted small">Belum ada logo</span>}
        </div>
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="row wrap">
            <label className="btn soft sm" style={{ cursor: "pointer" }}>
              <Icon name="plus" />{out ? "Ganti logo" : "Pilih logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="sr" aria-label="Pilih berkas logo" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {out && <button type="button" className="btn ghost sm" onClick={() => { setOut(""); img.current = null; setErr(""); }}><Icon name="trash" />Hapus</button>}
          </div>
          {out && (
            <>
              <div className="f"><span className="lbl">Ukuran di kertas</span>
                <div className="segmented" role="radiogroup" aria-label="Ukuran logo" style={{ justifySelf: "start" }}>
                  {LOGO_SIZES.map((s) => <label key={s.id}><input type="radio" checked={size === s.id} onChange={() => setSize(s.id)} /><span>{s.label}</span></label>)}
                </div>
              </div>
              {img.current && (
                <>
                  <div className="f"><span className="lbl">Warna</span>
                    <div className="segmented" role="radiogroup" aria-label="Mode warna" style={{ justifySelf: "start" }}>
                      <label><input type="radio" checked={mode === "bw"} onChange={() => setMode("bw")} /><span>Hitam-putih</span></label>
                      <label><input type="radio" checked={mode === "gray"} onChange={() => setMode("gray")} /><span>Abu-abu</span></label>
                    </div>
                  </div>
                  {mode === "bw" && (
                    <label className="f"><span>Ketebalan <em className="hint">(geser jika logo terlalu tipis/tebal)</em></span>
                      <input type="range" min={60} max={230} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Ketebalan hitam" />
                    </label>
                  )}
                </>
              )}
              <label className="check"><input type="checkbox" checked={name} onChange={(e) => setName(e.target.checked)} /> Tampilkan nama usaha di bawah logo</label>
            </>
          )}
          {err && <p className="err" role="alert">{err}</p>}
          <p className="muted small">Logo sederhana berlatar putih/transparan paling jelas di printer thermal. Hasil olahan tampil di pratinjau kiri.</p>
        </div>
      </div>
      <input type="hidden" name="receipt_logo" value={out} />
      <input type="hidden" name="logo_size" value={size} />
      {name && <input type="hidden" name="logo_name" value="on" />}
    </div>
  );
}
