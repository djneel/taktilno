import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatPrice } from "@/lib/utils";
import { getDeliveryMethodName, isFreeDelivery, PAYMENT_STATUS_LABELS, requiresDeliveryCalculation } from "@/lib/constants";

export const metadata: Metadata = { title: "Заказ принят", robots: { index: false } };

export default async function OrderSuccessPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = await db.query.orders.findFirst({
    where: eq(orders.number, decodeURIComponent(number)),
    with: { items: true },
  });
  if (!order) notFound();
  const delivery = getDeliveryMethodName(order.deliveryMethod);
  const deliveryIsFree = isFreeDelivery(order.deliveryMethod, order.subtotal, order.deliveryCost);
  const deliveryNeedsCalculation = requiresDeliveryCalculation(order.deliveryMethod, order.subtotal, order.deliveryCost);

  return (
    <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-12 text-center sm:px-6 md:pt-20">
      <div className="glow-green pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/3" />
      <div className="relative">
        <h1 className="heading text-5xl sm:text-6xl lg:text-7xl">
          Заказ принят <span className="text-pink">❤</span>
        </h1>
        <p className="mt-6 text-sm uppercase tracking-[0.2em] text-muted">Номер заказа</p>
        <p className="heading mt-1 text-4xl text-green sm:text-5xl">№ {order.number}</p>
        <p className="mx-auto mt-6 max-w-md text-base text-muted">
          Спасибо за заказ!
          <br />
          {deliveryNeedsCalculation
            ? "Мы свяжемся с вами по указанным контактам, чтобы подтвердить стоимость доставки."
            : "Информация о заказе будет отправлена на указанные контакты."}
        </p>

        <div className="mx-auto mt-10 max-w-md rounded-3xl bg-card p-6 text-left ring-1 ring-line/60">
          <ul className="space-y-2 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="text-muted">{i.name} × {i.quantity}</span>
                <span>{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between gap-3 text-muted">
              <span>Доставка</span>
              <span className="text-right text-fg">{delivery} · {deliveryNeedsCalculation ? "по расчёту" : deliveryIsFree ? "Бесплатно" : formatPrice(order.deliveryCost)}</span>
            </div>
            <div className="flex justify-between text-muted"><span>Оплата</span><span className="text-fg">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</span></div>
            <div className="flex justify-between pt-2 text-base font-bold">
              <span>{deliveryNeedsCalculation ? "Итого после расчёта" : "Итого"}</span>
              <span>{deliveryNeedsCalculation ? "По расчёту" : formatPrice(order.total)}</span>
            </div>
          </div>
          {order.paymentStatus === "pending" && order.paymentUrl && (
            <a href={order.paymentUrl} className="mt-5 flex h-12 items-center justify-center rounded-full bg-green text-sm font-bold uppercase tracking-wider text-bg">
              Перейти к оплате
            </a>
          )}
          {order.paymentStatus === "pending" && deliveryNeedsCalculation && (
            <p className="mt-5 rounded-2xl bg-bg2 p-3 text-xs text-muted">
              Мы рассчитаем стоимость доставки, свяжемся с вами по указанным контактам и пришлём итоговую сумму для оплаты.
            </p>
          )}
          {order.paymentStatus === "pending" && !order.paymentUrl && !deliveryNeedsCalculation && (
            <p className="mt-5 rounded-2xl bg-bg2 p-3 text-xs text-muted">
              Онлайн-оплата пока подключается. Мы свяжемся с вами по указанным контактам и пришлём способ оплаты.
            </p>
          )}
        </div>

        <Link href="/catalog" className="mt-10 inline-flex h-12 items-center rounded-full border border-line px-6 text-sm font-bold uppercase tracking-wider md:hover:border-green md:hover:text-green">
          Вернуться в каталог
        </Link>
      </div>
    </div>
  );
}
