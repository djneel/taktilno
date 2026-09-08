import type { Metadata } from "next";
import { DELIVERY_METHODS, FREE_DELIVERY_THRESHOLD } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Доставка и оплата",
  description: "Условия доставки по России, способы оплаты и возврата в магазине ТАКТИЛЬНО.",
  alternates: { canonical: "/delivery" },
};

export default function DeliveryPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 md:pt-14 lg:px-8">
      <h1 className="heading text-5xl sm:text-6xl lg:text-7xl">
        Доставка<span className="text-green">.</span>
      </h1>
      <p className="mt-3 text-muted">Отправляем по всей России в течение 1–3 дней после оплаты.</p>
      <p className="mt-2 text-sm text-muted">
        Выберите удобный пункт выдачи или отделение СДЭК, Ozon, Яндекс Доставки или Почты России при оформлении заказа.
      </p>
      <p className="mt-2 text-sm font-semibold text-green">Бесплатная доставка при заказе от {formatPrice(FREE_DELIVERY_THRESHOLD)}.</p>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        {DELIVERY_METHODS.map((d) => (
          <div key={d.id} className="rounded-3xl bg-card p-5 ring-1 ring-line/60">
            <div className="flex items-start justify-between gap-3">
              <div className="text-lg font-bold">{d.name}</div>
              <div className="text-right text-sm font-bold text-green">Бесплатно от {formatPrice(FREE_DELIVERY_THRESHOLD)}<br />иначе по расчёту</div>
            </div>
            <p className="mt-1 text-sm text-muted">{d.description}</p>
          </div>
        ))}
      </section>

      <section id="payment" className="mt-16 scroll-mt-24">
        <h2 className="heading text-3xl sm:text-4xl">Оплата</h2>
        <div className="mt-4 space-y-3 text-muted">
          <p>При заказе от {formatPrice(FREE_DELIVERY_THRESHOLD)} доставка бесплатна, а итоговая сумма видна на оформлении.</p>
          <p>
            Если сумма меньше, после оформления мы рассчитаем доставку, свяжемся с вами и пришлём итоговую сумму и способ оплаты.
          </p>
          <p>Стоимость фигурок фиксируется в момент оформления заказа.</p>
        </div>
      </section>

      <section id="return" className="mt-16 scroll-mt-24">
        <h2 className="heading text-3xl sm:text-4xl">Возврат</h2>
        <div className="mt-4 space-y-3 text-muted">
          <p>Если фигурка пришла с браком или повреждена при доставке — напишите нам в течение 7 дней с фото. Перепечатаем или вернём деньги.</p>
          <p>Возврат без брака возможен в течение 14 дней, если фигурка не использовалась и сохранила товарный вид.</p>
        </div>
      </section>
    </div>
  );
}
