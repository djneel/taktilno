"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "./cart-context";
import { formatPrice, pluralize } from "@/lib/utils";
import { FIXED_DELIVERY_COST, FREE_DELIVERY_THRESHOLD } from "@/lib/constants";

export function CartView() {
  const { items, hydrated, setQuantity, removeItem, subtotal, count } = useCart();

  if (!hydrated) {
    return <div className="mt-10 h-40 animate-pulse rounded-3xl bg-card" />;
  }

  const isFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryCost = isFreeDelivery ? 0 : FIXED_DELIVERY_COST;
  const total = subtotal + deliveryCost;

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center">
        <div className="heading text-2xl">Пока пусто</div>
        <p className="mt-2 text-muted">Самое время выбрать того, кого захочется взять в руки.</p>
        <Link href="/catalog" className="mt-6 inline-flex h-12 items-center rounded-full bg-fg px-6 text-sm font-bold text-bg md:hover:bg-green">
          В каталог →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[1fr_340px] md:items-start">
      <ul className="divide-y divide-line rounded-3xl bg-card ring-1 ring-line/60">
        {items.map((it) => (
          <li key={`${it.productId}-${it.variantName ?? "default"}`} className="flex gap-4 p-4 sm:p-5">
            <Link href={`/product/${it.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-bg2 sm:h-28 sm:w-28">
              {it.imageUrl && <Image src={it.imageUrl} alt={it.name} fill sizes="112px" className="object-cover" />}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {it.category && (
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{it.category}</div>
                  )}
                  <Link href={`/product/${it.slug}`} className="block truncate text-base font-bold sm:text-lg">
                    {it.name}
                  </Link>
                  {it.variantName && <div className="mt-0.5 text-sm text-muted">Цвет: {it.variantName}</div>}
                  <div className="mt-0.5 text-sm text-muted">{formatPrice(it.price)} / шт.</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(it.productId, it.variantName)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg2 hover:text-fg"
                  aria-label={`Удалить ${it.name}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                <div className="flex h-11 items-center rounded-full bg-bg2 ring-1 ring-line/60">
                  <button type="button" onClick={() => setQuantity(it.productId, it.quantity - 1, it.variantName)} className="flex h-11 w-11 items-center justify-center text-lg" aria-label="Уменьшить">
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums">{it.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(it.productId, it.quantity + 1, it.variantName)}
                    disabled={it.stock > 0 && it.quantity >= it.stock}
                    className="flex h-11 w-11 items-center justify-center text-lg disabled:text-line"
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                </div>
                <div className="text-base font-extrabold sm:text-lg">{formatPrice(it.price * it.quantity)}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="rounded-3xl bg-card p-5 ring-1 ring-line/60 md:sticky md:top-24 sm:p-6">
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Товары · {count} {pluralize(count, ["товар", "товара", "товаров"])}
          </span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm text-muted">
          <span>Доставка</span>
          <span>{isFreeDelivery ? "Бесплатно" : formatPrice(deliveryCost)}</span>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-base font-bold">Итого</span>
          <span className="text-right text-2xl font-extrabold tracking-tight">{formatPrice(total)}</span>
        </div>
        <Link
          href="/checkout"
          className="mt-5 flex h-14 items-center justify-center rounded-full bg-green text-sm font-bold uppercase tracking-wider text-bg transition-transform md:hover:scale-[1.02]"
        >
          Оформить заказ →
        </Link>
        <Link href="/catalog" className="mt-3 block text-center text-sm text-muted hover:text-fg">
          Продолжить выбирать
        </Link>
      </aside>
    </div>
  );
}
