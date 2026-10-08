# Kasir-in

Sistem kasir (POS), stok, dan laporan berbasis web untuk berbagai jenis usaha. Satu kode, satu instalasi per usaha:
saat pertama kali dibuka, pemilik memilih **jenis usaha** dan aplikasi menyesuaikan istilah, isian transaksi, dan fitur.

| Jenis usaha | Yang khas |
|---|---|
| **Toko Retail** | barcode, satuan (pcs/kg/dus), jumlah pecahan (2,5 kg), stok minimum |
| **Kafe / Restoran** | ukuran & tambahan per menu, tipe pesanan, no. meja, service charge, pesanan ditahan |
| **Apotek / Toko Obat** | stok per batch + tanggal kedaluwarsa (FEFO), obat keras (peringatan resep), nama dokter & no. resep |
| **Jasa & Servis** | layanan tanpa stok + suku cadang bersetok, petugas, plat/no. referensi |
| **Toko Fashion** | varian ukuran/warna dengan stok & barcode per varian |

Semua jenis berbagi fitur inti: kasir touch-first (tablet/HP), scan barcode USB, diskon item & transaksi, PPN (tambahan
atau sudah termasuk), pembayaran gabungan (tunai/QRIS/transfer/kartu), 2 tema tampilan (Default dan iOS, dipilih di Pengaturan), struk thermal 58/80 mm dengan logo usaha di nota (diolah otomatis jadi hitam-putih untuk printer thermal), 3 desain nota (Klasik, Ringkas, Modern; pilih di Pengaturan, bisa dicoba per struk lewat tab di halaman struk), void transaksi, shift &
kas harian, supplier & pembelian, stok opname, riwayat mutasi stok, dashboard & laporan, ekspor CSV (Excel).

## Menjalankan di komputer sendiri

Butuh Node.js 22.18+ (disarankan 24 LTS) dan PostgreSQL 15+.

```bash
npm install
cp .env.example .env.local        # isi DATABASE_URL
npm run db -- schema              # buat tabel (aman dijalankan berulang)
npm run dev                       # http://localhost:3100
```

Buka `http://localhost:3100` → layar **Setup awal**: pilih jenis usaha, isi data usaha, buat akun admin. Centang
"data contoh" untuk mengisi produk + riwayat penjualan 10 hari agar bisa langsung dicoba.

> Windows dengan `~/.npmrc` berisi `os=linux`: pakai `npm install --os=win32 --cpu=x64`.
> Membuka server pengembangan dari tablet lewat IP LAN? Tambahkan IP itu ke `allowedDevOrigins` di `next.config.ts`. Server produksi (`npm start`) tidak butuh ini.

Membuat database lokal (contoh):

```sql
create role kasir login password 'kasir_dev_local';
create database kasir_in owner kasir;
```

### Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | server pengembangan / build produksi / jalankan produksi (port 3100) |
| `npm run db -- schema` | terapkan skema (idempoten) |
| `npm run db -- status` | ringkasan: nama usaha, jenis, jumlah produk |
| `npm run db -- reset --yes` | **hapus semua data** dan buat skema baru |
| `npm test` | tes unit (harga, pajak, pembayaran, opsi, CSV) |
| `npm run test:db` | tes integrasi ke Postgres (`kasir_in_test`): stok FEFO, void, shift, pembelian, opname, balapan stok |
| `npm run typecheck` | TypeScript |

## Memakai untuk pelanggan baru / demo ulang

Pengaturan → **Mulai dari awal** menghapus semua data (konfirmasi dengan mengetik nama usaha) dan kembali ke setup —
berguna untuk demo dengan jenis usaha lain atau serah-terima ke pelanggan baru.

## Perangkat

- **Tablet / HP**: layout responsif; di HP keranjang menjadi lembar geser. Tambahkan ke layar utama (PWA manifest tersedia).
- **Barcode scanner USB**: scanner berperan sebagai keyboard. Di layar kasir, scan kapan saja (tanpa fokus ke kolom) atau
  ketik/scan di kolom cari lalu Enter. Isi barcode produk di form produk.
- **Nama panjang di struk**: nama kasir disingkat otomatis sesuai lebar kertas (nama tengah → inisial, lalu "Nama D. B."), sedangkan teks lain (nama pelanggan, item, alamat) wrap ke baris berikutnya dan nominal tidak pernah terpotong.
- **Printer thermal**: struk dicetak lewat dialog cetak browser (`/struk/<id>`). Pilih printer thermal, **matikan
  "Header dan footer"**, dan atur lebar kertas 58/80 mm di Pengaturan. Tombol "Cetak struk" muncul setelah pembayaran.

## Deploy

Dirancang untuk Vercel + Postgres terkelola (Neon / Supabase), atau server sendiri (`npm run build && npm start`).

1. Buat database Postgres, salin connection string (pakai pooler bila ada, `?sslmode=require`).
2. Set `DATABASE_URL` di environment platform.
3. Jalankan sekali dari komputer Anda: `DATABASE_URL=… npm run db -- schema`.
4. Deploy, buka URL-nya, selesaikan Setup awal.

Catatan: Vercel *Hobby* hanya untuk penggunaan non-komersial. Untuk pelanggan berbayar pakai plan Pro atau VPS.
Cadangkan database secara berkala (`pg_dump`); Neon/Supabase menyediakan backup otomatis pada plan tertentu.

## Struktur kode

```
db/schema.sql          skema (satu set tabel untuk semua jenis usaha)
scripts/db.mjs         perintah database
src/lib/profiles.ts    definisi 5 jenis usaha (istilah, isian, fitur) — tambah jenis baru di sini + demo.ts
src/app/ios-theme.css  tema iOS (token iOS Design System + kaca tembus), aktif lewat <html data-theme="ios">
src/lib/pricing.ts     hitung total/PPN/service/diskon + validasi pembayaran (murni, dites)
src/lib/sales.ts       checkout & void dalam satu transaksi DB (harga dihitung ulang di server)
src/lib/stock.ts       mutasi stok, FEFO per batch, stok opname
src/lib/purchases.ts   pembelian & batch; shifts.ts kas/shift; reports.ts laporan & CSV
src/components/pos.tsx layar kasir (klien)
src/app/(app)/…        halaman: kasir, transaksi, produk, stok, pembelian, laporan, shift, pengaturan
src/app/struk/[id]     struk cetak
```

Menambah jenis usaha: tambahkan entri di `PROFILES` (`profiles.ts`), izinkan nilainya di `check` kolom `business.type`
(`schema.sql`), tambah ikon di `icons.tsx` (`PROFILE_ICON`) dan data contoh di `demo.ts`.

## Keputusan desain & batasan yang disengaja

- **Satu admin.** Tanpa peran kasir/pemilik terpisah; nama di struk & shift = akun yang login. Tambah tabel peran bila
  satu toko dipakai beberapa kasir dengan hak berbeda.
- **Satu instalasi = satu usaha** (bukan multi-tenant). Jenis usaha tidak bisa diganti setelah setup karena mengubah
  cara stok dicatat (mis. batch apotek); gunakan "Mulai dari awal".
- **Harga pokok = harga beli terakhir** (bukan rata-rata bergerak). Laba = penjualan bersih − harga pokok; PPN & service
  tidak dihitung sebagai pendapatan.
- **Void penuh saja**, tanpa retur sebagian. Stok dikembalikan persis ke batch asal.
- **Pembayaran non-tunai hanya dicatat** (QRIS/transfer/kartu tidak terhubung ke payment gateway atau EDC).
- **Tanpa mode offline.** Kasir butuh koneksi ke server/database. Keranjang yang sedang dibuat tersimpan di perangkat.
- **Ekspor CSV** (pemisah `;`, BOM) — langsung terbuka di Excel Indonesia; bukan `.xlsx`.
- Daftar produk di layar kasir dimuat penuh di klien; nyaman sampai ± 2–3 ribu item.
- Riwayat penjualan data contoh tidak mengurangi stok (stok demo = kondisi saat ini).
