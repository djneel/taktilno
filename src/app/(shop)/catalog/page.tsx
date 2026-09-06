import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getCategories, getProducts, type CatalogSort } from "@/lib/data";
import { ProductCard } from "@/components/product/product-card";
import { CatalogFilters } from "@/components/catalog/catalog-filters";

export const metadata: Metadata = {
  title: "Каталог фигурок",
  description:
    "Все подвижные 3D-фигурки, антистрессы, кликеры и подарки ТАКТИЛЬНО. Фильтры по категориям, поиск и сортировка.",
  alternates: { canonical: "/catalog" },
  openGraph: { title: "Каталог — ТАКТИЛЬНО", description: "Все фигурки ТАКТИЛЬНО в одном месте." },
};

type SP = { category?: string; sort?: string; q?: string; featured?: string };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sort = (["popular", "price_asc", "price_desc", "new"].includes(sp.sort ?? "")
    ? sp.sort
    : "popular") as CatalogSort;

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({
      category: sp.category,
      q: sp.q,
      sort,
      onlyFeatured: sp.featured === "1",
    }),
  ]);

  const activeCat = categories.find((c) => c.slug === sp.category);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 md:pt-14 lg:px-8">
      <div className="mb-8 md:mb-12">
        <h1 className="heading text-5xl sm:text-6xl lg:text-7xl">
          {activeCat ? activeCat.name : sp.featured === "1" ? "Хиты" : "Каталог"}
          <span className="text-green">.</span>
        </h1>
        <p className="mt-3 max-w-lg text-muted">
          {activeCat?.description ||
            (sp.q ? `Результаты по запросу «${sp.q}»` : "Все персонажи ТАКТИЛЬНО. Выбирай того, кого захочется взять в руки.")}
        </p>
      </div>

      <Suspense>
        <CatalogFilters categories={categories} total={products.length} />
      </Suspense>

      {products.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center">
          <div className="heading text-2xl">Ничего не нашлось</div>
          <p className="mt-2 text-muted">Попробуй другой запрос или посмотри весь каталог.</p>
          <Link href="/catalog" className="mt-6 inline-flex h-12 items-center rounded-full bg-fg px-6 text-sm font-bold text-bg">
            Весь каталог
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
