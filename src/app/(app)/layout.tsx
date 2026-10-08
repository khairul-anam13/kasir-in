import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { getBusiness } from "@/lib/biz";
import { currentShift } from "@/lib/shifts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const { profile } = await getBusiness();
  const shift = await currentShift();
  const items = [
    { href: "/kasir", label: "Kasir", icon: "kasir" },
    { href: "/transaksi", label: "Transaksi", icon: "receipt" },
    { href: "/produk", label: profile.words.items, icon: "box" },
    { href: "/laporan", label: "Laporan", icon: "chart" },
  ] as const;
  const more = [
    { href: "/stok", label: "Stok", icon: "stock" },
    { href: "/pembelian", label: "Pembelian", icon: "truck" },
    { href: "/shift", label: "Shift", icon: "clock" },
    { href: "/pengaturan", label: "Pengaturan", icon: "sliders" },
  ] as const;
  // Rel desktop menampilkan semua item dalam urutan kerja: kasir → transaksi → barang → stok → pembelian → laporan → shift → pengaturan.
  const order = ["/kasir", "/transaksi", "/produk", "/stok", "/pembelian", "/laporan", "/shift", "/pengaturan"];
  const sorted = [...items, ...more].sort((a, b) => order.indexOf(a.href) - order.indexOf(b.href));
  return (
    <div className="shell">
      <Nav items={[...items]} itemsMore={[...more]} sorted={sorted} shiftOpen={!!shift} />
      <main className="content">{children}</main>
    </div>
  );
}
