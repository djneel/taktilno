"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ProductImage } from "@/db/schema";
import { IMAGE_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [visible, setVisible] = useState(images);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setVisible(images);
    setActive(0);
  }, [images]);

  useEffect(() => {
    const onColor = (e: Event) => {
      const urls = (e as CustomEvent<{ urls?: string[] }>).detail?.urls ?? [];
      const next = images.filter((img) => urls.includes(img.url));
      if (!next.length) return;
      setVisible(next);
      setActive(0);
    };
    window.addEventListener("product-color-images", onColor);
    return () => window.removeEventListener("product-color-images", onColor);
  }, [images]);

  if (!visible.length) {
    return <div className="aspect-square flex items-center justify-center rounded-3xl bg-card text-muted">Фотографии скоро появятся</div>;
  }

  const activeIndex = Math.min(active, visible.length - 1);
  const activeImage = visible[activeIndex];

  return (
    <div className="w-full min-w-0 md:sticky md:top-24">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-bg2 ring-1 ring-line/60">
        <Image
          key={activeImage.id}
          src={activeImage.url}
          alt={activeImage.alt || `${name} — ${IMAGE_KIND_LABELS[activeImage.kind]}`}
          fill
          priority
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 55vw"
        />
      </div>

      {visible.length > 1 && (
        <div className="mt-3 h-20 overflow-hidden">
          <div className="flex h-20 gap-2 overflow-x-auto pb-1 no-scrollbar">
            {visible.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Показать фото ${i + 1}`}
                aria-pressed={i === activeIndex}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 sm:h-20 sm:w-20",
                  i === activeIndex ? "ring-green" : "ring-transparent opacity-60",
                )}
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
