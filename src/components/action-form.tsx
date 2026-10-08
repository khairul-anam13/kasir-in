"use client";
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "@/lib/form";

/**
 * Form dengan server action: menampilkan pesan error/sukses dan status "menyimpan".
 * Action dipanggil manual (bukan lewat <form action>) karena React 19 mengosongkan isian setelah action selesai —
 * itu membuat pengguna kehilangan semua isian saat validasi gagal. Isian hanya dikosongkan jika clearOnOk.
 */
export function ActionForm({ action, children, submit = "Simpan", className = "form", variant, block, clearOnOk }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>; children?: ReactNode; submit?: string;
  className?: string; variant?: "soft" | "ghost" | "danger"; block?: boolean; clearOnOk?: boolean;
}) {
  const [s, fire, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.ok && clearOnOk) ref.current?.reset(); }, [s, clearOnOk]);
  return (
    <form ref={ref} className={className} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => fire(fd)); }}>
      {children}
      {s?.error && <p className="err" role="alert">{s.error}</p>}
      {s?.ok && <p className="ok" role="status">{s.ok}</p>}
      <button type="submit" className={`btn ${variant ?? ""} ${block ? "block" : ""}`} disabled={pending}>{pending ? "Menyimpan…" : submit}</button>
    </form>
  );
}
