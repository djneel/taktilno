"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./cart-context";
import { cn, formatPrice, pluralize } from "@/lib/utils";

/** Плавающая кнопка корзины на мобильных + тост «Добавлено» */
export function CartWidgets() {
  const { count, subtotal, hydrated, lastAdded, dismissToast } = useCart();
  const pathname = usePathname();
  const hidden = pathname.startsWith("/cart") || pathname.startsWith("/checkout") || pathname.startsWith("/admin");

  return (
    <>
      {/* Тост */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-4 top-20 z-[60] flex justify-center transition-all duration-300 sm:inset-x-auto sm:right-6",
          lastAdded ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
        )}
        aria-live="polite"
      >
        {lastAdded && (
          <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-card/95 p-3 shadow-2xl ring-1 ring-line backdrop-blur-xl">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-bg2">
              {lastAdded.imageUrl && (
                <Image src={lastAdded.imageUrl} alt="" fill sizes="48px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{lastAdded.name}</div>
              <div className="text-xs text-green">Добавлено в корзину</div>
            </div>
            <Link
              href="/cart"
              onClick={dismissToast}
              className="rounded-full bg-fg px-3 py-2 text-xs font-bold text-bg"
            >
              Открыть
            </Link>
          </div>
        )}
      </div>

      {/* Мобильная плавающая корзина */}
      {hydrated && count > 0 && !hidden && (
        <div className="fixed inset-x-4 bottom-4 z-40 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <Link
            href="/cart"
            className="flex h-14 items-center justify-between rounded-full bg-green px-5 text-bg shadow-[0_10px_40px_-10px_rgba(143,203,129,0.6)]"
          >
            <span className="text-sm font-bold">
              Корзина · {count} {pluralize(count, ["товар", "товара", "товаров"])}
            </span>
            <span className="text-sm font-extrabold">{formatPrice(subtotal)} →</span>
          </Link>
        </div>
      )}
    </>
  );
}
