import type { Metadata } from "next";
import {
  DELIVERY_METHODS,
  FIXED_DELIVERY_COST,
  FREE_DELIVERY_THRESHOLD,
  isRussianPost,
  PICKUP_ADDRESS,
  PICKUP_HOURS,
} from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { RussianPostCalculator } from "@/components/delivery/russian-post-calculator";

export const metadata: Metadata = {
  title: "Доставка и оплата",
  description: "Доставка по России, бесплатный самовывоз в Краснодаре и онлайн-оплата через ЮKassa в магазине ТАКТИЛЬНО.",
  alternates: { canonical: "/delivery" },
};

export default function DeliveryPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 md:pt-14 lg:px-8">
      <h1 className="heading text-5xl sm:text-6xl lg:text-7xl">
        Доставка<span className="text-green">.</span>
      </h1>
      <p className="mt-3 text-muted">Отправляем по всей России в течение 1–3 дней после оплаты.</p>
      <p className="mt-4 text-xl font-bold text-green sm:text-2xl">
        СДЭК, Ozon и Яндекс — {formatPrice(FIXED_DELIVERY_COST)}, Почта России — по тарифу,
        от {formatPrice(FREE_DELIVERY_THRESHOLD)} — бесплатно.
      </p>
      <p className="mt-2 text-sm text-muted">Самовывоз в Краснодаре бесплатный при любой сумме заказа.</p>

      <section className="mt-10 grid gap-3 sm:grid-cols-2" aria-label="Способы получения">
        {DELIVERY_METHODS.map((method) => {
          const pickup = method.provider === "pickup";
          const post = isRussianPost(method.id);
          return (
            <div
              key={method.id}
              className={`rounded-3xl p-5 ring-1 ${pickup ? "bg-green/10 ring-green/30 sm:col-span-2" : "bg-card ring-line/60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-lg font-bold">{method.name}</div>
                <div className="shrink-0 text-sm font-bold text-green">
                  {pickup ? "Бесплатно" : post ? "по тарифу" : formatPrice(method.cost)}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted">{method.description}</p>
              {!pickup && (
                <p className="mt-3 text-xs text-muted">
                  {post
                    ? `Точный тариф — по вашему индексу при оформлении. Бесплатно от ${formatPrice(FREE_DELIVERY_THRESHOLD)}.`
                    : `Бесплатно, если стоимость товаров в заказе от ${formatPrice(FREE_DELIVERY_THRESHOLD)}.`}
                </p>
              )}
            </div>
          );
        })}
      </section>

      <section className="mt-10" aria-label="Калькулятор Почты России">
        <RussianPostCalculator />
      </section>

      <section className="mt-12 rounded-3xl bg-card p-6 ring-1 ring-line/60 sm:p-8">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-green">Бесплатный самовывоз</div>
        <h2 className="heading mt-2 text-3xl sm:text-4xl">Заберите в Краснодаре</h2>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-bg2 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Адрес</div>
            <div className="mt-1 font-bold">{PICKUP_ADDRESS}</div>
          </div>
          <div className="rounded-2xl bg-bg2 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Время работы</div>
            <div className="mt-1 font-bold">Ежедневно {PICKUP_HOURS}</div>
          </div>
        </div>
      </section>

      <section id="payment" className="mt-16 scroll-mt-24">
        <h2 className="heading text-3xl sm:text-4xl">Оплата</h2>
        <div className="mt-5 rounded-3xl border border-green/30 bg-green/10 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xl font-extrabold">Онлайн через ЮKassa</div>
            <span className="rounded-full bg-green px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-bg">Только онлайн</span>
          </div>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <p>После оформления заказа вы перейдёте на защищённую страницу ЮKassa и выберете доступный способ оплаты.</p>
            <p>Других способов оплаты, в том числе при получении или самовывозе, нет.</p>
            <p>В электронном чеке каждый товар указывается отдельно, а платная доставка — отдельной услугой.</p>
          </div>
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
