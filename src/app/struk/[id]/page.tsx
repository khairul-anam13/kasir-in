import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { Receipt } from "@/components/receipt";
import { requireUser } from "@/lib/auth";
import { getBusiness, readLogo } from "@/lib/biz";
import { getOrder } from "@/lib/orders";
import { RECEIPT_TEMPLATES, isTemplate } from "@/lib/receipt";
import { AutoPrint, PrintButton } from "./print";

export const metadata = { title: "Struk" };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string; t?: string; embed?: string }> }) {
  await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await getOrder(Number(id));
  if (!data) notFound();
  const { biz, profile } = await getBusiness();
  const tpl = isTemplate(sp.t) ? sp.t : biz.receiptTemplate; // ?t= hanya untuk mencoba desain lain pada struk ini
  const base = `/struk/${data.order.id}`;
  const embed = sp.embed === "1"; // dipakai iframe di kasir: hanya struk, tanpa tombol

  return (
    <div className={`receipt-screen ${embed ? "embed" : ""}`}>
      <style>{`@page { size: ${biz.paperWidth}mm auto; margin: 2mm; }${embed ? " body { background: transparent !important; }" : ""}`}</style>
      {!embed && <div className="receipt-actions no-print">
        <Link href="/kasir" className="btn ghost">Kembali ke kasir</Link>
        <Link href={`/transaksi/${data.order.id}`} className="btn ghost">Detail transaksi</Link>
        <PrintButton />
      </div>}
      {sp.print !== "1" && !embed && (
        <nav className="tabs no-print" aria-label="Desain nota">
          {RECEIPT_TEMPLATES.map((t) => <Link key={t.id} href={`${base}?t=${t.id}`} replace aria-current={t.id === tpl ? "page" : undefined}>{t.name}</Link>)}
        </nav>
      )}
      <Receipt template={tpl} data={{ biz: { ...biz, logo: await readLogo() }, orderFields: profile.orderFields, ...data }} />
      {sp.print === "1" && <AutoPrint />}
      {sp.print !== "1" && !embed && <p className="muted small no-print"><Icon name="info" size={14} /> Desain bawaan dan lebar kertas (58/80 mm) diatur di Pengaturan.</p>}
    </div>
  );
}
