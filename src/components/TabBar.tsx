"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, Plus, Building2, User } from "lucide-react";
import { cx } from "@/lib/cx";

const TABS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: List },
  { href: "/nuevo", label: "Registrar", icon: Plus, primary: true },
  { href: "/casa", label: "Casa", icon: Building2 },
  { href: "/yo", label: "Yo", icon: User },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--sheet)_88%,transparent)] backdrop-blur-xl pb-safe"
      aria-label="Principal"
    >
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          const Icon = t.icon;
          if (t.primary) {
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-label={t.label}
                  className="-mt-5 flex size-14 items-center justify-center rounded-full bg-ink text-sheet shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--ink)_60%,transparent)] active:scale-95 transition-transform"
                >
                  <Plus size={28} strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex w-16 flex-col items-center gap-0.5 py-1 text-[11px] font-600",
                  active ? "text-ink" : "text-ink-3",
                )}
              >
                <Icon size={23} strokeWidth={active ? 2.4 : 2} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
