"use client";

import { useState } from "react";
import type { ProductWithRelations } from "@/lib/data";
import { AddToCartButton } from "./add-to-cart-button";

export function BuyBox({ product }: { product: ProductWithRelations }) {
  const [qty, setQty] = useState(1);
  const max = Math.max(1, Math.min(product.stock, 99));
  const soldOut = product.stock <= 0 || !product.isAvailable;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 items-center rounded-full bg-card ring-1 ring-line/60">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={soldOut || qty <= 1}
            className="flex h-14 w-14 items-center justify-center text-xl disabled:text-line"
            aria-label="Уменьшить"
          >
            −
          </button>
          <span className="w-8 text-center text-base font-bold tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            disabled={soldOut || qty >= max}
            className="flex h-14 w-14 items-center justify-center text-xl disabled:text-line"
            aria-label="Увеличить"
          >
            +
          </button>
        </div>
        <div className="flex-1">
          <AddToCartButton product={product} quantity={qty} />
        </div>
      </div>
      <p className="text-xs text-muted">
        {soldOut
          ? "Сейчас этой фигурки нет. Напиши нам — сообщим, когда напечатаем."
          : product.stock <= 3
            ? `Осталось ${product.stock} шт. — печатаем небольшими партиями.`
            : "Отправляем в течение 1–3 дней после оплаты."}
      </p>
    </div>
  );
}
