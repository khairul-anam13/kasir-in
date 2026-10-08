import Link from "next/link";
import { ProductForm } from "@/components/product-form";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";

export const metadata = { title: "Tambah produk" };

export default async function NewProductPage() {
  await requireUser();
  const { profile } = await getBusiness();
  const categories = await sql<{ id: number; name: string }[]>`select id, name from categories order by sort, name`;
  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-head"><div><Link href="/produk" className="small">← {profile.words.items}</Link><h1>Tambah {profile.words.item.toLowerCase()}</h1></div></div>
      <ProductForm categories={categories} profile={profile} />
    </div>
  );
}
