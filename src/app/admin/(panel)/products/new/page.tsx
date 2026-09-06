import { getCategories } from "@/lib/data";
import { ProductForm } from "@/components/admin/product-form";
import { PageTitle } from "@/components/admin/ui";

export default async function NewProductPage() {
  const categories = await getCategories(false);
  return (
    <>
      <PageTitle title="Новый товар" />
      <p className="mb-6 -mt-3 text-sm text-muted">Сначала сохраните товар — после этого появится раздел загрузки фотографий.</p>
      <ProductForm product={null} categories={categories} />
    </>
  );
}
