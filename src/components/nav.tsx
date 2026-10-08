"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "./icons";
import { Sheet } from "./sheet";
import { logoutAction } from "@/app/(app)/actions";

type Item = { href: string; label: string; icon: IconName };

export function Nav({ items, itemsMore, sorted, shiftOpen }: { items: Item[]; itemsMore: Item[]; sorted: Item[]; shiftOpen: boolean }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const cur = (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);
  const link = (i: Item, extra?: () => void) => (
    <Link key={i.href} href={i.href} className="nav" aria-current={cur(i.href)} onClick={extra}>
      <Icon name={i.icon} />{i.label}
      {i.href === "/shift" && <span className={`badge ${shiftOpen ? "ok" : "warn"}`} style={{ padding: "0 6px", fontSize: "0.66rem" }}>{shiftOpen ? "buka" : "tutup"}</span>}
    </Link>
  );

  return (
    <>
      <nav className="rail" aria-label="Menu utama">
        <Link href="/kasir" className="brand" aria-label="Kasir-in"><Icon name="logo" /></Link>
        {sorted.map((i) => link(i))}
        <span className="gap" />
        <form action={logoutAction}><button className="nav" type="submit"><Icon name="logout" />Keluar</button></form>
      </nav>

      <nav className="tabbar" aria-label="Menu utama">
        {items.map((i) => link(i))}
        <button type="button" className="nav" onClick={() => setMore(true)} aria-current={itemsMore.some((i) => cur(i.href)) ? "page" : undefined}>
          <Icon name="more" />Lainnya
        </button>
      </nav>

      {more && (
        <Sheet title="Menu lainnya" onClose={() => setMore(false)}>
          <div className="stack">
            {itemsMore.map((i) => (
              <Link key={i.href} href={i.href} className="btn ghost lg" style={{ justifyContent: "flex-start" }} onClick={() => setMore(false)}>
                <Icon name={i.icon} />{i.label}
              </Link>
            ))}
            <form action={logoutAction}><button className="btn ghost lg block" type="submit" style={{ justifyContent: "flex-start" }}><Icon name="logout" />Keluar</button></form>
          </div>
        </Sheet>
      )}
    </>
  );
}
