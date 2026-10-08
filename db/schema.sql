-- Skema Kasir-in. Idempoten: aman dijalankan berulang (npm run db -- schema).
-- Uang = integer rupiah. Jumlah barang = numeric (mendukung pecahan, mis. 2,5 kg).

-- Satu baris saja: profil usaha + pengaturan. Baris ada = setup awal sudah selesai.
create table if not exists business (
  id boolean primary key default true check (id),
  name text not null,
  type text not null check (type in ('retail','fnb','apotek','jasa','fashion')),
  address text not null default '',
  phone text not null default '',
  timezone text not null default 'Asia/Jakarta' check (timezone in ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura')),
  tax_mode text not null default 'off' check (tax_mode in ('off','exclusive','inclusive')),
  tax_rate numeric(5,2) not null default 11 check (tax_rate >= 0 and tax_rate <= 100),
  service_rate numeric(5,2) not null default 0 check (service_rate >= 0 and service_rate <= 100),
  paper_width int not null default 58 check (paper_width in (58, 80)),
  receipt_footer text not null default 'Terima kasih atas kunjungan Anda',
  allow_negative_stock boolean not null default false,
  receipt_template text not null default 'klasik' check (receipt_template in ('klasik','ringkas','modern')),
  ui_theme text not null default 'default' check (ui_theme in ('default','ios')),
  receipt_logo text check (receipt_logo is null or length(receipt_logo) <= 200000),  -- data URL PNG, sudah diproses di klien
  logo_size text not null default 'sedang' check (logo_size in ('kecil','sedang','besar')),
  receipt_action text not null default 'popup' check (receipt_action in ('popup','print')),  -- aksi "Cetak struk" di kasir
  logo_name boolean not null default true,                                           -- tampilkan nama usaha di bawah logo
  created_at timestamptz not null default now()
);
-- instalasi lama (dibuat sebelum kolom ini ada)
alter table business add column if not exists receipt_template text not null default 'klasik' check (receipt_template in ('klasik','ringkas','modern'));
alter table business add column if not exists ui_theme text not null default 'default' check (ui_theme in ('default','ios'));
alter table business add column if not exists receipt_logo text check (receipt_logo is null or length(receipt_logo) <= 200000);
alter table business add column if not exists logo_size text not null default 'sedang' check (logo_size in ('kecil','sedang','besar'));
alter table business add column if not exists logo_name boolean not null default true;
alter table business add column if not exists receipt_action text not null default 'popup' check (receipt_action in ('popup','print'));

create table if not exists users (
  id int generated always as identity primary key,
  username text not null unique,
  name text not null,
  password_hash text not null,
  failed_logins int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,                       -- sha256 dari token cookie
  user_id int not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists categories (
  id int generated always as identity primary key,
  name text not null unique,
  sort int not null default 0
);

create table if not exists products (
  id int generated always as identity primary key,
  category_id int references categories(id) on delete set null,
  name text not null,
  variant_label text,                        -- fashion: "M / Hitam". Produk bernama sama + varian = satu kelompok di kasir
  sku text,
  barcode text,
  unit text not null default 'pcs',
  price int not null check (price >= 0),
  cost int not null default 0 check (cost >= 0),
  is_service boolean not null default false, -- jasa / menu tanpa stok: tidak dihitung stoknya
  stock numeric(12,3) not null default 0,    -- apotek: total semua batch
  min_stock numeric(12,3) not null default 0,
  options jsonb not null default '[]',       -- grup opsi/tambahan (kafe): [{name,required,multi,choices:[{name,price}]}]
  requires_rx boolean not null default false,-- apotek: obat keras (perlu resep)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists products_barcode_uq on products (barcode) where barcode is not null;
create unique index if not exists products_sku_uq on products (sku) where sku is not null;
create index if not exists products_category_idx on products (category_id);

-- Hanya dipakai jenis usaha dengan batch/kedaluwarsa (apotek).
create table if not exists stock_batches (
  id int generated always as identity primary key,
  product_id int not null references products(id) on delete cascade,
  batch_no text not null,
  expiry date,
  qty numeric(12,3) not null default 0 check (qty >= 0),
  cost int not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, batch_no)
);

create table if not exists stock_moves (
  id int generated always as identity primary key,
  product_id int not null references products(id) on delete cascade,
  batch_id int references stock_batches(id) on delete set null,
  type text not null check (type in ('sale','void','purchase','opname','adjust')),
  qty numeric(12,3) not null,                -- bertanda: + masuk, - keluar
  balance numeric(12,3) not null,            -- total stok produk setelah mutasi
  ref_type text,                             -- 'order' | 'purchase'
  ref_id int,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists stock_moves_product_idx on stock_moves (product_id, created_at desc);
create index if not exists stock_moves_ref_idx on stock_moves (ref_type, ref_id);

create table if not exists suppliers (
  id int generated always as identity primary key,
  name text not null,
  phone text not null default '',
  address text not null default '',
  note text not null default '',
  active boolean not null default true
);

create table if not exists purchases (
  id int generated always as identity primary key,
  number text not null unique,
  supplier_id int references suppliers(id) on delete set null,
  supplier_name text not null default '',
  invoice_no text not null default '',
  note text not null default '',
  total int not null default 0,
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists purchase_items (
  id int generated always as identity primary key,
  purchase_id int not null references purchases(id) on delete cascade,
  product_id int references products(id) on delete set null,
  name text not null,
  qty numeric(12,3) not null check (qty > 0),
  cost int not null check (cost >= 0),
  batch_no text,
  expiry date
);
create index if not exists purchase_items_purchase_idx on purchase_items (purchase_id);

create table if not exists shifts (
  id int generated always as identity primary key,
  cashier_name text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash int not null default 0 check (opening_cash >= 0),
  expected_cash int,                         -- snapshot saat tutup shift
  counted_cash int,
  note text not null default ''
);
create unique index if not exists one_open_shift on shifts ((true)) where closed_at is null;

create table if not exists cash_moves (
  id int generated always as identity primary key,
  shift_id int not null references shifts(id) on delete cascade,
  kind text not null check (kind in ('in','out')),
  amount int not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists counters (
  key text primary key,
  n int not null
);

create table if not exists orders (
  id int generated always as identity primary key,
  number text not null unique,
  shift_id int references shifts(id) on delete set null,
  cashier_name text not null default '',
  status text not null default 'paid' check (status in ('paid','void')),
  subtotal int not null,                     -- jumlah baris setelah diskon baris
  discount int not null default 0,           -- diskon tingkat transaksi
  service int not null default 0,
  tax int not null default 0,
  total int not null,
  cogs int not null default 0,               -- harga pokok barang terjual
  change int not null default 0,
  meta jsonb not null default '{}',          -- isian khas jenis usaha (no. meja, nama pasien, dst.)
  note text not null default '',
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists orders_created_idx on orders (created_at);
create index if not exists orders_shift_idx on orders (shift_id);

create table if not exists order_items (
  id int generated always as identity primary key,
  order_id int not null references orders(id) on delete cascade,
  product_id int references products(id) on delete set null,
  name text not null,
  variant_label text,
  unit text not null default 'pcs',
  qty numeric(12,3) not null check (qty > 0),
  price int not null,                        -- harga satuan akhir (sudah termasuk opsi)
  cost int not null default 0,
  discount int not null default 0,           -- diskon baris (nominal)
  options jsonb not null default '[]',       -- salinan opsi terpilih [{group,name,price}]
  note text not null default '',
  total int not null                         -- price*qty - discount
);
create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_product_idx on order_items (product_id);

create table if not exists payments (
  id int generated always as identity primary key,
  order_id int not null references orders(id) on delete cascade,
  method text not null check (method in ('cash','qris','transfer','card')),
  amount int not null check (amount > 0),    -- nilai yang dihitung ke tagihan (tunai sudah dikurangi kembalian)
  tendered int not null check (tendered > 0) -- uang yang diterima
);
create index if not exists payments_order_idx on payments (order_id);
