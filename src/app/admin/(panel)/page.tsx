import Link from "next/link";
import { db } from "@/db";
import { orders, products, reviews } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Card, PageTitle, Badge } from "@/components/admin/ui";
import { formatDate, formatPrice } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, requiresDeliveryCalculation } from "@/lib/constants";
import { isOnlinePaymentEnabled } from "@/lib/payments";
import { TelegramTestButton } from "@/components/admin/telegram-test-button";

export default async function AdminDashboard() {
  const [[{ productsCount }], [{ ordersCount }], [{ newOrders }], [{ reviewsCount }], recent] = await Promise.all([
    db.select({ productsCount: sql<number>`count(*)::int` }).from(products),
    db.select({ ordersCount: sql<number>`count(*)::int` }).from(orders),
    db.select({ newOrders: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "new")),
    db.select({ reviewsCount: sql<number>`count(*)::int` }).from(reviews),
    db.query.orders.findMany({ orderBy: [desc(orders.createdAt)], limit: 8, with: { items: true } }),
  ]);

  const telegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

  return (
    <>
      <PageTitle title="Обзор" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Товаров" value={productsCount} href="/admin/products" />
        <Stat label="Заказов" value={ordersCount} href="/admin/orders" />
        <Stat label="Новых заказов" value={newOrders} href="/admin/orders?status=new" accent />
        <Stat label="Отзывов" value={reviewsCount} href="/admin/reviews" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Последние заказы</h2>
            <Link href="/admin/orders" className="text-sm text-green">Все →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Заказов пока нет.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:text-green">
                    <span className="font-bold">{o.number}</span>
                    <span className="text-sm text-muted">{formatDate(o.createdAt)}</span>
                    <span className="text-sm">{o.customerName}</span>
                    <span className="ml-auto font-bold">{requiresDeliveryCalculation(o.deliveryMethod, o.subtotal, o.deliveryCost) ? "По расчёту" : formatPrice(o.total)}</span>
                    <Badge tone={o.status === "new" ? "green" : "muted"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                    <Badge tone={o.paymentStatus === "paid" ? "green" : "pink"}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Интеграции</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <Integration ok={isOnlinePaymentEnabled()} name="ЮKassa (оплата)" hint="YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY" />
            <Integration ok={telegram} name="Telegram-уведомления" hint="TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID" />
            <Integration ok={Boolean(process.env.ADMIN_PASSWORD)} name="Свой пароль админки" hint="ADMIN_PASSWORD" />
          </ul>
          <TelegramTestButton />
          <p className="mt-4 text-xs text-muted">Переменные задаются в окружении хостинга (.env). После изменения — перезапустить сервер.</p>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, href, accent }: { label: string; value: number; href: string; accent?: boolean }) {
  return (
    <Link href={href} className="rounded-3xl bg-card p-5 ring-1 ring-line/60 transition-colors hover:ring-line">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`heading mt-2 text-4xl ${accent && value > 0 ? "text-green" : ""}`}>{value}</div>
    </Link>
  );
}

function Integration({ ok, name, hint }: { ok: boolean; name: string; hint: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-green" : "bg-muted"}`} />
      <div>
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-muted">{ok ? "подключено" : `не настроено · ${hint}`}</div>
      </div>
    </li>
  );
}
