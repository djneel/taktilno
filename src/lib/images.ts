import type { ProductImage } from "@/db/schema";

/** Главное изображение товара — «main» либо первое по порядку */
export function getMainImage(p: { images: ProductImage[] }) {
  const sorted = [...p.images].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((i) => i.kind === "main") ?? sorted[0] ?? null;
}

/** Все изображения: главное первым, далее по порядку */
export function sortImages(images: ProductImage[]) {
  return [...images].sort((a, b) => {
    if (a.kind === "main" && b.kind !== "main") return -1;
    if (b.kind === "main" && a.kind !== "main") return 1;
    return a.sortOrder - b.sortOrder;
  });
}

/** Кадры для 360°-просмотра: frame360, иначе ракурсы front/side/back/top/main */
export function get360Frames(images: ProductImage[]) {
  const frames = images
    .filter((i) => i.kind === "frame360")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (frames.length >= 2) return frames;
  const order = ["front", "side", "back", "top", "main", "detail"];
  const angles = order
    .map((k) => images.find((i) => i.kind === k))
    .filter((i): i is ProductImage => Boolean(i));
  return angles.length ? angles : sortImages(images).slice(0, 1);
}
