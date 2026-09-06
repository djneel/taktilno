import Image from "next/image";
import Link from "next/link";
import { db } from "@/db";
import { products } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { getMainImage } from "@/lib/images";
import { formatPrice } from "@/lib/utils";
import { Badge, Button, PageTitle } from "@/components/admin/ui";
import { toggleProductFlagAction } from "@/lib/admin-actions";

export default async function AdminProductsPage() {
  const list = await db.query.products.findMany({
    with: { images: true, category: true },
    orderBy: [asc(products.sortOrder), desc(products.createdAt)],
  });

  return (
    <>
      <PageTitle title="Товары">
        <Link href="/admin/products/new" className="inline-flex h-11 items-center rounded-full bg-green px-5 text-sm font-bold text-bg">
          + Добавить товар
        </Link>
      </PageTitle>

      <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-line/60">
        <ul className="divide-y divide-line">
          {list.map((p) => {
            const img = getMainImage(p);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <Link href={`/admin/products/${p.id}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg2">
                  {img && <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/products/${p.id}`} className="block truncate font-bold hover:text-green">
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {p.category?.name ?? "без категории"} · /product/{p.slug} · {p.images.length} фото
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.isFeatured && <Badge tone="green">Хит</Badge>}
                    {p.isNew && <Badge tone="pink">Новинка</Badge>}
                    {!p.isAvailable && <Badge>Скрыт</Badge>}
                    {p.stock === 0 && <Badge>Нет в наличии</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatPrice(p.price)}</div>
                  <div className="text-xs text-muted">остаток: {p.stock}</div>
                </div>
                <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                  <FlagToggle id={p.id} flag="isFeatured" value={!p.isFeatured} label={p.isFeatured ? "Убрать из хитов" : "В хиты"} />
                  <FlagToggle id={p.id} flag="isNew" value={!p.isNew} label={p.isNew ? "Не новинка" : "Новинка"} />
                  <FlagToggle id={p.id} flag="isAvailable" value={!p.isAvailable} label={p.isAvailable ? "Скрыть" : "Показать"} />
                </div>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-8 text-center text-muted">Товаров пока нет.</li>}
        </ul>
      </div>
    </>
  );
}

function FlagToggle({ id, flag, value, label }: { id: number; flag: string; value: boolean; label: string }) {
  return (
    <form action={toggleProductFlagAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="value" value={String(value)} />
      <Button variant="ghost" className="h-9 px-3 text-xs">{label}</Button>
    </form>
  );
}
