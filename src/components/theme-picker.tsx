"use client";
import { useState, useTransition } from "react";
import { saveThemeAction } from "@/app/(app)/pengaturan/actions";
import { UI_THEMES, type UiTheme } from "@/lib/receipt";

/** Pemilih tema: berlaku seketika (atribut di <html>) lalu disimpan ke database. */
export function ThemePicker({ current }: { current: UiTheme }) {
  const [v, setV] = useState(current);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const pick = (t: UiTheme) => {
    setV(t); setMsg("");
    document.documentElement.dataset.theme = t;
    start(async () => {
      const r = await saveThemeAction(t);
      if (!r.ok) { document.documentElement.dataset.theme = current; setV(current); }
      setMsg(r.ok ? "Tema diterapkan" : "Gagal menyimpan tema");
    });
  };
  return (
    <div className="stack">
      <div className="themegrid" role="radiogroup" aria-label="Tema tampilan">
        {UI_THEMES.map((t) => (
          <label key={t.id} className="themepick">
            <input type="radio" name="ui_theme" value={t.id} checked={v === t.id} onChange={() => pick(t.id)} />
            <span className={`mk mk-${t.id}`} aria-hidden>
              <i className="k-rail" /><i className="k-dot on" style={{ top: 14 }} /><i className="k-dot" style={{ top: 34 }} /><i className="k-dot" style={{ top: 54 }} />
              <i className="k-ttl" />
              <i className="k-card" style={{ left: t.id === "ios" ? 42 : 36, top: 32, width: 72, height: 46 }} />
              <i className="k-card" style={{ left: t.id === "ios" ? 118 : 112, top: 32, width: 72, height: 46 }} />
              <i className="k-bar" style={{ left: t.id === "ios" ? 52 : 46, top: 44, width: 40 }} />
              <i className="k-bar" style={{ left: t.id === "ios" ? 52 : 46, top: 54, width: 28 }} />
              <i className="k-bar" style={{ left: t.id === "ios" ? 128 : 122, top: 44, width: 44 }} />
              <i className="k-bar" style={{ left: t.id === "ios" ? 128 : 122, top: 54, width: 30 }} />
              <i className="k-btn" />
              {t.id === "ios" && <i className="k-sw" />}
            </span>
            <b>{t.name}</b><span className="muted small">{t.note}</span>
          </label>
        ))}
      </div>
      {msg && <p className="ok" role="status">{msg}</p>}
    </div>
  );
}
