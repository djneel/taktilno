"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Category } from "@/db/schema";
import { cn } from "@/lib/utils";

const SORTS = [
  { id: "popular", label: "По популярности" },
  { id: "price_asc", label: "Цена: по возрастанию" },
  { id: "price_desc", label: "Цена: по убыванию" },
  { id: "new", label: "Новинки" },
];

export function CatalogFilters({ categories, total }: { categories: Category[]; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("category") ?? "";
  const sort = sp.get("sort") ?? "popular";
  const featured = sp.get("featured") === "1";
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => setQ(sp.get("q") ?? ""), [sp]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update({ q: q.trim() || null });
  };

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={!current && !featured} onClick={() => update({ category: null, featured: null })}>
          Все
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={current === c.slug} onClick={() => update({ category: c.slug, featured: null })}>
            {c.name}
          </Chip>
        ))}
        <Chip active={featured} onClick={() => update({ featured: featured ? null : "1", category: null })}>
          Хиты
        </Chip>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={submit} className="flex flex-1 items-center gap-2 rounded-full bg-card px-4 ring-1 ring-line/60 sm:max-w-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по фигуркам"
            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            aria-label="Поиск"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                update({ q: null });
              }}
              className="flex h-9 w-9 items-center justify-center text-muted"
              aria-label="Очистить"
            >
              ×
            </button>
          )}
        </form>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">{total} шт.</span>
          <label className="relative">
            <span className="sr-only">Сортировка</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === "popular" ? null : e.target.value })}
              className="h-12 appearance-none rounded-full bg-card pl-4 pr-10 text-sm font-semibold ring-1 ring-line/60 outline-none focus:ring-green"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">⌄</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors ring-1",
        active ? "bg-fg text-bg ring-fg" : "bg-card text-muted ring-line/60 md:hover:text-fg"
      )}
    >
      {children}
    </button>
  );
}
