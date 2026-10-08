import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { Pos, type PosProduct } from "@/components/pos";
import { requireUser } from "@/lib/auth";
import { getBusiness, today } from "@/lib/biz";
import { sql } from "@/lib/db";
import { currentShift } from "@/lib/shifts";
import { openShiftAction } from "./actions";

export const metadata = { title: "Kasir" };

export default async function KasirPage() {
  const user = await requireUser();
  const { biz, profile, rates } = await getBusiness();
  const shift = await currentShift();

  if (!shift) {
    return (
      <div className="center">
        <div className="auth">
          <div className="empty" style={{ padding: 0 }}><Icon name="clock" /></div>
          <div style={{ textAlign: "center" }}>
            <h1>Buka shift untuk mulai berjualan</h1>
            <p className="muted">Hitung uang tunai di laci kasir, lalu isi sebagai modal awal.</p>
          </div>
          <div className="card">
            <ActionForm action={openShiftAction} submit="Buka shift" block>
              <p className="muted small">Kasir: <b>{user.name}</b></p>
              <label className="f"><span>Modal awal (Rp)</span>
                <input className="input money" name="opening" inputMode="numeric" defaultValue="0" autoFocus />
              </label>
            </ActionForm>
          </div>
        </div>
      </div>
    );
  }

  const day = today(biz.timezone);
  const rows = await sql`
    select p.id, p.name, p.variant_label, p.unit, p.price, p.is_service, p.stock, p.min_stock, p.barcode, p.sku, p.options, p.requires_rx, p.category_id,
           (select coalesce(sum(b.qty), 0) from stock_batches b where b.product_id = p.id and (b.expiry is null or b.expiry >= ${day}::date)) sellable
    from products p where p.active order by p.name, p.id`;
  const products: PosProduct[] = rows.map((r) => ({
    id: r.id, name: r.name, variant: r.variant_label, unit: r.unit, price: r.price, service: r.is_service,
    avail: r.is_service ? null : profile.features.batches ? r.sellable : r.stock,
    min: r.min_stock, barcode: r.barcode, sku: r.sku, options: r.options, rx: r.requires_rx, cat: r.category_id,
  }));
  const categories = await sql<{ id: number; name: string }[]>`select id, name from categories order by sort, name`;

  return (
    <Pos products={products} categories={categories} words={profile.words} hasBarcode={profile.features.barcode}
      orderFields={profile.orderFields} rates={rates} receiptAction={biz.receiptAction} allowNegative={biz.allowNegativeStock && !profile.features.batches} />
  );
}
