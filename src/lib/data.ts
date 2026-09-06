import { db } from "@/db";
import {
  categories,
  products,
  reviews,
  siteSettings,
  type Category,
  type Product,
  type ProductImage,
  type Review,
} from "@/db/schema";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { ensureSeeded } from "./seed";
import { SETTING_KEYS } from "./constants";

export type ProductWithRelations = Product & {
  images: ProductImage[];
  category: Category | null;
};

export type ReviewWithProduct = Review & { product: Product | null };

export { getMainImage, sortImages } from "./images";

/* ---------- Категории ---------- */
export async function getCategories(onlyActive = true) {
  await ensureSeeded();
  return db.query.categories.findMany({
    where: onlyActive ? eq(categories.isActive, true) : undefined,
    orderBy: [asc(categories.sortOrder), asc(categories.id)],
  });
}

export async function getHomeCategories() {
  await ensureSeeded();
  return db.query.categories.findMany({
    where: and(eq(categories.isActive, true), eq(categories.showOnHome, true)),
    orderBy: [asc(categories.sortOrder), asc(categories.id)],
  });
}

/* ---------- Товары ---------- */
export type CatalogSort = "popular" | "price_asc" | "price_desc" | "new";

export async function getProducts(opts: {
  category?: string;
  q?: string;
  sort?: CatalogSort;
  onlyAvailable?: boolean;
  onlyFeatured?: boolean;
  onlyNew?: boolean;
  limit?: number;
} = {}): Promise<ProductWithRelations[]> {
  await ensureSeeded();
  const conds: SQL[] = [];
  if (opts.onlyAvailable !== false) conds.push(eq(products.isAvailable, true));
  if (opts.onlyFeatured) conds.push(eq(products.isFeatured, true));
  if (opts.onlyNew) conds.push(eq(products.isNew, true));
  if (opts.category) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.slug, opts.category),
    });
    if (!cat) return [];
    conds.push(eq(products.categoryId, cat.id));
  }
  if (opts.q?.trim()) {
    const pattern = `%${opts.q.trim()}%`;
    conds.push(
      or(
        ilike(products.name, pattern),
        ilike(products.shortDescription, pattern),
        ilike(products.description, pattern)
      )!
    );
  }

  const orderBy = (() => {
    switch (opts.sort) {
      case "price_asc":
        return [asc(products.price), asc(products.id)];
      case "price_desc":
        return [desc(products.price), asc(products.id)];
      case "new":
        return [desc(products.isNew), desc(products.createdAt)];
      default:
        return [desc(products.popularity), asc(products.sortOrder), asc(products.id)];
    }
  })();

  return db.query.products.findMany({
    where: conds.length ? and(...conds) : undefined,
    with: { images: true, category: true },
    orderBy,
    limit: opts.limit,
  });
}

export async function getProductBySlug(slug: string) {
  await ensureSeeded();
  return db.query.products.findFirst({
    where: eq(products.slug, slug),
    with: { images: true, category: true },
  });
}

export async function getProductById(id: number) {
  return db.query.products.findFirst({
    where: eq(products.id, id),
    with: { images: true, category: true },
  });
}

export async function getFeaturedProducts(limit = 4) {
  return getProducts({ onlyFeatured: true, limit, sort: "popular" });
}

/* ---------- Отзывы ---------- */
export async function getVisibleReviews(limit = 6): Promise<ReviewWithProduct[]> {
  await ensureSeeded();
  return db.query.reviews.findMany({
    where: eq(reviews.isVisible, true),
    with: { product: true },
    orderBy: [asc(reviews.sortOrder), desc(reviews.createdAt)],
    limit,
  });
}

/* ---------- Настройки ---------- */
export async function getSettings(): Promise<Record<string, string>> {
  await ensureSeeded();
  const rows = await db.select().from(siteSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function getProcessImages(settings: Record<string, string>): string[] {
  try {
    const arr = JSON.parse(settings[SETTING_KEYS.processImages] || "[]");
    if (Array.isArray(arr)) return arr.map(String);
  } catch {}
  return [];
}

export async function countProducts() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products);
  return count;
}
