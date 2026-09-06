import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/lib/data";
import { SETTING_KEYS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "О нас",
  description: "ТАКТИЛЬНО — небольшой бренд авторских 3D-печатных фигурок. Придумываем, моделируем, печатаем и собираем сами.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const settings = await getSettings();
  const img = settings[SETTING_KEYS.tactileImageUrl];
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 md:pt-14 lg:px-8">
      <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <h1 className="heading text-5xl sm:text-6xl lg:text-7xl">
            Мы делаем то,
            <br />
            что хочется
            <br />
            <span className="text-green">трогать.</span>
          </h1>
          <div className="mt-8 space-y-4 text-base leading-relaxed text-muted sm:text-lg">
            <p>
              ТАКТИЛЬНО — небольшой бренд авторских фигурок. Мы придумываем персонажей, моделируем их
              подвижными и печатаем на 3D-принтерах слой за слоем.
            </p>
            <p>
              Каждую фигурку собираем и проверяем руками: как гнётся хвост, как поворачивается голова,
              приятно ли её держать. Если что-то не так — перепечатываем.
            </p>
            <p>Без фабрик и тиражей в тысячи штук. Небольшие партии, характерные персонажи и живой пластик.</p>
          </div>
          <Link href="/catalog" className="mt-8 inline-flex h-14 items-center rounded-full bg-fg px-7 text-sm font-bold uppercase tracking-wider text-bg md:hover:bg-green">
            Смотреть каталог →
          </Link>
        </div>
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-card ring-1 ring-line/60">
          {img && <Image src={img} alt="Фигурка ТАКТИЛЬНО в руках" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />}
        </div>
      </div>
    </div>
  );
}
