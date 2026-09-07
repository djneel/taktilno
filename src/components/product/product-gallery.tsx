"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ProductImage } from "@/db/schema";
import { IMAGE_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setActive((prev) => (prev === i ? prev : i));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const onColorImage = (event: Event) => {
      const url = (event as CustomEvent<{ url?: string | null }>).detail?.url;
      if (!url) return;
      const index = images.findIndex((image) => image.url === url);
      if (index < 0) return;
      setActive(index);
      const el = trackRef.current;
      if (el) el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    };
    window.addEventListener("product-color-image", onColorImage);
    return () => window.removeEventListener("product-color-image", onColorImage);
  }, [images]);

  const goTo = (i: number) => {
    setActive(i);
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  if (!images.length) {
    return <div className="flex aspect-square items-center justify-center rounded-3xl bg-card text-muted">Фотографии скоро появятся</div>;
  }

  return (
    <div className="md:sticky md:top-24">
      <div className="relative overflow-hidden rounded-3xl bg-bg2 ring-1 ring-line/60">
        <div ref={trackRef} className="flex snap-x-mandatory overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none" }}>
          {images.map((img, i) => (
            <div key={img.id} className="snap-item relative aspect-square w-full shrink-0">
              <Image src={img.url} alt={img.alt || `${name} — ${IMAGE_KIND_LABELS[img.kind]}`} fill priority={i === 0} loading={i === 0 ? "eager" : "lazy"} sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 md:hidden">
              {images.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full bg-fg transition-all", i === active ? "w-5 opacity-100" : "w-1.5 opacity-40")} />)}
            </div>
            <div className="absolute left-3 top-3 rounded-full bg-bg/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-fg backdrop-blur">{IMAGE_KIND_LABELS[images[active]?.kind ?? "main"]}</div>
            <button type="button" onClick={() => goTo((active - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-fg backdrop-blur transition-colors hover:bg-bg md:flex" aria-label="Предыдущее фото">←</button>
            <button type="button" onClick={() => goTo((active + 1) % images.length)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-fg backdrop-blur transition-colors hover:bg-bg md:flex" aria-label="Следующее фото">→</button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => goTo(i)} className={cn("relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition-all sm:h-20 sm:w-20", i === active ? "ring-green" : "ring-transparent opacity-60 hover:opacity-100")} aria-label={`Фото ${i + 1}: ${IMAGE_KIND_LABELS[img.kind]}`}>
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
