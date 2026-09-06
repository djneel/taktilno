import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/data";
import { SITE_URL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/about`, priority: 0.5 },
    { url: `${SITE_URL}/delivery`, priority: 0.5 },
    { url: `${SITE_URL}/contacts`, priority: 0.5 },
    ...categories.map((c) => ({ url: `${SITE_URL}/catalog?category=${c.slug}`, priority: 0.7 })),
    ...products.map((p) => ({ url: `${SITE_URL}/product/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
  ];
}
