"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { readBusiness } from "@/lib/biz";
import { sql } from "@/lib/db";
import { attempt, UserError } from "@/lib/errors";
import { fail, flag, int, isUnique, num, optInt, str, type FormState } from "@/lib/form";
import { parseOptionGroups } from "@/lib/options";
import { moveStock } from "@/lib/stock";

const done = () => revalidatePath("/", "layout");

/** Simpan produk baru/ubahan. Produk baru boleh sekaligus membuat beberapa varian (fashion) dan stok awal. */
export async function saveProduct(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const { profile } = await readBusiness();
  const f = profile.features;
  const id = int(fd, "id"), name = str(fd, "name", 80), price = int(fd, "price", -1), cost = int(fd, "cost", 0);
  if (!name) return fail("Nama wajib diisi");
  if (price < 0 || price > 1_000_000_000) return fail("Harga jual tidak valid");
  if (cost < 0 || cost > 1_000_000_000) return fail("Harga beli tidak valid");
  const noStock = flag(fd, "no_stock");
  const min = noStock ? 0 : Math.max(0, num(fd, "min_stock", 0));
  const initial = !id && !noStock && !f.batches ? Math.max(0, num(fd, "initial_stock", 0)) : 0;
  const unit = str(fd, "unit", 20) || profile.units[0];
  const base = {
    category_id: optInt(fd, "category_id"), unit, price, cost, is_service: noStock, min_stock: min,
    requires_rx: f.rx && flag(fd, "requires_rx"), active: id ? flag(fd, "active") : true,
    sku: str(fd, "sku", 40) || null, barcode: f.barcode ? str(fd, "barcode", 40) || null : null,
  };
  let options;
  try { options = f.options ? parseOptionGroups(str(fd, "options_json", 20000)) : []; } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    throw e;
  }
  const labels = f.variants ? (id ? [str(fd, "variant_label", 40)] : str(fd, "variant_list", 600).split(/[,\n]/).map((s) => s.trim()).filter(Boolean)) : [""];
  if (!id && labels.length > 1 && base.barcode) return fail("Kosongkan barcode saat membuat banyak varian sekaligus; isi barcode per varian setelahnya");
  if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) return fail("Nama varian tidak boleh sama");

  try {
    await sql.begin(async (tx) => {
      for (const label of labels.length ? labels : [""]) {
        const v = label || null;
        if (id) {
          await tx`update products set name = ${name}, variant_label = ${v}, category_id = ${base.category_id}, unit = ${unit}, price = ${price}, cost = ${cost},
                   is_service = ${noStock}, min_stock = ${min}, options = ${tx.json(options)}, requires_rx = ${base.requires_rx}, active = ${base.active},
                   sku = ${base.sku}, barcode = ${base.barcode} where id = ${id}`;
        } else {
          const [p] = await tx`insert into products (category_id, name, variant_label, sku, barcode, unit, price, cost, is_service, min_stock, options, requires_rx)
            values (${base.category_id}, ${name}, ${v}, ${labels.length > 1 ? null : base.sku}, ${base.barcode}, ${unit}, ${price}, ${cost}, ${noStock}, ${min}, ${tx.json(options)}, ${base.requires_rx})
            returning id`;
          if (initial > 0) await moveStock(tx, { productId: p.id, delta: initial, type: "adjust", note: "Stok awal" });
        }
      }
    });
  } catch (e) {
    if (isUnique(e)) return fail("SKU atau barcode sudah dipakai produk lain");
    throw e;
  }
  done();
  if (!id) redirect("/produk");
  return { ok: "Tersimpan" };
}

export async function deleteProduct(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = int(fd, "id");
  const e = await attempt(async () => {
    const [u] = await sql`select (select count(*) from order_items where product_id = ${id})::int sold`;
    if (u.sold > 0) throw new UserError("Produk ini sudah pernah terjual. Nonaktifkan saja agar riwayat tetap utuh.");
    await sql`delete from products where id = ${id}`;
  });
  if (e) return fail(e);
  done();
  redirect("/produk");
}

/** Salin produk (beserta opsi) sebagai dasar produk serupa. Stok, SKU, dan barcode tidak ikut disalin. */
export async function duplicateProduct(fd: FormData) {
  await requireUser();
  const [p] = await sql`
    insert into products (category_id, name, variant_label, unit, price, cost, is_service, min_stock, options, requires_rx)
    select category_id, name || ' (salinan)', variant_label, unit, price, cost, is_service, min_stock, options, requires_rx from products where id = ${int(fd, "id")}
    returning id`;
  done();
  redirect(p ? `/produk/${p.id}` : "/produk");
}

/* ---------- Kategori ---------- */
export async function saveCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = int(fd, "id"), name = str(fd, "name", 40);
  if (!name) return fail("Nama kategori wajib diisi");
  try {
    if (id) await sql`update categories set name = ${name}, sort = ${int(fd, "sort")} where id = ${id}`;
    else await sql`insert into categories (name, sort) values (${name}, ${int(fd, "sort", 99)})`;
  } catch (e) {
    if (isUnique(e)) return fail("Nama kategori sudah ada");
    throw e;
  }
  done();
  return { ok: "Tersimpan" };
}

export async function deleteCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  await sql`delete from categories where id = ${int(fd, "id")}`; // produk di dalamnya menjadi tanpa kategori
  done();
  return { ok: "Dihapus" };
}
