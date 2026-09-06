"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useCart } from "@/components/cart/cart-context";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/catalog", label: "Каталог" },
  { href: "/about", label: "О нас" },
  { href: "/delivery", label: "Доставка" },
  { href: "/contacts", label: "Контакты" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const { count, hydrated } = useCart();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearchOpen(false);
    setMenuOpen(false);
    router.push(q.trim() ? `/catalog?q=${encodeURIComponent(q.trim())}` : "/catalog");
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled || menuOpen
            ? "bg-bg/75 backdrop-blur-xl border-b border-line/70"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="heading text-lg tracking-tight sm:text-xl"
            onClick={() => setMenuOpen(false)}
            aria-label="ТАКТИЛЬНО — на главную"
          >
            ТАКТИЛЬНО<span className="text-green">.</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Основное меню">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm font-medium text-muted transition-colors hover:text-fg"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="hidden h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-card hover:text-fg md:flex"
              aria-label="Поиск"
            >
              <SearchIcon />
            </button>
            <Link
              href="/cart"
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-card"
              aria-label="Корзина"
            >
              <BagIcon />
              {hydrated && count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-green px-1 text-[11px] font-bold text-bg">
                  {count}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-fg md:hidden"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
            >
              <span className="relative block h-4 w-5">
                <span
                  className={cn(
                    "absolute left-0 top-0 h-[2px] w-5 bg-current transition-transform duration-300",
                    menuOpen && "translate-y-[7px] rotate-45"
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 top-[7px] h-[2px] w-5 bg-current transition-opacity duration-300",
                    menuOpen && "opacity-0"
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 top-[14px] h-[2px] w-5 bg-current transition-transform duration-300",
                    menuOpen && "-translate-y-[7px] -rotate-45"
                  )}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Desktop search */}
        <div
          className={cn(
            "hidden overflow-hidden border-t border-line/60 bg-bg/90 backdrop-blur-xl transition-all duration-300 md:block",
            searchOpen ? "max-h-24 opacity-100" : "max-h-0 opacity-0 border-t-0"
          )}
        >
          <form onSubmit={submitSearch} className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4 lg:px-8">
            <SearchIcon className="text-muted" />
            <input
              autoFocus={searchOpen}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найти фигурку…"
              className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
            <button type="submit" className="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg">
              Найти
            </button>
          </form>
        </div>
      </header>

      {/* Mobile menu */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-bg/95 backdrop-blur-xl transition-opacity duration-300 md:hidden",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="flex h-full flex-col px-6 pb-10 pt-24">
          <form onSubmit={submitSearch} className="mb-8 flex items-center gap-3 rounded-2xl bg-card px-4">
            <SearchIcon className="text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найти фигурку…"
              className="h-13 min-h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
          </form>
          <nav className="flex flex-col gap-2" aria-label="Мобильное меню">
            {NAV.map((n, i) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="heading py-3 text-4xl transition-colors hover:text-green"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto text-sm text-muted">Фигурки, которые хочется трогать.</div>
        </div>
      </div>
    </>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l1 13H5L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
