import { db } from "@/db";
import { categories, products, productImages, siteSettings } from "@/db/schema";
import { SETTING_KEYS } from "./constants";
import { eq, sql } from "drizzle-orm";

/**
 * Демо-данные для первого запуска. Всё это редактируется в админ-панели,
 * seed выполняется только один раз (пока таблица товаров пуста).
 */
let seedPromise: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seed().catch((e) => {
      seedPromise = null;
      console.error("Seed failed", e);
    });
  }
  return seedPromise;
}

async function seed() {
  // A newly provisioned PostgreSQL database is completely empty. Create the
  // base schema before applying incremental compatibility changes or seeding.
  await ensureSchema();

  // Production DB may predate the color-variant feature. Apply this tiny,
  // idempotent schema change before any relational product query runs.
  await db.execute(sql`ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "color_variant" text`);
  // То же для ИНН покупателя в заказах (checkout юрлиц/ИП).
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inn" text DEFAULT '' NOT NULL`);
  // Интеграция Почты России: вес товара для тарификации, индекс и трек-номер заказа.
  await db.execute(sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_grams" integer DEFAULT 150 NOT NULL`);
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "postcode" text DEFAULT '' NOT NULL`);
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_number" text`);

  const [flag] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, SETTING_KEYS.seeded));
  if (flag?.value === "1") return;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products);
  if (count > 0) {
    await setSetting(SETTING_KEYS.seeded, "1");
    return;
  }

  const cats = await db
    .insert(categories)
    .values([
      {
        name: "Антистресс",
        slug: "antistress",
        description: "Фигурки, которые приятно держать в руках.",
        imageUrl: "/images/products/dinozavr.jpg",
        sortOrder: 1,
      },
      {
        name: "Подвижные",
        slug: "podvizhnye",
        description: "Гибкие персонажи с движущимися частями.",
        imageUrl: "/images/products/kot-sfinks.jpg",
        sortOrder: 2,
      },
      {
        name: "Кликеры",
        slug: "klikery",
        description: "Маленькие, щёлкают, успокаивают.",
        imageUrl: "/images/products/kot-kaktus.jpg",
        sortOrder: 3,
        showOnHome: false,
      },
      {
        name: "Подарки",
        slug: "podarki",
        description: "Когда хочется подарить что-то необычное.",
        imageUrl: "/images/products/aksolotl.jpg",
        sortOrder: 4,
      },
    ])
    .returning();

  const byslug = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  const items = [
    {
      name: "Кот-сфинкс",
      slug: "kot-sfinks",
      shortDescription: "Подвижная фигурка",
      description:
        "Сфинкс с характером. Сегментированное тело гнётся в любую сторону, хвост закручивается, голова поворачивается. Сидит на столе, лежит в ладони, висит на краю монитора — как захочешь.",
      price: 1490,
      categoryId: byslug["podvizhnye"],
      specifications: {
        size: "14 см в длину",
        material: "PLA-пластик",
        weight: "48 г",
        color: "Шалфей",
        features: "Подвижные сегменты, поворотная голова, печать одной деталью",
      },
      weightGrams: 100,
      stock: 12,
      isFeatured: true,
      isNew: false,
      popularity: 100,
      sortOrder: 1,
      image: "/images/products/kot-sfinks.jpg",
    },
    {
      name: "Лягушка",
      slug: "lyagushka",
      shortDescription: "Подвижная фигурка",
      description:
        "Спокойная, чуть ироничная лягушка. Лапы сгибаются, спина изгибается, взгляд — как будто она всё про тебя знает. Удобно крутить в руках, когда думаешь.",
      price: 790,
      categoryId: byslug["podvizhnye"],
      specifications: {
        size: "9 см",
        material: "PLA-пластик",
        weight: "26 г",
        color: "Пыльная роза",
        features: "Гибкие лапы и спина",
      },
      weightGrams: 80,
      stock: 20,
      isFeatured: true,
      isNew: false,
      popularity: 90,
      sortOrder: 2,
      image: "/images/products/lyagushka.jpg",
    },
    {
      name: "Динозавр",
      slug: "dinozavr",
      shortDescription: "Антистресс",
      description:
        "Гибкий динозавр, который выдерживает бесконечные сгибания. Хвост и позвоночник собраны из десятков сегментов — руки сами тянутся его крутить.",
      price: 990,
      categoryId: byslug["antistress"],
      specifications: {
        size: "16 см",
        material: "PLA-пластик",
        weight: "52 г",
        color: "Мята / крем",
        features: "Гибкий хвост, двухцветная печать",
      },
      weightGrams: 100,
      stock: 8,
      isFeatured: true,
      isNew: false,
      popularity: 85,
      sortOrder: 3,
      image: "/images/products/dinozavr.jpg",
    },
    {
      name: "Кот-кактус",
      slug: "kot-kaktus",
      shortDescription: "Кликер",
      description:
        "Помещается в кулак. Щёлкает. Цветок на голове — съёмный. Идеальная штука для кармана, стола и любой очереди.",
      price: 590,
      categoryId: byslug["klikery"],
      specifications: {
        size: "6 см",
        material: "PLA-пластик",
        weight: "18 г",
        color: "Олива / розовый",
        features: "Кликер, съёмный цветок",
      },
      weightGrams: 60,
      stock: 30,
      isFeatured: true,
      isNew: true,
      popularity: 80,
      sortOrder: 4,
      image: "/images/products/kot-kaktus.jpg",
    },
    {
      name: "Аксолотль",
      slug: "aksolotl",
      shortDescription: "Подарок с характером",
      description:
        "Аксолотль, который умеет улыбаться всем телом. Гибкий, лёгкий, с жабрами-лепестками. Упаковываем в крафтовую коробку — можно дарить сразу.",
      price: 1290,
      categoryId: byslug["podarki"],
      specifications: {
        size: "15 см",
        material: "PLA-пластик",
        weight: "44 г",
        color: "Лаванда / розовый",
        features: "Гибкое тело, подарочная упаковка",
      },
      weightGrams: 100,
      stock: 6,
      isFeatured: false,
      isNew: true,
      popularity: 70,
      sortOrder: 5,
      image: "/images/products/aksolotl.jpg",
    },
    {
      name: "Осьминог",
      slug: "osminog",
      shortDescription: "Подвижная фигурка",
      description:
        "Восемь щупалец — восемь поводов не выпускать его из рук. Каждое щупальце гнётся отдельно, фигурка держится на любом краю.",
      price: 1190,
      categoryId: byslug["podvizhnye"],
      specifications: {
        size: "12 см",
        material: "PLA-пластик",
        weight: "40 г",
        color: "Глубокий бирюзовый",
        features: "8 подвижных щупалец",
      },
      weightGrams: 100,
      stock: 0,
      isFeatured: false,
      isNew: true,
      isAvailable: true,
      popularity: 60,
      sortOrder: 6,
      image: "/images/products/osminog.jpg",
    },
  ];

  for (const it of items) {
    const { image, ...data } = it;
    const [p] = await db.insert(products).values(data).returning();
    await db.insert(productImages).values([
      { productId: p.id, url: image, kind: "main", alt: it.name, sortOrder: 0 },
      { productId: p.id, url: "/images/site/macro.jpg", kind: "hand", alt: `${it.name} — в руке`, sortOrder: 10 },
    ]);
  }

  await setSetting(SETTING_KEYS.heroProductSlug, "kot-sfinks");
  await setSetting(SETTING_KEYS.viewerProductSlug, "dinozavr");
  await setSetting(SETTING_KEYS.tactileImageUrl, "/images/site/macro.jpg");
  await setSetting(
    SETTING_KEYS.processImages,
    JSON.stringify([
      "/images/site/process-model.jpg",
      "/images/site/process-model.jpg",
      "/images/site/process-print.jpg",
      "/images/site/process-assembly.jpg",
      "/images/products/kot-sfinks.jpg",
    ])
  );
  await setSetting(SETTING_KEYS.contactTelegram, "https://t.me/taktilno");
  await setSetting(SETTING_KEYS.contactVk, "https://vk.com/taktilno");
  await setSetting(SETTING_KEYS.contactEmail, "hello@taktilno.ru");
  await setSetting(SETTING_KEYS.seeded, "1");
}

async function ensureSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "categories" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "description" text DEFAULT '' NOT NULL,
      "image_url" text,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "show_on_home" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "products" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "short_description" text DEFAULT '' NOT NULL,
      "description" text DEFAULT '' NOT NULL,
      "price" integer NOT NULL,
      "old_price" integer,
      "category_id" integer REFERENCES "categories"("id") ON DELETE SET NULL,
      "specifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "stock" integer DEFAULT 0 NOT NULL,
      "weight_grams" integer DEFAULT 150 NOT NULL,
      "is_featured" boolean DEFAULT false NOT NULL,
      "is_new" boolean DEFAULT false NOT NULL,
      "is_available" boolean DEFAULT true NOT NULL,
      "popularity" integer DEFAULT 0 NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "seo_title" text,
      "seo_description" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "product_images" (
      "id" serial PRIMARY KEY,
      "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "url" text NOT NULL,
      "kind" text DEFAULT 'main' NOT NULL,
      "alt" text DEFAULT '' NOT NULL,
      "color_variant" text,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "media_id" integer,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "media" (
      "id" serial PRIMARY KEY,
      "filename" text NOT NULL,
      "mime_type" text NOT NULL,
      "size" integer NOT NULL,
      "data" bytea NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "reviews" (
      "id" serial PRIMARY KEY,
      "product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
      "author_name" text NOT NULL,
      "text" text NOT NULL,
      "rating" integer DEFAULT 5 NOT NULL,
      "photo_url" text,
      "is_visible" boolean DEFAULT true NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "orders" (
      "id" serial PRIMARY KEY,
      "number" text NOT NULL UNIQUE,
      "customer_name" text NOT NULL,
      "phone" text NOT NULL,
      "email" text NOT NULL,
      "city" text NOT NULL,
      "delivery_method" text NOT NULL,
      "postcode" text DEFAULT '' NOT NULL,
      "address" text DEFAULT '' NOT NULL,
      "comment" text DEFAULT '' NOT NULL,
      "inn" text DEFAULT '' NOT NULL,
      "tracking_number" text,
      "subtotal" integer NOT NULL,
      "delivery_cost" integer DEFAULT 0 NOT NULL,
      "total" integer NOT NULL,
      "status" text DEFAULT 'new' NOT NULL,
      "payment_status" text DEFAULT 'pending' NOT NULL,
      "payment_provider" text DEFAULT 'none' NOT NULL,
      "payment_id" text,
      "payment_url" text,
      "promo_code" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "order_items" (
      "id" serial PRIMARY KEY,
      "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "price" integer NOT NULL,
      "quantity" integer NOT NULL,
      "image_url" text
    );

    CREATE TABLE IF NOT EXISTS "site_settings" (
      "key" text PRIMARY KEY,
      "value" text DEFAULT '' NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category_id");
    CREATE INDEX IF NOT EXISTS "product_images_product_idx" ON "product_images" ("product_id");
  `);
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(siteSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
