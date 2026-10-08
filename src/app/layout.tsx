import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/inter";
import "./globals.css";
import "./pos.css";
import "./ios-theme.css";
import { sql } from "@/lib/db";
import { PROFILES, isProfileId } from "@/lib/profiles";
import { isUiTheme } from "@/lib/receipt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Kasir-in", template: "%s · Kasir-in" },
  description: "Sistem kasir, stok, dan laporan untuk usaha Anda.",
  appleWebApp: { capable: true, title: "Kasir-in", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [b] = await sql`select type, ui_theme from business`;
  const theme = isUiTheme(b?.ui_theme) ? b.ui_theme : "default";
  const hue = isProfileId(b?.type) ? PROFILES[b.type].hue : 255;
  return (
    <html lang="id" data-theme={theme} style={{ "--hue": hue } as React.CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
