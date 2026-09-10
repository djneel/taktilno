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
  // Production DB may predate the color-variant feature. Apply this tiny,
  // idempotent schema change before any relational product query runs.
  await db.execute(sql`ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "color_variant" text`);
  // То же для ИНН покупателя в заказах (checkout юрлиц/ИП).
  await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inn" text DEFAULT '' NOT NULL`);

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

export async function setSetting(key: string, value: string) {
  await db
    .insert(siteSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
