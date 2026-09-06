import Image from "next/image";
import { db } from "@/db";
import { reviews, products } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { deleteReviewAction, saveReviewAction, toggleReviewAction } from "@/lib/admin-actions";
import { Badge, Button, Card, Checkbox, Field, Input, PageTitle, Select, Textarea } from "@/components/admin/ui";
import { ImageUrlField } from "@/components/admin/image-url-field";
import { formatDate } from "@/lib/utils";

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const [list, productList] = await Promise.all([
    db.query.reviews.findMany({ with: { product: true }, orderBy: [asc(reviews.sortOrder), desc(reviews.createdAt)] }),
    db.query.products.findMany({ orderBy: [asc(products.name)] }),
  ]);
  const editing = edit ? list.find((r) => r.id === Number(edit)) : undefined;

  return (
    <>
      <PageTitle title="Отзывы" />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {list.length === 0 && <p className="text-muted">Отзывов пока нет. Добавьте первый справа — он появится на главной.</p>}
          {list.map((r) => (
            <Card key={r.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bg2">
                  {r.photoUrl && <Image src={r.photoUrl} alt="" fill sizes="40px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{r.authorName}</span>
                    <span className="text-green">{"★".repeat(r.rating)}</span>
                    {r.product && <span className="text-xs text-muted">{r.product.name}</span>}
                    {!r.isVisible && <Badge>Скрыт</Badge>}
                    <span className="ml-auto text-xs text-muted">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm">{r.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`/admin/reviews?edit=${r.id}`} className="inline-flex h-9 items-center rounded-full bg-bg2 px-3 text-xs font-bold ring-1 ring-line/60">Редактировать</a>
                    <form action={toggleReviewAction}><input type="hidden" name="id" value={r.id} /><Button variant="ghost" className="h-9 px-3 text-xs">{r.isVisible ? "Скрыть" : "Показать"}</Button></form>
                    <form action={deleteReviewAction}><input type="hidden" name="id" value={r.id} /><Button variant="danger" className="h-9 px-3 text-xs">Удалить</Button></form>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <h2 className="mb-4 text-lg font-bold">{editing ? "Редактировать отзыв" : "Добавить отзыв"}</h2>
          <form action={saveReviewAction} className="grid gap-3" key={editing?.id ?? "new"}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Field label="Имя / ник"><Input name="authorName" required defaultValue={editing?.authorName ?? ""} /></Field>
            <Field label="Текст отзыва"><Textarea name="text" rows={4} required defaultValue={editing?.text ?? ""} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Оценка">
                <Select name="rating" defaultValue={editing?.rating ?? 5}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </Select>
              </Field>
              <Field label="Порядок"><Input name="sortOrder" type="number" defaultValue={editing?.sortOrder ?? 0} /></Field>
            </div>
            <Field label="Товар">
              <Select name="productId" defaultValue={editing?.productId ?? ""}>
                <option value="">— не указан —</option>
                {productList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <ImageUrlField name="photoUrl" label="Фото покупателя" defaultValue={editing?.photoUrl ?? ""} />
            <Checkbox name="isVisible" label="Показывать на сайте" defaultChecked={editing?.isVisible ?? true} />
            <div className="flex items-center gap-3">
              <Button type="submit" variant="green">{editing ? "Сохранить" : "Добавить"}</Button>
              {editing && <a href="/admin/reviews" className="text-sm text-muted hover:text-fg">Отмена</a>}
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
