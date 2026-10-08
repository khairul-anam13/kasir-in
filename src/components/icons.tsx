import type { ReactNode } from "react";

const c = (d: string) => <path d={d} />;
const dot = (x: number, y: number, r = 1) => <circle cx={x} cy={y} r={r} />;

const PATHS = {
  kasir: <>{c("M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M8 7h8 M8 12h.01 M12 12h.01 M16 12h.01 M8 16h.01 M12 16h.01 M16 16h.01")}</>,
  receipt: c("M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z M9 8h6 M9 12h6"),
  box: c("M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z M3.5 7.5 12 12l8.5-4.5 M12 12v9"),
  stock: c("M12 3 3 8l9 5 9-5z M3 12.5l9 5 9-5 M3 16.5l9 5 9-5"),
  truck: <>{c("M3 6h11v10H3z M14 9h4l3 3v4h-7")}{dot(7, 18.5, 1.6)}{dot(17, 18.5, 1.6)}</>,
  chart: c("M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-3 M20 16V6"),
  clock: <>{dot(12, 12, 9)}{c("M12 7v5l3 2")}</>,
  sliders: <>{c("M4 7h9 M19 7h1 M4 17h1 M11 17h9")}{dot(16, 7, 2.5)}{dot(8, 17, 2.5)}</>,
  search: <>{dot(11, 11, 6.5)}{c("m20 20-4.2-4.2")}</>,
  plus: c("M12 5v14M5 12h14"),
  minus: c("M5 12h14"),
  x: c("M6 6l12 12M18 6 6 18"),
  check: c("m5 12.5 4.5 4.5L19 7.5"),
  trash: c("M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13 M10 11v6 M14 11v6"),
  barcode: c("M4 5v14 M7 5v14 M11 5v14 M14 5v14 M17 5v14 M20 5v14"),
  menu: c("M4 7h16M4 12h16M4 17h16"),
  print: c("M7 9V3h10v6 M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2 M7 14h10v7H7z"),
  tag: <>{c("M3 12V4h8l10 10-8 8z")}{dot(7.5, 8.5, 1.2)}</>,
  percent: <>{c("M6 18 18 6")}{dot(7.5, 7.5, 1.8)}{dot(16.5, 16.5, 1.8)}</>,
  user: <>{dot(12, 8, 4)}{c("M4 21a8 8 0 0 1 16 0")}</>,
  logout: c("M14 4h5v16h-5 M4 12h11 m-3-3 3 3-3 3"),
  alert: c("M12 4 2.5 20h19z M12 10v4.5 M12 17.5h.01"),
  pause: c("M8 5v14M16 5v14"),
  more: <>{dot(5, 12, 1.4)}{dot(12, 12, 1.4)}{dot(19, 12, 1.4)}</>,
  cart: <>{c("M3 4h2.5l2 11h10.5l2-8H7")}{dot(9.5, 19.5, 1.2)}{dot(17, 19.5, 1.2)}</>,
  download: c("M12 4v11 m-4-4 4 4 4-4 M5 20h14"),
  edit: c("M4 20h4L19 9l-4-4L4 16z"),
  copy: c("M8 8h11v12H8z M5 16V4h11"),
  store: c("M4 9l1.5-5h13L20 9 M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 6 0 2.5 2.5 0 0 0 5 0 M5 12v8h14v-8 M10 20v-5h4v5"),
  cup: c("M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10h2a2.5 2.5 0 0 1 0 5h-2 M8 3v2 M12 3v2"),
  pill: c("M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7z M8.5 8.5l7 7"),
  wrench: c("M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"),
  hanger: c("M12 8a2.5 2.5 0 1 0-2.5-2.5 M12 8v2L3 16.5a1.5 1.5 0 0 0 .9 2.7h16.2a1.5 1.5 0 0 0 .9-2.7L12 10"),
  logo: <>{c("M5 4h14v16l-2.3-1.6L14.3 20 12 18.4 9.7 20l-2.4-1.6L5 20z M9 9h6 M9 13h4")}</>,
  inbox: c("M4 13l2-8h12l2 8 M4 13v6h16v-6 M4 13h5l1 2h4l1-2h5"),
  info: <>{dot(12, 12, 9)}{c("M12 11v5 M12 8h.01")}</>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {PATHS[name]}
    </svg>
  );
}

export const PROFILE_ICON = { retail: "store", fnb: "cup", apotek: "pill", jasa: "wrench", fashion: "hanger" } as const satisfies Record<string, IconName>;
