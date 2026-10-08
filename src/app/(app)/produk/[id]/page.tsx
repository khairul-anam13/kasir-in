import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ProductForm, type ProductInput } from "@/components/product-form";
import { requireUser } from "@/lib/auth";
import { getBusiness, today } from "@/lib/biz";
import { sql } from "@/lib/db";
import { fmtQty } from "@/lib/format";
import { deleteProduct } from "../actions";

export const metadata = { title: "Ubah produk" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { biz, profile } = await getBusiness();
  const [p] = await sql<(ProductInput & { stock: number })[]>`select id, name, variant_label, category_id, unit, price, cost, sku, barcode, is_service, min_stock, options, requires_rx, active, stock from products where id = ${id}`;
  if (!p) notFound();
  const categories = await sql<{ id: number; name: string }[]>`select id, name from categories order by sort, name`;
  const batches = profile.features.batches
    ? await sql<{ id: number; batch_no: string; expiry: string | null; qty: number; cost: number }[]>`select id, batch_no, to_char(expiry, 'YYYY-MM-DD') expiry, qty, cost from stock_batches where product_id = ${id} order by expiry nulls last, id`
    : [];
  const day = today(biz.timezone);

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-head">
        <div><Link href="/produk" className="small">← {profile.words.items}</Link><h1>{p.name}{p.variant_label ? ` · ${p.variant_label}` : ""}</h1>
          {!p.is_service && <p>Stok saat ini: <b className="num">{fmtQty(p.stock)} {p.unit}</b> · <Link href={`/stok/mutasi?p=${p.id}`}>lihat riwayat stok</Link></p>}</div>
      </div>
      <ProductForm product={p} categories={categories} profile={profile} />

      {batches.length > 0 && (
        <div className="card flush">
          <div className="spread" style={{ padding: "14px 18px 0" }}><h2>Batch</h2><span className="muted small">Tambah batch lewat Pembelian; koreksi lewat Stok opname.</span></div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>No. batch</th><th>Kedaluwarsa</th><th className="num">Sisa</th></tr></thead>
            <tbody>{batches.map((b) => (
              <tr key={b.id}><td>{b.batch_no}</td>
                <td>{b.expiry ? <span className={`badge ${b.expiry < day ? "bad" : ""}`}>{b.expiry}{b.expiry < day ? " · lewat" : ""}</span> : "—"}</td>
                <td className="num">{fmtQty(b.qty)} {p.unit}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 650 }}>Hapus {profile.words.item.toLowerCase()} ini</summary>
        <ActionForm action={deleteProduct} submit="Hapus permanen" variant="danger">
          <p className="muted small" style={{ marginTop: 10 }}>Hanya bisa jika belum pernah terjual. Jika sudah, nonaktifkan lewat kotak “Aktif” di atas.</p>
          <input type="hidden" name="id" value={p.id} />
        </ActionForm>
      </details>
    </div>
  );
}
