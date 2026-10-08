import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { readBusiness, today } from "@/lib/biz";
import { sql } from "@/lib/db";
import { EXPORT_KINDS, exportCsv, isDate, type ExportKind } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** Ekspor CSV (terbuka di Excel). Hanya untuk yang sudah login. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const [b] = await sql`select 1 from business`;
  if (!b || !(await getUser())) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  const { kind } = await ctx.params;
  if (!(EXPORT_KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: "Jenis ekspor tidak dikenal" }, { status: 404 });
  const { biz } = await readBusiness();
  const p = req.nextUrl.searchParams;
  const t0 = today(biz.timezone);
  const from = isDate(p.get("from")) ? p.get("from")! : t0;
  const to = isDate(p.get("to")) ? p.get("to")! : t0;
  const csv = await exportCsv(kind as ExportKind, biz.timezone, from, to);
  const name = kind === "stok" ? `stok-${t0}` : `${kind}-${from}_${to}`;
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="kasir-in-${name}.csv"`, "Cache-Control": "no-store" },
  });
}
