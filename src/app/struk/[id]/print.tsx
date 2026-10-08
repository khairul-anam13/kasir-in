"use client";
import { useEffect } from "react";
import { Icon } from "@/components/icons";

export function PrintButton() {
  return <button type="button" className="btn" onClick={() => window.print()}><Icon name="print" />Cetak</button>;
}

/** Buka dialog cetak otomatis setelah halaman tampil (dibuka dari tombol "Cetak struk" di kasir). */
export function AutoPrint() {
  useEffect(() => { const t = setTimeout(() => window.print(), 350); return () => clearTimeout(t); }, []);
  return null;
}
