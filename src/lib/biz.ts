import "server-only";
import { cache } from "react";
import { sql, type Sql, type Tx } from "./db";
import { PROFILES, type Profile, type ProfileId } from "./profiles.ts";
import type { Rates } from "./pricing.ts";
import type { LogoSize, ReceiptAction, ReceiptTemplate, UiTheme } from "./receipt.ts";

export type Business = {
  name: string; type: ProfileId; address: string; phone: string; timezone: string;
  taxMode: Rates["taxMode"]; taxRate: number; serviceRate: number;
  paperWidth: 58 | 80; receiptFooter: string; receiptTemplate: ReceiptTemplate; uiTheme: UiTheme; allowNegativeStock: boolean;
  logoSize: LogoSize; logoName: boolean; receiptAction: ReceiptAction;
  /** Data URL logo. Tidak ikut dibaca di readBusiness (besar) — isi lewat readLogo() di halaman struk/pengaturan. */
  logo?: string | null;
};
export type BizContext = { biz: Business; profile: Profile; rates: Rates };

/** Baca profil usaha + pengaturan (ikut transaksi bila diberi Tx). */
export async function readBusiness(q: Sql | Tx = sql): Promise<BizContext> {
  const [r] = await q`select name, type, address, phone, timezone, tax_mode, tax_rate, service_rate, paper_width, receipt_footer, receipt_template, ui_theme,
                              allow_negative_stock, logo_size, logo_name, receipt_action from business`;
  const biz: Business = {
    name: r.name, type: r.type, address: r.address, phone: r.phone, timezone: r.timezone,
    taxMode: r.tax_mode, taxRate: r.tax_rate, serviceRate: r.service_rate,
    paperWidth: r.paper_width, receiptFooter: r.receipt_footer, receiptTemplate: r.receipt_template, uiTheme: r.ui_theme, allowNegativeStock: r.allow_negative_stock,
    logoSize: r.logo_size, logoName: r.logo_name, receiptAction: r.receipt_action,
  };
  const profile = PROFILES[biz.type];
  const rates: Rates = { taxMode: biz.taxMode, taxRate: biz.taxRate, serviceRate: profile.features.serviceCharge ? biz.serviceRate : 0 };
  return { biz, profile, rates };
}

/** Dipakai halaman setelah requireUser(), jadi barisnya pasti ada. Di-cache per request. */
export const getBusiness = cache(() => readBusiness());

/** Hari ini (yyyy-mm-dd) di zona waktu usaha. */
export const today = (tz: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date());

/** Logo nota (data URL) atau null. Dipisah karena ukurannya bisa puluhan KB. */
export const readLogo = cache(async (): Promise<string | null> => (await sql`select receipt_logo from business`)[0]?.receipt_logo ?? null);
