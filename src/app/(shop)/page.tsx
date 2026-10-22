import type { Metadata } from "next";
import {
  getFeaturedProducts,
  getHomeCategories,
  getProductBySlug,
  getProcessImages,
  getSettings,
  getVisibleReviews,
} from "@/lib/data";
import { SETTING_KEYS } from "@/lib/constants";
import {
  Categories,
  Featured,
  FinalCta,
  Hero,
  Look360,
  Marquee,
  Process,
  Reviews,
  Tactile,
} from "@/components/home/sections";

export const metadata: Metadata = {
  title: { absolute: "ТАКТИЛЬНО — 3D-фигурки, которые хочется трогать" },
  description: "Подвижные 3D-фигурки, антистрессы и необычные подарки. Магазин ТАКТИЛЬНО.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const settings = await getSettings();
  const [featured, categories, reviews, heroProduct, viewerProduct] = await Promise.all([
    getFeaturedProducts(4),
    getHomeCategories(),
    getVisibleReviews(6),
    settings[SETTING_KEYS.heroProductSlug]
      ? getProductBySlug(settings[SETTING_KEYS.heroProductSlug])
      : Promise.resolve(undefined),
    settings[SETTING_KEYS.viewerProductSlug]
      ? getProductBySlug(settings[SETTING_KEYS.viewerProductSlug])
      : Promise.resolve(undefined),
  ]);

  const hero = heroProduct ?? featured[0] ?? null;
  const viewer = viewerProduct ?? featured[1] ?? featured[0] ?? null;

  return (
    <>
      <Hero product={hero} imageUrl={settings[SETTING_KEYS.heroImageUrl] || null} />
      <Marquee />
      <Featured products={featured} />
      <Tactile imageUrl={settings[SETTING_KEYS.tactileImageUrl] || null} />
      <Categories categories={categories} />
      <Look360 product={viewer} />
      <Process images={getProcessImages(settings)} />
      <Reviews reviews={reviews} />
      <FinalCta />
    </>
  );
}
