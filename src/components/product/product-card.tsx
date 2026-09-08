import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { ProductWithRelations } from "@/lib/data";
import { getMainImage } from "@/lib/images";
import { AddToCartButton } from "./add-to-cart-button";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductWithRelations;
  priority?: boolean;
}) {
  const img = getMainImage(product);
  const soldOut = product.stock <= 0;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-line/60 transition-all duration-500 md:hover:-translate-y-1 md:hover:ring-line">
      <Link href={`/product/${product.slug}`} className="relative block aspect-square shrink-0 overflow-hidden bg-bg2">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt || product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out md:group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">Фото скоро</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/60 via-transparent to-transparent opacity-0 transition-opacity duration-500 md:group-hover:opacity-100" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {product.isNew && <span className="rounded-full bg-pink/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-bg">Новинка</span>}
          {soldOut && <span className="rounded-full bg-bg/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted backdrop-blur">Нет в наличии</span>}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {product.category?.name ?? "Фигурка"}
        </div>

        {/* Фикс-слот названия: ровно 2 строки с фиксированной высотой на мобильных и десктопе */}
        <div className="mt-1.5 h-10 sm:h-12">
          <Link href={`/product/${product.slug}`} className="line-clamp-2 text-base font-bold leading-tight sm:text-lg">
            <span className="absolute inset-0 z-0" aria-hidden />
            {product.name}
          </Link>
        </div>

        {/* Фикс-слот описания: ровно 2 строки с фиксированной высотой */}
        <div className="mt-1.5 h-10">
          {product.shortDescription ? (
            <p className="line-clamp-2 text-sm leading-5 text-muted">{product.shortDescription}</p>
          ) : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold tracking-tight">{formatPrice(product.price)}</span>
            {product.oldPrice && product.oldPrice > product.price && <span className="text-sm text-muted line-through">{formatPrice(product.oldPrice)}</span>}
          </div>
          <div className="relative z-10">
            <AddToCartButton product={product} compact />
          </div>
        </div>
      </div>
    </article>
  );
}
