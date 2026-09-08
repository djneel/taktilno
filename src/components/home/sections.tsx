import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/db/schema";
import type { ProductWithRelations, ReviewWithProduct } from "@/lib/data";
import { getMainImage, get360Frames } from "@/lib/images";
import { formatPrice } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";
import { ProductCard } from "@/components/product/product-card";
import { Viewer360 } from "./viewer-360";

/* ---------------- HERO ---------------- */
export function Hero({
  product,
  imageUrl,
}: {
  product: ProductWithRelations | null;
  imageUrl: string | null;
}) {
  const src = imageUrl || (product ? getMainImage(product)?.url : null) || null;
  return (
    <section className="relative overflow-hidden">
      <div className="glow-green pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] md:-right-20 md:h-[760px] md:w-[760px]" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-8 sm:px-6 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-6 md:pb-20 md:pt-16 lg:px-8">
        <div className="relative z-10 order-2 md:order-1">
          <h1 className="heading animate-fade-up text-[13vw] leading-[0.92] sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
            Фигурки,
            <br />
            которые
            <br />
            хочется
            <br />
            <span className="text-green">трогать.</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-muted sm:text-lg animate-fade-up" style={{ animationDelay: "120ms" }}>
            Подвижные 3D-фигурки, антистрессы и необычные персонажи, созданные для тех, кому мало
            просто посмотреть.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4 animate-fade-up" style={{ animationDelay: "220ms" }}>
            <Link
              href="/catalog"
              className="inline-flex h-14 items-center gap-3 rounded-full bg-fg px-7 text-sm font-bold uppercase tracking-wider text-bg transition-colors md:hover:bg-green"
            >
              Смотреть каталог <span aria-hidden>→</span>
            </Link>
            {product && (
              <Link href={`/product/${product.slug}`} className="text-sm font-semibold text-muted transition-colors hover:text-fg">
                {product.name} · {formatPrice(product.price)}
              </Link>
            )}
          </div>
        </div>

        <div className="relative order-1 md:order-2">
          <div className="relative mx-auto aspect-[4/5] w-[88%] max-w-[420px] sm:w-[70%] md:w-full md:max-w-none md:translate-x-10 lg:translate-x-16 lg:scale-110">
            <div className="glow-green absolute inset-[-15%]" />
            {src ? (
              <Link href={product ? `/product/${product.slug}` : "/catalog"} className="group absolute inset-0 block">
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] animate-float">
                  <Image
                    src={src}
                    alt={product?.name ?? "Фигурка ТАКТИЛЬНО"}
                    fill
                    priority
                    sizes="(max-width: 768px) 90vw, 50vw"
                    className="object-cover transition-transform duration-700 md:group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/50 via-transparent to-transparent" />
                </div>
              </Link>
            ) : (
              <div className="absolute inset-0 rounded-[2rem] bg-card" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- MARQUEE ---------------- */
const MARQUEE = ["3D-печать", "Подвижные фигурки", "Антистресс", "Подарки", "Тактильно"];
export function Marquee() {
  const items = [...MARQUEE, ...MARQUEE];
  return (
    <div className="border-y border-line bg-bg2 py-4 overflow-hidden" aria-hidden>
      <div className="flex w-max animate-marquee will-change-transform">
        {[0, 1].map((rep) => (
          <div key={rep} className="flex shrink-0 items-center">
            {items.map((t, i) => (
              <span key={`${rep}-${i}`} className="flex items-center whitespace-nowrap">
                <span className="heading text-lg text-fg/90 sm:text-xl">{t}</span>
                <span className="mx-6 h-1.5 w-1.5 rounded-full bg-green sm:mx-8" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- SECTION HEADING ---------------- */
export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="heading text-4xl sm:text-5xl lg:text-6xl">{title}</h2>
        {subtitle && <p className="mt-3 text-base text-muted sm:text-lg">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="inline-flex h-11 items-center text-sm font-bold uppercase tracking-wider text-green">
          {action.label} <span className="ml-2" aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}

/* ---------------- FEATURED ---------------- */
export function Featured({ products }: { products: ProductWithRelations[] }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <Reveal>
        <SectionHeading title="Начни с этих" subtitle="Самые характерные персонажи ТАКТИЛЬНО." action={{ href: "/catalog", label: "Весь каталог" }} />
      </Reveal>
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {products.map((p, i) => (
          <Reveal key={p.id} delay={i * 60} className="h-full">
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- TACTILE ---------------- */
export function Tactile({ imageUrl }: { imageUrl: string | null }) {
  const perks = [
    { title: "Подвижные", text: "Фигурки можно двигать, сгибать и менять их позу." },
    { title: "Необычные", text: "Персонажи, которые выделяются среди обычных сувениров." },
    { title: "3D-печать", text: "Каждая фигурка создаётся послойно на 3D-принтере." },
  ];
  return (
    <section className="bg-bg2">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-28 lg:px-8">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <Reveal>
            <h2 className="heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl">
              Смотришь.
              <br />
              Берёшь в руки.
              <br />
              <span className="text-pink">И уже не хочется отпускать.</span>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-card ring-1 ring-line/60 sm:aspect-square">
              {imageUrl ? (
                <Image src={imageUrl} alt="Макро-фото фигурки ТАКТИЛЬНО" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">Добавьте фото в настройках</div>
              )}
            </div>
          </Reveal>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-line sm:grid-cols-3">
          {perks.map((p, i) => (
            <Reveal key={p.title} delay={i * 80} className="bg-bg2 p-6 sm:p-8">
              <div className="text-xs font-bold text-green">0{i + 1}</div>
              <div className="heading mt-3 text-2xl">{p.title}</div>
              <p className="mt-2 text-sm text-muted sm:text-base">{p.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- CATEGORIES ---------------- */
export function Categories({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <Reveal>
        <SectionHeading title="Что тебе сегодня?" />
      </Reveal>
      <div className="grid gap-4 md:grid-cols-3">
        {categories.map((c, i) => (
          <Reveal key={c.id} delay={i * 80}>
            <Link
              href={`/catalog?category=${c.slug}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-card ring-1 ring-line/60 sm:aspect-[3/4]"
            >
              {c.imageUrl && (
                <Image
                  src={c.imageUrl}
                  alt={c.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover opacity-80 transition-transform duration-700 ease-out md:group-hover:scale-[1.06] md:group-hover:-translate-y-2"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                <div className="heading text-3xl">{c.name}</div>
                <p className="mt-2 max-w-xs text-sm text-muted">{c.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-green">
                  Смотреть <span className="transition-transform duration-300 md:group-hover:translate-x-1" aria-hidden>→</span>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 360 ---------------- */
export function Look360({ product }: { product: ProductWithRelations | null }) {
  const frames = product ? get360Frames(product.images).map((f) => ({ url: f.url, alt: f.alt || product.name })) : [];
  return (
    <section className="relative overflow-hidden bg-bg2">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:gap-16 md:py-28 lg:px-8">
        <Reveal className="order-2 md:order-1">
          <Viewer360 frames={frames} />
        </Reveal>
        <Reveal className="order-1 md:order-2" delay={80}>
          <h2 className="heading text-5xl sm:text-6xl lg:text-7xl">
            Рассмотри
            <br />
            его<span className="text-green">.</span>
          </h2>
          <p className="mt-6 text-lg text-muted">Да. Он действительно так двигается.</p>
          {product && (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={`/product/${product.slug}`}
                className="inline-flex h-13 min-h-12 items-center gap-2 rounded-full border border-line px-6 text-sm font-bold uppercase tracking-wider transition-colors md:hover:border-green md:hover:text-green"
              >
                {product.name} · {formatPrice(product.price)} <span aria-hidden>→</span>
              </Link>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- PROCESS ---------------- */
const STEPS = [
  { n: "01", title: "Идея", text: "Скетч персонажа, поиск характера и позы." },
  { n: "02", title: "3D-модель", text: "Моделируем подвижные сегменты и шарниры." },
  { n: "03", title: "Печать", text: "Слой за слоем на 3D-принтере, часы работы." },
  { n: "04", title: "Сборка", text: "Чистим, проверяем подвижность, собираем." },
  { n: "05", title: "ТАКТИЛЬНО", text: "Готово. Теперь его можно взять в руки." },
];
export function Process({ images }: { images: string[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <Reveal>
        <SectionHeading title={<>От идеи<br />до фигурки.</>} />
      </Reveal>
      <ol className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} as="li" delay={i * 90} className={i === 4 ? "col-span-2 lg:col-span-1" : ""}>
            <div className="group flex h-full flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-line/60">
              <div className="relative aspect-[4/3] overflow-hidden bg-bg2">
                {images[i] && (
                  <Image
                    src={images[i]}
                    alt={s.title}
                    fill
                    sizes="(max-width: 1024px) 50vw, 20vw"
                    className="object-cover transition-transform duration-700 md:group-hover:scale-105"
                  />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-bg/70 px-2.5 py-1 text-xs font-bold text-green backdrop-blur">
                  {s.n}
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <div className="heading text-xl">{s.title}</div>
                <p className="mt-1.5 text-sm text-muted">{s.text}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ---------------- REVIEWS ---------------- */
export function Reviews({ reviews }: { reviews: ReviewWithProduct[] }) {
  return (
    <section className="bg-bg2">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <Reveal>
          <SectionHeading title={<>Их уже трогают <span className="text-pink">❤</span></>} />
        </Reveal>
        {reviews.length === 0 ? (
          <Reveal>
            <div className="rounded-3xl border border-dashed border-line p-8 text-center text-muted">
              Первые отзывы появятся здесь после первых заказов.
            </div>
          </Reveal>
        ) : (
          <div className="-mx-4 flex snap-x-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={i * 60} className="snap-item w-[82vw] shrink-0 sm:w-auto">
                <article className="flex h-full flex-col rounded-3xl bg-card p-6 ring-1 ring-line/60">
                  <div className="text-green" aria-label={`Оценка ${r.rating} из 5`}>
                    {"★".repeat(r.rating)}
                    <span className="text-line">{"★".repeat(5 - r.rating)}</span>
                  </div>
                  <p className="mt-4 flex-1 text-base leading-relaxed">{r.text}</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bg2 ring-1 ring-line">
                      {r.photoUrl ? (
                        <Image src={r.photoUrl} alt={r.authorName} fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-bold text-muted">
                          {r.authorName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{r.authorName}</div>
                      {r.product && (
                        <Link href={`/product/${r.product.slug}`} className="truncate text-xs text-muted hover:text-green">
                          {r.product.name}
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- FINAL CTA ---------------- */
export function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="glow-pink pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 md:py-36 lg:px-8">
        <Reveal>
          <h2 className="heading text-6xl sm:text-7xl lg:text-8xl xl:text-9xl">
            Нашёл
            <br />
            своего?
          </h2>
          <Link
            href="/catalog"
            className="mt-10 inline-flex h-14 items-center gap-3 rounded-full bg-green px-8 text-sm font-bold uppercase tracking-wider text-bg transition-transform md:hover:scale-[1.03]"
          >
            Перейти в каталог <span aria-hidden>→</span>
          </Link>
          <p className="mt-5 text-sm text-muted">Доставка по России</p>
        </Reveal>
      </div>
    </section>
  );
}
