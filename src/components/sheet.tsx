"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

/** Lembar modal: bawah layar di HP, tengah di tablet/desktop. Esc / klik latar menutup; fokus kembali ke pemicu. */
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("input:not([type=radio]):not([type=checkbox]), select, textarea");
    (first ?? ref.current)?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = overflow; prev?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1} style={wide ? { maxWidth: 760 } : undefined}>
        <header>
          <h2 id={id}>{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Tutup"><Icon name="x" /></button>
        </header>
        {children}
      </div>
    </div>
  );
}
