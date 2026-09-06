"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  media,
  orders,
  productImages,
  products,
  reviews,
  IMAGE_KINDS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type ImageKind,
  type OrderStatus,
  type PaymentStatus,
  type ProductSpecifications,
} from "@/db/schema";
import { ADMIN_COOKIE, checkPassword, createSessionToken, isAdminAuthenticated } from "./auth";
import { slugify } from "./utils";
import { setSetting } from "./seed";

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("Требуется авторизация");
}

function revalidateShop() {
  revalidatePath("/", "layout");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, def = 0) => {
  const v = Number(String(fd.get(k) ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : def;
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

/* ---------------- Auth ---------------- */
export async function loginAction(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const password = str(formData, "password");
  if (!checkPassword(password)) return { error: "Неверный пароль" };
  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https"),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

/* ---------------- Products ---------------- */
async function uniqueSlug(base: string, excludeId?: number) {
  let slug = slugify(base) || `product-${Date.now()}`;
  let i = 2;
  while (true) {
    const existing = await db.query.products.findFirst({
      where: excludeId ? and(eq(products.slug, slug), ne(products.id, excludeId)) : eq(products.slug, slug),
    });
    if (!existing) return slug;
    slug = `${slugify(base)}-${i++}`;
  }
}

function specsFrom(fd: FormData): ProductSpecifications {
  const specs: ProductSpecifications = {
    size: str(fd, "spec_size"),
    material: str(fd, "spec_material"),
    weight: str(fd, "spec_weight"),
    color: str(fd, "spec_color"),
    features: str(fd, "spec_features"),
  };
  // Произвольные доп. характеристики: extra_key_N / extra_val_N
  for (let i = 0; i < 10; i++) {
    const k = str(fd, `extra_key_${i}`);
    const v = str(fd, `extra_val_${i}`);
    if (k && v) specs[k] = v;
  }
  return specs;
}

export async function saveProductAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id", 0);
  const name = str(formData, "name");
  if (!name) throw new Error("Название обязательно");
  const requestedSlug = str(formData, "slug") || name;
  const slug = await uniqueSlug(requestedSlug, id || undefined);
  const categoryIdRaw = num(formData, "categoryId", 0);
  const oldPriceRaw = num(formData, "oldPrice", 0);

  const data = {
    name,
    slug,
    shortDescription: str(formData, "shortDescription"),
    description: str(formData, "description"),
    price: Math.max(0, Math.round(num(formData, "price"))),
    oldPrice: oldPriceRaw > 0 ? Math.round(oldPriceRaw) : null,
    categoryId: categoryIdRaw > 0 ? categoryIdRaw : null,
    specifications: specsFrom(formData),
    stock: Math.max(0, Math.round(num(formData, "stock"))),
    isFeatured: bool(formData, "isFeatured"),
    isNew: bool(formData, "isNew"),
    isAvailable: bool(formData, "isAvailable"),
    sortOrder: Math.round(num(formData, "sortOrder")),
    seoTitle: str(formData, "seoTitle") || null,
    seoDescription: str(formData, "seoDescription") || null,
    updatedAt: new Date(),
  };

  let productId = id;
  if (id) {
    await db.update(products).set(data).where(eq(products.id, id));
  } else {
    const [p] = await db.insert(products).values(data).returning();
    productId = p.id;
  }
  revalidateShop();
  redirect(`/admin/products/${productId}?saved=1`);
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  if (!id) return;
  await db.delete(products).where(eq(products.id, id));
  revalidateShop();
  redirect("/admin/products");
}

export async function toggleProductFlagAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  const flag = str(formData, "flag") as "isFeatured" | "isNew" | "isAvailable";
  const value = bool(formData, "value");
  if (!id || !["isFeatured", "isNew", "isAvailable"].includes(flag)) return;
  await db.update(products).set({ [flag]: value, updatedAt: new Date() }).where(eq(products.id, id));
  revalidateShop();
  revalidatePath("/admin/products");
}

/* ---------------- Product images ---------------- */
export async function updateImageAction(input: { id: number; kind?: ImageKind; alt?: string }) {
  await requireAdmin();
  const patch: Partial<typeof productImages.$inferInsert> = {};
  if (input.kind && IMAGE_KINDS.includes(input.kind)) patch.kind = input.kind;
  if (typeof input.alt === "string") patch.alt = input.alt;
  await db.update(productImages).set(patch).where(eq(productImages.id, input.id));
  revalidateShop();
}

export async function setMainImageAction(input: { productId: number; imageId: number }) {
  await requireAdmin();
  // Предыдущее главное становится «спереди», выбранное — главным и первым
  await db
    .update(productImages)
    .set({ kind: "front" })
    .where(and(eq(productImages.productId, input.productId), eq(productImages.kind, "main")));
  await db.update(productImages).set({ kind: "main", sortOrder: -1 }).where(eq(productImages.id, input.imageId));
  await normalizeOrder(input.productId);
  revalidateShop();
}

export async function reorderImagesAction(input: { productId: number; ids: number[] }) {
  await requireAdmin();
  for (let i = 0; i < input.ids.length; i++) {
    await db
      .update(productImages)
      .set({ sortOrder: i })
      .where(and(eq(productImages.id, input.ids[i]), eq(productImages.productId, input.productId)));
  }
  revalidateShop();
}

export async function deleteImageAction(input: { id: number }) {
  await requireAdmin();
  const [img] = await db.delete(productImages).where(eq(productImages.id, input.id)).returning();
  if (img?.mediaId) {
    await db.delete(media).where(eq(media.id, img.mediaId));
  }
  if (img) await normalizeOrder(img.productId);
  revalidateShop();
}

async function normalizeOrder(productId: number) {
  const imgs = await db.query.productImages.findMany({
    where: eq(productImages.productId, productId),
    orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.id)],
  });
  const main = imgs.find((i) => i.kind === "main");
  const ordered = main ? [main, ...imgs.filter((i) => i.id !== main.id)] : imgs;
  for (let i = 0; i < ordered.length; i++) {
    await db.update(productImages).set({ sortOrder: i }).where(eq(productImages.id, ordered[i].id));
  }
}

/* ---------------- Categories ---------------- */
export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id", 0);
  const name = str(formData, "name");
  if (!name) return;
  const data = {
    name,
    slug: slugify(str(formData, "slug") || name) || `cat-${Date.now()}`,
    description: str(formData, "description"),
    imageUrl: str(formData, "imageUrl") || null,
    sortOrder: Math.round(num(formData, "sortOrder")),
    isActive: bool(formData, "isActive"),
    showOnHome: bool(formData, "showOnHome"),
  };
  if (id) await db.update(categories).set(data).where(eq(categories.id, id));
  else await db.insert(categories).values(data);
  revalidateShop();
  revalidatePath("/admin/categories");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  if (!id) return;
  await db.delete(categories).where(eq(categories.id, id));
  revalidateShop();
  revalidatePath("/admin/categories");
}

export async function moveCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  const dir = str(formData, "dir") === "up" ? -1 : 1;
  const all = await db.query.categories.findMany({ orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.id)] });
  const idx = all.findIndex((c) => c.id === id);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= all.length) return;
  const a = all[idx];
  const b = all[swap];
  [all[idx], all[swap]] = [b, a];
  for (let i = 0; i < all.length; i++) {
    await db.update(categories).set({ sortOrder: i + 1 }).where(eq(categories.id, all[i].id));
  }
  revalidateShop();
  revalidatePath("/admin/categories");
}

/* ---------------- Reviews ---------------- */
export async function saveReviewAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id", 0);
  const text = str(formData, "text");
  const authorName = str(formData, "authorName");
  if (!text || !authorName) return;
  const productIdRaw = num(formData, "productId", 0);
  const data = {
    authorName,
    text,
    rating: Math.min(5, Math.max(1, Math.round(num(formData, "rating", 5)))),
    productId: productIdRaw > 0 ? productIdRaw : null,
    photoUrl: str(formData, "photoUrl") || null,
    isVisible: bool(formData, "isVisible"),
    sortOrder: Math.round(num(formData, "sortOrder")),
  };
  if (id) await db.update(reviews).set(data).where(eq(reviews.id, id));
  else await db.insert(reviews).values(data);
  revalidateShop();
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews");
}

export async function toggleReviewAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  await db.update(reviews).set({ isVisible: sql`NOT ${reviews.isVisible}` }).where(eq(reviews.id, id));
  revalidateShop();
  revalidatePath("/admin/reviews");
}

export async function deleteReviewAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  await db.delete(reviews).where(eq(reviews.id, id));
  revalidateShop();
  revalidatePath("/admin/reviews");
}

/* ---------------- Orders ---------------- */
export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  const status = str(formData, "status") as OrderStatus;
  const paymentStatus = str(formData, "paymentStatus") as PaymentStatus;
  const patch: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
  if (ORDER_STATUSES.includes(status)) patch.status = status;
  if (PAYMENT_STATUSES.includes(paymentStatus)) patch.paymentStatus = paymentStatus;
  await db.update(orders).set(patch).where(eq(orders.id, id));
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}

/* ---------------- Settings ---------------- */
export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  const keys = [
    "hero_product_slug",
    "hero_image_url",
    "tactile_image_url",
    "viewer_product_slug",
    "contact_telegram",
    "contact_vk",
    "contact_email",
    "contact_phone",
  ];
  for (const k of keys) {
    if (formData.has(k)) await setSetting(k, str(formData, k));
  }
  const process: string[] = [];
  for (let i = 0; i < 5; i++) process.push(str(formData, `process_${i}`));
  await setSetting("process_images", JSON.stringify(process));
  revalidateShop();
  revalidatePath("/admin/settings");
}
