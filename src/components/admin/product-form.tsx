import type { Category, Product } from "@/db/schema";
import { saveProductAction, deleteProductAction } from "@/lib/admin-actions";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "./ui";

const KNOWN = ["size", "material", "weight", "color", "features"];

export function ProductForm({ product, categories }: { product: Product | null; categories: Category[] }) {
  const s = product?.specifications ?? {};
  const extras = Object.entries(s).filter(([k]) => !KNOWN.includes(k));

  return (
    <form action={saveProductAction} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="space-y-4">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Основное</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Название">
              <Input name="name" required defaultValue={product?.name ?? ""} />
            </Field>
            <Field label="URL (slug)" hint="Оставьте пустым — сформируется из названия">
              <Input name="slug" defaultValue={product?.slug ?? ""} placeholder="kot-sfinks" />
            </Field>
            <Field label="Короткое описание" hint="Показывается в карточке, например «Подвижная фигурка»">
              <Input name="shortDescription" defaultValue={product?.shortDescription ?? ""} />
            </Field>
            <Field label="Категория">
              <Select name="categoryId" defaultValue={product?.categoryId ?? ""}>
                <option value="">— без категории —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Описание">
              <Textarea name="description" rows={6} defaultValue={product?.description ?? ""} />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Характеристики</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Размер"><Input name="spec_size" defaultValue={s.size ?? ""} placeholder="14 см" /></Field>
            <Field label="Материал"><Input name="spec_material" defaultValue={s.material ?? ""} placeholder="PLA-пластик" /></Field>
            <Field label="Вес"><Input name="spec_weight" defaultValue={s.weight ?? ""} placeholder="48 г" /></Field>
            <Field label="Цвет"><Input name="spec_color" defaultValue={s.color ?? ""} placeholder="Шалфей" /></Field>
          </div>
          <div className="mt-4">
            <Field label="Особенности"><Input name="spec_features" defaultValue={s.features ?? ""} placeholder="Подвижные сегменты, поворотная голова" /></Field>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Дополнительные характеристики</div>
            <div className="grid gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
                  <Input name={`extra_key_${i}`} defaultValue={extras[i]?.[0] ?? ""} placeholder="Название" />
                  <Input name={`extra_val_${i}`} defaultValue={extras[i]?.[1] ?? ""} placeholder="Значение" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">SEO</h2>
          <div className="grid gap-4">
            <Field label="SEO title" hint="Пусто — сформируется автоматически"><Input name="seoTitle" defaultValue={product?.seoTitle ?? ""} /></Field>
            <Field label="SEO description"><Textarea name="seoDescription" rows={2} defaultValue={product?.seoDescription ?? ""} /></Field>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Цена и наличие</h2>
          <div className="grid gap-4">
            <Field label="Цена, ₽"><Input name="price" type="number" min={0} step={1} required defaultValue={product?.price ?? ""} inputMode="numeric" /></Field>
            <Field label="Старая цена, ₽" hint="Для скидки. 0 — нет скидки"><Input name="oldPrice" type="number" min={0} step={1} defaultValue={product?.oldPrice ?? 0} inputMode="numeric" /></Field>
            <Field label="Количество в наличии" hint="0 — «Нет в наличии»"><Input name="stock" type="number" min={0} step={1} defaultValue={product?.stock ?? 0} inputMode="numeric" /></Field>
            <Field label="Порядок сортировки"><Input name="sortOrder" type="number" step={1} defaultValue={product?.sortOrder ?? 0} inputMode="numeric" /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Показ на сайте</h2>
          <div className="grid gap-2">
            <Checkbox name="isAvailable" label="Показывать в каталоге" defaultChecked={product?.isAvailable ?? true} />
            <Checkbox name="isFeatured" label="Хит (блок «Начни с этих»)" defaultChecked={product?.isFeatured ?? false} />
            <Checkbox name="isNew" label="Новинка" defaultChecked={product?.isNew ?? false} />
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <Button type="submit" variant="green" className="h-12">
            {product ? "Сохранить изменения" : "Создать товар"}
          </Button>
          {product && (
            <a href={`/product/${product.slug}`} target="_blank" className="text-center text-sm text-muted hover:text-fg">
              Открыть на сайте ↗
            </a>
          )}
        </div>
      </div>

      {product && (
        <div className="lg:col-span-2">
          <button
            type="submit"
            formAction={deleteProductAction}
            formNoValidate
            className="text-sm text-pink/80 hover:text-pink"
          >
            Удалить товар
          </button>
        </div>
      )}
    </form>
  );
}
