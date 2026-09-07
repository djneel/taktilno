"use client";

import { useState } from "react";
import type { ProductWithRelations } from "@/lib/data";
import { getMainImage } from "@/lib/images";
import { AddToCartButton } from "./add-to-cart-button";

const COLOR_VARIANTS = [
  { name: "Серый", value: "#8b8b8b", imageKeywords: ["серый", "grey", "gray"] },
  { name: "Коричневый", value: "#8b5e3c", imageKeywords: ["коричневый", "brown"] },
  { name: "Чёрный", value: "#1f1f1f", imageKeywords: ["чёрный", "черный", "black"] },
  { name: "Сине-фиолетовый", value: "#5546a8", imageKeywords: ["сине-фиолетовый", "синий", "фиолетовый", "blue", "purple"] },
] as const;

const FROG_COLORS = [
  { name: "Синий", value: "#3156d8", imageKeywords: ["синий", "blue"] },
  { name: "Зелёный", value: "#46b84f", imageKeywords: ["зелёный", "зеленый", "green"] },
  { name: "Розовый", value: "#e94f9a", imageKeywords: ["розовый", "pink"] },
  { name: "Красный", value: "#e53935", imageKeywords: ["красный", "red"] },
  { name: "Жёлтый", value: "#f2c94c", imageKeywords: ["жёлтый", "желтый", "yellow"] },
] as const;

function getColorImages(product: ProductWithRelations, colorName: string, colors = COLOR_VARIANTS) {
  const images = [...product.images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const assigned = images.filter((image) => image.colorVariant === colorName);
  if (assigned.length) return assigned;

  const color = colors.find((c) => c.name === colorName);
  if (!color) return images;
  const matches = images.filter((image) => {
    const haystack = `${image.url} ${image.alt ?? ""}`.toLowerCase();
    return color.imageKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });
  return matches.length ? matches : images;
}

function getColorImage(product: ProductWithRelations, colorName: string, colors = COLOR_VARIANTS) {
  return getColorImages(product, colorName, colors)[0]?.url ?? getMainImage(product)?.url ?? null;
}

export function BuyBox({ product }: { product: ProductWithRelations }) {
  const [qty, setQty] = useState(1);
  const isSphinx = product.slug === "kot-sfinks" || product.name.toLowerCase().includes("кот-сфинкс");
  const isFrog = product.slug === "lyagushka" || product.slug === "frog" || product.name.toLowerCase().includes("лягуш");
  const colors = isFrog ? FROG_COLORS : COLOR_VARIANTS;
  const [selectedColor, setSelectedColor] = useState<string>(colors[0].name);
  const max = Math.max(1, Math.min(product.stock, 99));
  const soldOut = product.stock <= 0 || !product.isAvailable;

  const selectColor = (colorName: string) => {
    setSelectedColor(colorName);
    if (isSphinx || isFrog) {
      const urls = getColorImages(product, colorName, colors).map((image) => image.url);
      window.dispatchEvent(new CustomEvent("product-color-images", { detail: { urls } }));
    }
  };

  return <div className="space-y-4">
    {(isSphinx || isFrog) && <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Цвет</div>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const selected = selectedColor === color.name;
          return <button key={color.name} type="button" onClick={() => selectColor(color.name)} aria-pressed={selected} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-all ${selected ? "bg-bg2 ring-green" : "bg-bg2/40 ring-line/60 hover:ring-line"}`}>
            <span aria-hidden="true" className="h-4 w-4 rounded-full ring-1 ring-white/20" style={{ backgroundColor: color.value }} />{color.name}
          </button>;
        })}
      </div>
    </div>}
    <div className="flex items-center gap-3">
      <div className="flex h-14 items-center rounded-full bg-card ring-1 ring-line/60">
        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={soldOut || qty <= 1} className="flex h-14 w-14 items-center justify-center text-xl disabled:text-line" aria-label="Уменьшить">−</button>
        <span className="w-8 text-center text-base font-bold tabular-nums">{qty}</span>
        <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={soldOut || qty >= max} className="flex h-14 w-14 items-center justify-center text-xl disabled:text-line" aria-label="Увеличить">+</button>
      </div>
      <div className="flex-1"><AddToCartButton product={product} quantity={qty} variantName={(isSphinx || isFrog) ? selectedColor : undefined} variantImageUrl={(isSphinx || isFrog) ? getColorImage(product, selectedColor, colors) : undefined} /></div>
    </div>
    <p className="text-xs text-muted">{soldOut ? "Сейчас этой фигурки нет. Напиши нам — сообщим, когда напечатаем." : product.stock <= 3 ? `Осталось ${product.stock} шт. — печатаем небольшими партиями.` : "Отправляем в течение 1–3 дней после оплаты."}</p>
  </div>;
}
