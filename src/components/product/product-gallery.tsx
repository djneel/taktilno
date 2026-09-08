"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ProductImage } from "@/db/schema";
import { IMAGE_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [colorUrls, setColorUrls] = useState<string[] | null>(null);
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const filtered = colorUrls ? images.filter((img) => colorUrls.includes(img.url)) : [];
  const visible = filtered.length > 0 ? filtered : images;

  useEffect(() => {
    const onColor = (e: Event) => {
      const urls = (e as CustomEvent<{ urls?: string[] }>).detail?.urls ?? [];
      setColorUrls(urls.length > 0 ? urls : null);
      setActive(0);
      if (track.current) track.current.scrollTo({ left: 0, behavior: "smooth" });
    };
    window.addEventListener("product-color-images", onColor);
    return () => window.removeEventListener("product-color-images", onColor);
  }, []);

  const go = (i: number) => {
    if (!visible.length) return;
    const target = Math.max(0, Math.min(i, visible.length - 1));
    setActive(target);
    if (track.current) {
      track.current.scrollTo({
        left: target * (track.current?.clientWidth ?? 0),
        behavior: "smooth",
      });
    }
  };

  const onScroll = () => {
    if (!track.current || track.current.clientWidth === 0) return;
    const index = Math.round(track.current.scrollLeft / track.current.clientWidth);
    if (index >= 0 && index < visible.length && index !== active) {
      setActive(index);
    }
  };

  if (!visible.length) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-3xl bg-card text-muted ring-1 ring-line/60">
        Фотографии скоро появятся
      </div>
    );
  }

  const currentImg = visible[active] ?? visible[0];

  return (
    <div className="w-full min-w-0 max-w-full md:sticky md:top-24">
      {/* Главное фото с фиксированной квадратной пропорцией и стрелками */}
      <div className="relative aspect-square w-full min-w-0 overflow-hidden rounded-3xl bg-bg2 ring-1 ring-line/60">
        <div
          ref={track}
          onScroll={onScroll}
          className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
        >
          {visible.map((img, i) => (
            <div key={img.id} className="relative h-full w-full min-w-full shrink-0 snap-start">
              <Image
                src={img.url}
                alt={img.alt || `${name} — ${IMAGE_KIND_LABELS[img.kind]}`}
                fill
                priority={i === 0}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 55vw"
              />
            </div>
          ))}
        </div>

        {/* Бейдж типа фото / Главное */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-1.5">
          <span className="rounded-full bg-bg/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fg backdrop-blur ring-1 ring-line/60">
            {currentImg.kind === "main" ? "Главное" : IMAGE_KIND_LABELS[currentImg.kind] || "Фото"}
          </span>
        </div>

        {/* Счётчик фото */}
        {visible.length > 1 && (
          <div className="pointer-events-none absolute right-3 top-3 z-10">
            <span className="rounded-full bg-bg/70 px-2.5 py-1 text-[10px] font-bold text-fg backdrop-blur ring-1 ring-line/60">
              {active + 1} / {visible.length}
            </span>
          </div>
        )}

        {/* Кнопки перелистывания влево и вправо на фото */}
        {visible.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(active === 0 ? visible.length - 1 : active - 1)}
              className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-sm font-bold text-fg backdrop-blur transition-all hover:bg-bg hover:scale-105 active:scale-95 ring-1 ring-line/60"
              aria-label="Предыдущее фото"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => go(active === visible.length - 1 ? 0 : active + 1)}
              className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-sm font-bold text-fg backdrop-blur transition-all hover:bg-bg hover:scale-105 active:scale-95 ring-1 ring-line/60"
              aria-label="Следующее фото"
            >
              →
            </button>
          </>
        )}
      </div>

      {/* Горизонтальная лента миниатюр с изолированной прокруткой */}
      {visible.length > 1 && (
        <div className="mt-3 w-full min-w-0 max-w-full overflow-hidden">
          <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 no-scrollbar">
            {visible.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => go(i)}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition-all sm:h-20 sm:w-20",
                  i === active ? "ring-green opacity-100" : "ring-transparent opacity-60 hover:opacity-100"
                )}
                aria-label={`Фото ${i + 1}`}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
