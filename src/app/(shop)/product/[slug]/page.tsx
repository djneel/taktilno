import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getProducts } from "@/lib/data";
import { getMainImage, sortImages } from "@/lib/images";
import { formatPrice } from "@/lib/utils";
import { ProductGallery } from "@/components/product/product-gallery";
import { BuyBox } from "@/components/product/buy-box";
import { ProductCard } from "@/components/product/product-card";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Товар не найден" };
  const title = product.seoTitle || `${product.name} — ${product.shortDescription || "3D-фигурка"} купить`;
  const description =
    product.seoDescription ||
    `${product.name} — ${product.shortDescription ? product.shortDescription.toLowerCase() + ". " : ""}${product.description.slice(0, 120)}… Цена ${formatPrice(product.price)}. ТАКТИЛЬНО.`;
  const img = getMainImage(product)?.url;
  return {
    title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: `${product.name} — ТАКТИЛЬНО`,
      description,
      type: "website",
      images: img ? [{ url: img }] : undefined,
    },
  };
}

const SPEC_LABELS: Record<string, string> = {
  size: "Размер",
  material: "Материал",
  weight: "Вес",
  color: "Цвет",
  features: "Особенности",
};

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.isAvailable) notFound();

  const images = sortImages(product.images);
  const specs = Object.entries(product.specifications ?? {}).filter(([, v]) => v && String(v).trim());
  const related = (
    await getProducts({ category: product.category?.slug, limit: 5 })
  )
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: images.map((i) => i.url),
    sku: product.slug,
    brand: { "@type": "Brand", name: "ТАКТИЛЬНО" },
    offers: {
      "@type": "Offer",
      priceCurrency: "RUB",
      price: product.price,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 md:pt-10 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted md:mb-8" aria-label="Хлебные крошки">
        <Link href="/" className="hover:text-fg">Главная</Link>
        <span>/</span>
        <Link href="/catalog" className="hover:text-fg">Каталог</Link>
        {product.category && (
          <>
            <span>/</span>
            <Link href={`/catalog?category=${product.category.slug}`} className="hover:text-fg">
              {product.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-fg">{product.name}</span>
      </nav>

      {/* 12-колоночная сетка с гарантированным сохранением пропорций колонок */}
      <div className="grid items-start gap-8 md:grid-cols-12 md:gap-10 lg:gap-14">
        <div className="w-full min-w-0 md:col-span-7 lg:col-span-7">
          <ProductGallery images={images} name={product.name} />
        </div>

        <div className="w-full min-w-0 md:col-span-5 lg:col-span-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            {product.category && <span>{product.category.name}</span>}
            {product.isNew && <span className="rounded-full bg-pink/15 px-2 py-0.5 text-pink">Новинка</span>}
            {product.isFeatured && <span className="rounded-full bg-green/15 px-2 py-0.5 text-green">Хит</span>}
          </div>
          <h1 className="heading mt-3 text-4xl sm:text-5xl lg:text-6xl">{product.name}</h1>
          {product.shortDescription && <p className="mt-2 text-lg text-muted">{product.shortDescription}</p>}

          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold tracking-tight sm:text-4xl">{formatPrice(product.price)}</span>
            {product.oldPrice && product.oldPrice > product.price && (
              <span className="text-lg text-muted line-through">{formatPrice(product.oldPrice)}</span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${product.stock > 0 ? "bg-green" : "bg-muted"}`} />
            <span className={product.stock > 0 ? "text-fg" : "text-muted"}>
              {product.stock > 0 ? `В наличии: ${product.stock} шт.` : "Нет в наличии"}
            </span>
          </div>

          <div className="mt-8">
            <BuyBox product={product} />
          </div>

          <div className="mt-10 space-y-8">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Описание</h2>
              <p className="mt-3 whitespace-pre-line text-base leading-relaxed">{product.description}</p>
            </div>

            {specs.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Характеристики</h2>
                <dl className="mt-3 divide-y divide-line rounded-2xl bg-card ring-1 ring-line/60">
                  {specs.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[110px_1fr] gap-4 px-4 py-3 text-sm sm:grid-cols-[140px_1fr]">
                      <dt className="text-muted">{SPEC_LABELS[k] ?? k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted">
              <div className="rounded-2xl bg-card p-3 ring-1 ring-line/60">Доставка по России</div>
              <div className="rounded-2xl bg-card p-3 ring-1 ring-line/60">Печатаем сами</div>
              <div className="rounded-2xl bg-card p-3 ring-1 ring-line/60">Проверяем подвижность</div>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="heading text-3xl sm:text-4xl">Похожие персонажи</h2>
          <div className="mt-6 grid auto-rows-fr grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
