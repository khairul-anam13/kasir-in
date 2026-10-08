import "server-only";
import { sql } from "./db";
import { UserError } from "./errors.ts";

export type Shift = { id: number; cashier_name: string; opened_at: Date; closed_at: Date | null; opening_cash: number; expected_cash: number | null; counted_cash: number | null; note: string };

export async function currentShift(): Promise<Shift | null> {
  const [s] = await sql<Shift[]>`select * from shifts where closed_at is null`;
  return s ?? null;
}

/** Ringkasan kas & penjualan satu shift. Transaksi void tidak dihitung. */
export async function shiftSummary(shiftId: number) {
  const [s] = await sql<Shift[]>`select * from shifts where id = ${shiftId}`;
  const methods = await sql<{ method: string; amount: number }[]>`
    select p.method, sum(p.amount) amount from payments p join orders o on o.id = p.order_id
    where o.shift_id = ${shiftId} and o.status = 'paid' group by p.method order by 1`;
  const [t] = await sql<{ n: number; total: number; voided: number }[]>`
    select count(*) filter (where status = 'paid') n, coalesce(sum(total) filter (where status = 'paid'), 0) total,
           count(*) filter (where status = 'void') voided
    from orders where shift_id = ${shiftId}`;
  const moves = await sql<{ id: number; kind: "in" | "out"; amount: number; note: string; created_at: Date }[]>`
    select id, kind, amount, note, created_at from cash_moves where shift_id = ${shiftId} order by id`;
  const cashSales = methods.find((m) => m.method === "cash")?.amount ?? 0;
  const cashIn = moves.filter((m) => m.kind === "in").reduce((a, m) => a + m.amount, 0);
  const cashOut = moves.filter((m) => m.kind === "out").reduce((a, m) => a + m.amount, 0);
  return { shift: s, methods, orders: t.n, sales: t.total, voided: t.voided, moves, cashSales, cashIn, cashOut, expected: s.opening_cash + cashSales + cashIn - cashOut };
}

export async function openShift(cashier: string, openingCash: number) {
  if (!Number.isFinite(openingCash) || openingCash < 0 || openingCash > 1_000_000_000) throw new UserError("Modal awal tidak valid");
  try {
    await sql`insert into shifts (cashier_name, opening_cash) values (${cashier}, ${openingCash})`;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new UserError("Sudah ada shift yang terbuka");
    throw e;
  }
}

export async function closeShift(shiftId: number, counted: number, note: string) {
  if (!Number.isFinite(counted) || counted < 0) throw new UserError("Jumlah uang tidak valid");
  const { expected, shift } = await shiftSummary(shiftId);
  if (shift.closed_at) throw new UserError("Shift sudah ditutup");
  await sql`update shifts set closed_at = now(), counted_cash = ${Math.round(counted)}, expected_cash = ${expected}, note = ${note.trim().slice(0, 200)} where id = ${shiftId} and closed_at is null`;
}

export async function addCashMove(shiftId: number, kind: "in" | "out", amount: number, note: string) {
  if (!(amount > 0) || amount > 1_000_000_000) throw new UserError("Nominal tidak valid");
  if (!note.trim()) throw new UserError("Keterangan wajib diisi");
  const [s] = await sql`select closed_at from shifts where id = ${shiftId}`;
  if (!s || s.closed_at) throw new UserError("Shift sudah ditutup");
  await sql`insert into cash_moves (shift_id, kind, amount, note) values (${shiftId}, ${kind}, ${Math.round(amount)}, ${note.trim().slice(0, 120)})`;
}
