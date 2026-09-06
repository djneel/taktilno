import { getCategories } from "@/lib/data";
import { deleteCategoryAction, moveCategoryAction, saveCategoryAction } from "@/lib/admin-actions";
import { Button, Card, Checkbox, Field, Input, PageTitle, Textarea } from "@/components/admin/ui";
import { ImageUrlField } from "@/components/admin/image-url-field";
import type { Category } from "@/db/schema";

export default async function AdminCategoriesPage() {
  const list = await getCategories(false);
  return (
    <>
      <PageTitle title="Категории" />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {list.map((c, i) => (
            <CategoryForm key={c.id} category={c} isFirst={i === 0} isLast={i === list.length - 1} />
          ))}
          {list.length === 0 && <p className="text-muted">Категорий пока нет.</p>}
        </div>
        <Card>
          <h2 className="mb-4 text-lg font-bold">Новая категория</h2>
          <CategoryFields />
        </Card>
      </div>
    </>
  );
}

function CategoryForm({ category, isFirst, isLast }: { category: Category; isFirst: boolean; isLast: boolean }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-bold">{category.name} <span className="text-xs font-normal text-muted">/catalog?category={category.slug}</span></div>
        <div className="flex gap-1">
          <form action={moveCategoryAction}><input type="hidden" name="id" value={category.id} /><input type="hidden" name="dir" value="up" /><Button variant="ghost" className="h-9 w-9 px-0" disabled={isFirst} aria-label="Выше">↑</Button></form>
          <form action={moveCategoryAction}><input type="hidden" name="id" value={category.id} /><input type="hidden" name="dir" value="down" /><Button variant="ghost" className="h-9 w-9 px-0" disabled={isLast} aria-label="Ниже">↓</Button></form>
        </div>
      </div>
      <CategoryFields category={category} />
    </Card>
  );
}

function CategoryFields({ category }: { category?: Category }) {
  return (
    <form action={saveCategoryAction} className="grid gap-3">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="sortOrder" value={category?.sortOrder ?? 99} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Название"><Input name="name" required defaultValue={category?.name ?? ""} /></Field>
        <Field label="Slug"><Input name="slug" defaultValue={category?.slug ?? ""} placeholder="antistress" /></Field>
      </div>
      <Field label="Описание (для карточки на главной)"><Textarea name="description" rows={2} defaultValue={category?.description ?? ""} /></Field>
      <ImageUrlField name="imageUrl" label="Изображение категории" defaultValue={category?.imageUrl ?? ""} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Checkbox name="isActive" label="Активна" defaultChecked={category?.isActive ?? true} />
        <Checkbox name="showOnHome" label="Показывать на главной" defaultChecked={category?.showOnHome ?? true} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit">{category ? "Сохранить" : "Создать"}</Button>
        {category && (
          <button type="submit" formAction={deleteCategoryAction} formNoValidate className="text-sm text-pink/80 hover:text-pink">
            Удалить
          </button>
        )}
      </div>
    </form>
  );
}
