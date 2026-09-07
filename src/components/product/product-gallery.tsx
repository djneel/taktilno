"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ProductImage } from "@/db/schema";
import { IMAGE_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [visible, setVisible] = useState(images);
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisible(images); setActive(0); }, [images]);

  useEffect(() => {
    const onColor = (e: Event) => {
      const urls = (e as CustomEvent<{ urls?: string[] }>).detail?.urls ?? [];
      if (!urls.length) return;
      const next = images.filter((img) => urls.includes(img.url));
      if (!next.length) return;
      setVisible(next);
      setActive(0);
      requestAnimationFrame(() => track.current?.scrollTo({ left: 0, behavior: "smooth" }));
    };
    window.addEventListener("product-color-images", onColor);
    return () => window.removeEventListener("product-color-images", onColor);
  }, [images]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [visible]);

  const go = (i: number) => {
    setActive(i);
    track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  };

  if (!visible.length) return <div className="flex aspect-square items-center justify-center rounded-3xl bg-card text-muted">Фотографии скоро появятся</div>;

  return <div className="md:sticky md:top-24">
    <div className="relative overflow-hidden rounded-3xl bg-bg2 ring-1 ring-line/60">
      <div ref={track} className="flex snap-x-mandatory overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none" }}>
        {visible.map((img, i) => <div key={img.id} className="snap-item relative aspect-square w-full shrink-0"><Image src={img.url} alt={img.alt || `${name} — ${IMAGE_KIND_LABELS[img.kind]}`} fill priority={i === 0} loading={i === 0 ? "eager" : "lazy"} sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" /></div>)}
      </div>
      {visible.length > 1 && <>
        <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 md:hidden">{visible.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full bg-fg transition-all", i === active ? "w-5 opacity-100" : "w-1.5 opacity-40")} />)}</div>
        <div className="absolute left-3 top-3 rounded-full bg-bg/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-fg backdrop-blur">{IMAGE_KIND_LABELS[visible[active]?.kind ?? "main"]}</div>
        <button type="button" onClick={() => go((active - 1 + visible.length) % visible.length)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-fg backdrop-blur md:flex" aria-label="Предыдущее фото">←</button>
        <button type="button" onClick={() => go((active + 1) % visible.length)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-fg backdrop-blur md:flex" aria-label="Следующее фото">→</button>
      </>}
    </div>
    {visible.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">{visible.map((img, i) => <button key={img.id} type="button" onClick={() => go(i)} className={cn("relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 sm:h-20 sm:w-20", i === active ? "ring-green" : "ring-transparent opacity-60 hover:opacity-100")} aria-label={`Фото ${i + 1}`}><Image src={img.url} alt="" fill sizes="80px" className="object-cover" /></button>)}</div>}
  </div>;
}
