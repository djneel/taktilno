import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getProductById } from "@/lib/data";
import { sortImages } from "@/lib/images";
import { ProductForm } from "@/components/admin/product-form";
import { ImageManager } from "@/components/admin/image-manager";
import { Card, PageTitle } from "@/components/admin/ui";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const product = await getProductById(Number(id));
  if (!product) notFound();
  const categories = await getCategories(false);

  return (
    <>
      <div className="mb-4 text-sm text-muted">
        <Link href="/admin/products" className="hover:text-fg">← Товары</Link>
      </div>
      <PageTitle title={product.name} />
      {saved && <div className="mb-4 rounded-2xl bg-green/10 px-4 py-3 text-sm text-green">Сохранено. Изменения уже на сайте.</div>}

      <Card className="mb-4">
        <h2 className="mb-1 text-lg font-bold">Изображения</h2>
        <p className="mb-4 text-sm text-muted">
          Главное фото показывается в каталоге, на главной и в корзине. Остальные — в галерее товара в заданном порядке.
          Для 360° загрузите серию кадров с типом «Кадр 360°».
        </p>
        <ImageManager productId={product.id} images={sortImages(product.images)} />
      </Card>

      <ProductForm product={product} categories={categories} />
    </>
  );
}
