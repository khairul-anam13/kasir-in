import Link from "next/link";
import { PurchaseForm } from "@/components/purchase-form";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";

export const metadata = { title: "Catat pembelian" };

export default async function NewPurchasePage() {
  await requireUser();
  const { profile } = await getBusiness();
  const products = await sql<{ id: number; name: string; variant: string | null; unit: string; cost: number; sku: string | null }[]>`
    select id, name, variant_label variant, unit, cost, sku from products where active and not is_service order by name, variant_label`;
  const suppliers = await sql<{ id: number; name: string }[]>`select id, name from suppliers where active order by name`;
  return (
    <div className="page">
      <div className="page-head"><div><Link href="/pembelian" className="small">← Pembelian</Link><h1>Catat pembelian</h1>
        <p>{profile.features.batches ? "Setiap barang butuh no. batch dan tanggal kedaluwarsa." : "Stok dan harga beli barang akan diperbarui setelah disimpan."}</p></div></div>
      {products.length === 0
        ? <div className="card empty"><strong>Belum ada barang bersatuan stok</strong><span>Tambahkan {profile.words.item.toLowerCase()} terlebih dahulu.</span><Link className="btn" href="/produk/baru">Tambah</Link></div>
        : <PurchaseForm products={products} suppliers={suppliers} batches={profile.features.batches} />}
    </div>
  );
}
