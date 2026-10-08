"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Tab antar-halaman (tiap tab = satu rute). */
export function SubTabs({ tabs, label }: { tabs: readonly (readonly [string, string])[]; label: string }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map(([href, text]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{text}</Link>)}
    </nav>
  );
}
