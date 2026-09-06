import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orders, ORDER_STATUSES, PAYMENT_STATUSES } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateOrderStatusAction } from "@/lib/admin-actions";
import { Button, Card, Field, PageTitle, Select } from "@/components/admin/ui";
import { formatDate, formatPrice } from "@/lib/utils";
import { DELIVERY_METHODS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.query.orders.findFirst({ where: eq(orders.id, Number(id)), with: { items: true } });
  if (!order) notFound();
  const delivery = DELIVERY_METHODS.find((d) => d.id === order.deliveryMethod);

  return (
    <>
      <div className="mb-4 text-sm text-muted"><Link href="/admin/orders" className="hover:text-fg">← Заказы</Link></div>
      <PageTitle title={`Заказ ${order.number}`} />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg font-bold">Товары</h2>
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-bg2">
                    {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{i.name}</div>
                    <div className="text-xs text-muted">{i.quantity} × {formatPrice(i.price)}</div>
                  </div>
                  <div className="font-bold">{formatPrice(i.price * i.quantity)}</div>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-muted"><span>Товары</span><span className="text-fg">{formatPrice(order.subtotal)}</span></div>
              <div className="flex justify-between text-muted"><span>Доставка</span><span className="text-fg">{formatPrice(order.deliveryCost)}</span></div>
              <div className="flex justify-between text-base font-bold"><span>Итого</span><span>{formatPrice(order.total)}</span></div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold">Покупатель и доставка</h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row k="Имя" v={order.customerName} />
              <Row k="Телефон" v={<a href={`tel:${order.phone}`} className="text-green">{order.phone}</a>} />
              <Row k="E-mail" v={<a href={`mailto:${order.email}`} className="text-green">{order.email}</a>} />
              <Row k="Дата" v={formatDate(order.createdAt)} />
              <Row k="Город" v={order.city} />
              <Row k="Способ доставки" v={delivery?.name ?? order.deliveryMethod} />
              <Row k="Адрес / ПВЗ" v={order.address || "—"} />
              <Row k="Комментарий" v={order.comment || "—"} />
              <Row k="Платёжный провайдер" v={order.paymentProvider} />
              <Row k="ID платежа" v={order.paymentId || "—"} />
            </dl>
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Статусы</h2>
          <form action={updateOrderStatusAction} className="grid gap-3">
            <input type="hidden" name="id" value={order.id} />
            <Field label="Статус заказа">
              <Select name="status" defaultValue={order.status}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
              </Select>
            </Field>
            <Field label="Статус оплаты" hint="При подключённой ЮKassa обновляется автоматически через webhook">
              <Select name="paymentStatus" defaultValue={order.paymentStatus}>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
              </Select>
            </Field>
            <Button type="submit">Сохранить</Button>
          </form>
        </Card>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
      <dd className="mt-0.5 break-words">{v}</dd>
    </div>
  );
}
