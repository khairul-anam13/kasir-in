import Link from "next/link";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { getBusiness, today } from "@/lib/biz";
import { sql } from "@/lib/db";
import { fmtQty, rupiah } from "@/lib/format";
import { duplicateProduct } from "./actions";

export const metadata = { title: "Produk" };

type Row = {
  id: number; name: string; variant_label: string | null; category: string | null; unit: string; price: number; cost: number; is_service: boolean;
  stock: number; min_stock: number; active: boolean; requires_rx: boolean; barcode: string | null; expiry: string | null; options: unknown[];
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; show?: string }> }) {
  await requireUser();
  const { biz, profile } = await getBusiness();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const cat = Number(sp.cat) || 0;
  const show = ["all", "off", "low"].includes(sp.show ?? "") ? sp.show! : "on";
  const like = "%" + q.replace(/[%_\\]/g, "\\$&") + "%";
  const day = today(biz.timezone);

  const rows = await sql<Row[]>`
    select p.id, p.name, p.variant_label, c.name category, p.unit, p.price, p.cost, p.is_service, p.stock, p.min_stock, p.active, p.requires_rx, p.barcode, p.options,
           (select to_char(min(b.expiry), 'YYYY-MM-DD') from stock_batches b where b.product_id = p.id and b.qty > 0) expiry
    from products p left join categories c on c.id = p.category_id
    where true
      ${q ? sql`and (p.name ilike ${like} or p.variant_label ilike ${like} or p.sku ilike ${like} or p.barcode = ${q})` : sql``}
      ${cat ? sql`and p.category_id = ${cat}` : sql``}
      ${show === "on" ? sql`and p.active` : show === "off" ? sql`and not p.active` : show === "low" ? sql`and p.active and not p.is_service and p.stock <= p.min_stock and (p.min_stock > 0 or p.stock <= 0)` : sql``}
    order by c.sort nulls last, c.name, p.name, p.id limit 500`;
  const categories = await sql<{ id: number; name: string }[]>`select id, name from categories order by sort, name`;
  const f = profile.features;
  const word = profile.words.items.toLowerCase();

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{profile.words.items}</h1><p>{rows.length} item{rows.length >= 500 ? " (500 pertama)" : ""}</p></div>
        <div className="row wrap">
          <Link href="/produk/kategori" className="btn ghost">Kategori</Link>
          <Link href="/produk/baru" className="btn"><Icon name="plus" />Tambah</Link>
        </div>
      </div>
      <form className="toolbar" method="get">
        <input className="input search" type="search" name="q" defaultValue={q} placeholder={`Cari nama, SKU${f.barcode ? ", atau barcode" : ""}…`} aria-label="Cari" />
        <select className="input" name="cat" defaultValue={cat || ""} aria-label="Kategori" style={{ width: 190 }}>
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" name="show" defaultValue={show} aria-label="Tampilkan" style={{ width: 170 }}>
          <option value="on">Yang aktif</option><option value="low">Stok menipis</option><option value="off">Nonaktif</option><option value="all">Semua</option>
        </select>
        <button className="btn soft" type="submit">Terapkan</button>
      </form>

      <div className="card flush">
        {rows.length === 0 ? (
          <div className="empty"><Icon name="box" /><strong>{q || cat || show !== "on" ? "Tidak ada yang cocok" : `Belum ada ${word}`}</strong>
            <span>{q || cat || show !== "on" ? "Ubah pencarian atau filter." : `Tambahkan ${word} pertama Anda untuk mulai berjualan.`}</span>
            {!q && !cat && show === "on" && <Link href="/produk/baru" className="btn">Tambah {word}</Link>}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Nama</th><th>Kategori</th><th className="num">Harga jual</th><th className="num">Harga beli</th><th className="num">Stok</th>{f.batches && <th>Kedaluwarsa terdekat</th>}<th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const out = !r.is_service && r.stock <= 0, low = !out && !r.is_service && r.min_stock > 0 && r.stock <= r.min_stock;
                  const margin = r.price > 0 && r.cost > 0 ? Math.round(((r.price - r.cost) / r.price) * 100) : null;
                  return (
                    <tr key={r.id} style={r.active ? undefined : { opacity: 0.55 }}>
                      <td>
                        <Link href={`/produk/${r.id}`}><b>{r.name}</b></Link>{r.variant_label && <span className="muted"> · {r.variant_label}</span>}
                        <div className="row wrap" style={{ gap: 6, marginTop: 2 }}>
                          {!r.active && <span className="badge">Nonaktif</span>}
                          {r.requires_rx && <span className="badge warn">Resep</span>}
                          {r.is_service && <span className="badge">Tanpa stok</span>}
                          {r.options.length > 0 && <span className="badge accent">{r.options.length} grup opsi</span>}
                          {r.barcode && <span className="faint small num">{r.barcode}</span>}
                        </div>
                      </td>
                      <td className="muted">{r.category ?? "—"}</td>
                      <td className="num"><b>{rupiah(r.price)}</b></td>
                      <td className="num muted">{rupiah(r.cost)}{margin !== null && <div className="small faint">margin {margin}%</div>}</td>
                      <td className="num">{r.is_service ? <span className="faint">—</span> : <span className={`badge ${out ? "bad" : low ? "warn" : ""}`}>{fmtQty(r.stock)} {r.unit}</span>}</td>
                      {f.batches && <td>{r.expiry ? <span className={`badge ${r.expiry < day ? "bad" : r.expiry <= addDays(day, 90) ? "warn" : ""}`}>{r.expiry}</span> : <span className="faint">—</span>}</td>}
                      <td className="nowrap">
                        <Link href={`/produk/${r.id}`} className="iconbtn" aria-label={`Ubah ${r.name}`}><Icon name="edit" /></Link>
                        <form action={duplicateProduct} style={{ display: "inline" }}><input type="hidden" name="id" value={r.id} /><button className="iconbtn" aria-label={`Duplikat ${r.name}`} title="Duplikat"><Icon name="copy" /></button></form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400_000).toISOString().slice(0, 10);
