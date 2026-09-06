"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import type { ProductWithRelations } from "@/lib/data";
import { getMainImage } from "@/lib/images";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  product,
  quantity = 1,
  compact = false,
  className,
}: {
  product: ProductWithRelations;
  quantity?: number;
  compact?: boolean;
  className?: string;
}) {
  const { addItem, items } = useCart();
  const [pulse, setPulse] = useState(false);
  const soldOut = product.stock <= 0 || !product.isAvailable;
  const inCart = items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const limitReached = product.stock > 0 && inCart >= product.stock;

  const handle = () => {
    if (soldOut || limitReached) return;
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        imageUrl: getMainImage(product)?.url ?? null,
        category: product.category?.name ?? null,
        stock: product.stock,
      },
      quantity
    );
    setPulse(true);
    setTimeout(() => setPulse(false), 400);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={soldOut || limitReached}
        aria-label={soldOut ? "Нет в наличии" : "В корзину"}
        title={soldOut ? "Нет в наличии" : limitReached ? "Больше нет в наличии" : "В корзину"}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full bg-fg text-bg transition-all duration-300 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted md:hover:bg-green",
          pulse && "scale-90",
          className
        )}
      >
        {inCart > 0 && !soldOut ? <CheckIcon /> : <PlusIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={soldOut || limitReached}
      className={cn(
        "flex h-14 w-full items-center justify-center gap-2 rounded-full bg-fg px-8 text-sm font-bold uppercase tracking-wider text-bg transition-all duration-300 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted md:hover:bg-green",
        pulse && "scale-[0.98]",
        className
      )}
    >
      {soldOut ? "Нет в наличии" : limitReached ? "Всё уже в корзине" : inCart > 0 ? `В корзине: ${inCart} · Добавить ещё` : "Добавить в корзину"}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}
