import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOptionGroups, resolveOptions } from "../src/lib/options.ts";
import { toCsv } from "../src/lib/csv.ts";

const groups = [
  { name: "Ukuran", required: true, multi: false, choices: [{ name: "Regular", price: 0 }, { name: "Large", price: 5000 }] },
  { name: "Tambahan", required: false, multi: true, choices: [{ name: "Boba", price: 5000 }, { name: "Susu oat", price: 7000 }] },
];

test("resolveOptions: harga dari definisi produk, bukan dari klien", () => {
  const r = resolveOptions(groups, [{ group: "Ukuran", choice: "Large" }, { group: "Tambahan", choice: "Boba" }, { group: "Tambahan", choice: "Susu oat" }]);
  assert.deepEqual(r.map((x) => x.price), [5000, 5000, 7000]);
});

test("resolveOptions: wajib, tunggal, dan tidak dikenal ditolak", () => {
  assert.throws(() => resolveOptions(groups, []), /pilih Ukuran/);
  assert.throws(() => resolveOptions(groups, [{ group: "Ukuran", choice: "Regular" }, { group: "Ukuran", choice: "Large" }]), /satu pilihan/);
  assert.throws(() => resolveOptions(groups, [{ group: "Ukuran", choice: "Jumbo" }]), /tidak dikenal/);
  assert.throws(() => resolveOptions(groups, [{ group: "Ukuran", choice: "Regular" }, { group: "Gula", choice: "x" }]), /opsi tidak dikenal/);
});

test("parseOptionGroups: validasi dari formulir", () => {
  assert.deepEqual(parseOptionGroups(""), []);
  assert.throws(() => parseOptionGroups("bukan json"), /tidak valid/);
  assert.throws(() => parseOptionGroups(JSON.stringify([{ name: "", choices: [{ name: "a", price: 0 }] }])), /nama/);
  assert.throws(() => parseOptionGroups(JSON.stringify([{ name: "A", choices: [] }])), /pilihan/);
  assert.throws(() => parseOptionGroups(JSON.stringify([{ name: "A", choices: [{ name: "x", price: 0 }, { name: "X", price: 0 }] }])), /ganda/);
  const ok = parseOptionGroups(JSON.stringify([{ name: " Gula ", required: 1, choices: [{ name: "Normal", price: "0" }, { name: "Extra", price: 1500.4 }] }]));
  assert.equal(ok[0].name, "Gula");
  assert.equal(ok[0].required, true);
  assert.equal(ok[0].choices[1].price, 1500);
});

test("toCsv: BOM, titik koma, kutip, dan cegah injeksi rumus", () => {
  const out = toCsv([["a;b", 'say "hi"', "=1+1", null, 12.5]]);
  assert.ok(out.startsWith("﻿"));
  assert.equal(out.slice(1), `"a;b";"say ""hi""";'=1+1;;12.5\r\n`);
});

import { fitName } from "../src/lib/format.ts";
test("fitName: nama panjang disingkat bertahap sesuai batas cetak", () => {
  assert.equal(fitName("Rani", 20), "Rani");
  assert.equal(fitName("  Rani   Putri ", 20), "Rani Putri");
  assert.equal(fitName("Muhammad Abdurrahman Wicaksono", 21), "Muhammad A. Wicaksono");
  assert.equal(fitName("Muhammad Abdurrahman Wicaksono", 18), "Muhammad A. W.");
  assert.equal(fitName("Siti Nurhaliza Binti Abdullah Rahman", 14), "Siti R.");
  assert.equal(fitName("Bartholomeus", 8), "Bartho..");
  for (const n of ["Muhammad Abdurrahman Wicaksono Putra Perdana", "X", "Ayu Wulandari"]) assert.ok(fitName(n, 12).length <= 12);
});

import { checkLogoDataUrl } from "../src/lib/logo.ts";
import { deflateSync } from "node:zlib";
function png(w: number, h: number) {
  const crc = (b: Buffer) => { let c, t = -1 >>> 0; for (const x of b) { c = (t ^ x) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t = (t >>> 8) ^ c; } return (t ^ -1) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const b = Buffer.concat([Buffer.from(type), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(b)); return Buffer.concat([len, b, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w, 255)])));
  return "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}
test("checkLogoDataUrl: hanya PNG kecil yang valid", () => {
  assert.equal(checkLogoDataUrl(png(120, 60)), null);
  assert.match(checkLogoDataUrl(png(2000, 60))!, /Dimensi/);
  assert.match(checkLogoDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")!, /tidak valid/);
  assert.match(checkLogoDataUrl("data:image/png;base64," + Buffer.from("bukan png sama sekali, hanya teks panjang di sini").toString("base64"))!, /bukan PNG/);
  assert.match(checkLogoDataUrl('data:image/png;base64,AAAA"><script>alert(1)</script>')!, /tidak valid/);
  assert.match(checkLogoDataUrl("data:image/png;base64," + "A".repeat(200_001))!, /terlalu besar/);
});
