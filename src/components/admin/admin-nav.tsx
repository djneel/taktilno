"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Обзор", exact: true },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/categories", label: "Категории" },
  { href: "/admin/reviews", label: "Отзывы" },
  { href: "/admin/settings", label: "Настройки сайта" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 no-scrollbar md:flex-col md:px-3 md:pb-6">
      {ITEMS.map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              active ? "bg-card text-fg" : "text-muted hover:text-fg"
            )}
          >
            {i.label}
          </Link>
        );
      })}
      <Link href="/" target="_blank" className="shrink-0 rounded-xl px-3 py-2.5 text-sm text-muted hover:text-fg md:mt-4">
        Открыть сайт ↗
      </Link>
    </nav>
  );
}
