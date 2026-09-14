"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useCart } from "@/components/cart/cart-context";
import {
  DELIVERY_METHODS,
  FIXED_DELIVERY_COST,
  FREE_DELIVERY_THRESHOLD,
  getDeliveryCost,
  isCdek,
  isRussianPost,
  ONLINE_PAYMENT_METHOD,
  PICKUP_ADDRESS,
  PICKUP_HOURS,
} from "@/lib/constants";
import { normalizeInn, validateInn } from "@/lib/inn";
import { cn, formatPrice } from "@/lib/utils";
import { CdekQuoteInfo, useCdekQuote } from "./cdek-fields";
import {
  CdekPvzPicker,
  fetchCdekWidgetConfig,
  type CdekPvzChoice,
  type CdekWidgetConfig,
  type CdekWidgetFailReason,
} from "@/components/delivery/cdek-pvz-widget";
import { RussianPostQuoteInfo, useRussianPostQuote } from "./russian-post-fields";

export function CheckoutForm({ onlinePayment }: { onlinePayment: boolean }) {
  const { items, hydrated, subtotal, clear } = useCart();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    deliveryMethod: DELIVERY_METHODS[0].id,
    postcode: "",
    address: "",
    inn: "",
    comment: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Виджет ПВЗ СДЭК: undefined — конфиг грузится, null — не загрузился (ручной ввод).
  const [widgetConfig, setWidgetConfig] = useState<CdekWidgetConfig | null | undefined>(undefined);
  const [widgetFailed, setWidgetFailed] = useState(false);
  const [widgetFailReason, setWidgetFailReason] = useState<CdekWidgetFailReason | null>(null);
  const [widgetAttempt, setWidgetAttempt] = useState(0);
  const [pvz, setPvz] = useState<CdekPvzChoice | null>(null);

  const delivery = DELIVERY_METHODS.find((method) => method.id === form.deliveryMethod) ?? DELIVERY_METHODS[0];
  const russianPost = isRussianPost(delivery.id);
  const cdek = isCdek(delivery.id);
  const cartItems = items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
  const { quote: pochtaQuote, loading: pochtaLoading, error: pochtaError } = useRussianPostQuote({
    enabled: russianPost,
    postcode: form.postcode,
    items: cartItems,
    subtotal,
  });
  const { quote: cdekQuote, loading: cdekLoading, error: cdekError } = useCdekQuote({
    enabled: cdek,
    city: form.city,
    items: cartItems,
    subtotal,
    cityCode: pvz?.office.cityCode ?? null,
    postcode: pvz?.office.postalCode ?? null,
  });
  // Почта России и СДЭК: живой тариф из API (сервер пересчитает авторитетно при оформлении).
  const liveCosts = {
    russianPostCost: pochtaQuote?.mailCost,
    cdekCost: cdekQuote?.carrierCost,
  };
  const deliveryCost = getDeliveryCost(delivery.id, subtotal, liveCosts);
  const deliveryIsFree = deliveryCost === 0;
  const total = subtotal + deliveryCost;

  useEffect(() => {
    let cancelled = false;
    fetchCdekWidgetConfig().then(
      (cfg) => {
        if (!cancelled) setWidgetConfig(cfg);
      },
      () => {
        if (!cancelled) setWidgetConfig(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Ключ Яндекс.Карт вшит в JS-бандл при сборке: если его добавили в переменные,
  // но не сделали редеплой — сервер скажет enabled, а в браузере ключа нет.
  const buildHasYandexKey = Boolean(process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim());
  // Карта активна: СДЭК + договор + ключ (и на сервере, и в сборке) + скрипт завёлся.
  const widgetActive = cdek && Boolean(widgetConfig?.enabled) && !widgetFailed && buildHasYandexKey;
  // Сервер разрешил карту, а в сборке ключа нет — классический «забыли редеплой».
  const widgetNeedsRedeploy =
    cdek && Boolean(widgetConfig?.enabled) && !widgetFailed && !buildHasYandexKey;

  const handlePvzChoose = (choice: CdekPvzChoice) => {
    setPvz(choice);
    // Город из виджета точнее ручного — подставляем для котировки.
    if (choice.office.city) {
      setForm((current) => ({ ...current, city: choice.office.city }));
    }
  };

  // Ручная правка города после выбора ПВЗ — выбор сбрасываем (город уже другой).
  const handleCityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPvz(null);
    setForm((current) => ({ ...current, city: event.target.value }));
  };

  const set = (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!onlinePayment) {
      setError("Онлайн-оплата через ЮKassa временно недоступна. Попробуйте позже.");
      return;
    }

    const innError = validateInn(form.inn);
    if (innError) {
      setError(innError);
      return;
    }

    if (delivery.needsPostcode && !/^\d{6}$/.test(form.postcode.replace(/\D/g, ""))) {
      setError("Укажите корректный индекс (6 цифр) для расчёта тарифа Почты России");
      return;
    }

    if (cdek && widgetActive && !pvz) {
      setError("Выберите пункт выдачи СДЭК на карте — код пункта нужен для накладной");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          city: delivery.needsCity ? form.city : undefined,
          postcode: delivery.needsPostcode ? form.postcode.replace(/\D/g, "") : undefined,
          address:
            cdek && pvz
              ? `${pvz.office.name ? `${pvz.office.name}, ` : ""}${pvz.office.address}`
              : delivery.needsAddress
                ? form.address
                : undefined,
          ...(cdek && pvz
            ? {
                cdekPvz: {
                  code: pvz.office.code,
                  name: pvz.office.name,
                  address: pvz.office.address,
                  city: pvz.office.city,
                  cityCode: pvz.office.cityCode,
                  postalCode: pvz.office.postalCode,
                  workTime: pvz.office.workTime,
                  type: pvz.office.type,
                },
              }
            : {}),
          paymentMethod: ONLINE_PAYMENT_METHOD,
          inn: normalizeInn(form.inn),
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            variantName: item.variantName,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Не удалось оформить заказ");
      }
      if (!data.paymentUrl) {
        throw new Error("ЮKassa не вернула ссылку на оплату. Попробуйте ещё раз.");
      }

      clear();
      window.location.assign(data.paymentUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка. Попробуйте ещё раз.");
      setLoading(false);
    }
  };

  if (!hydrated) return <div className="mt-10 h-60 animate-pulse rounded-3xl bg-card" />;

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center">
        <div className="heading text-2xl">Корзина пуста</div>
        <Link href="/catalog" className="mt-6 inline-flex h-12 items-center rounded-full bg-fg px-6 text-sm font-bold text-bg">
          В каталог →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-8 md:grid-cols-[1fr_360px] md:items-start">
      <div className="space-y-8">
        <Fieldset title="Контакты">
          <Input label="Имя" required value={form.name} onChange={set("name")} autoComplete="name" />
          <Input label="Телефон" required type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" placeholder="+7 900 000-00-00" />
          <Input label="E-mail" required type="email" value={form.email} onChange={set("email")} autoComplete="email" inputMode="email" />
          <Input
            label="ИНН (необязательно)"
            value={form.inn}
            onChange={set("inn")}
            inputMode="numeric"
            maxLength={12}
            placeholder="10 или 12 цифр"
            autoComplete="off"
          />
          <p className="-mt-2 text-xs text-muted">Для компаний и ИП — укажем ИНН в закрывающих документах.</p>
        </Fieldset>

        <Fieldset title="Получение заказа">
          <div className="rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
            СДЭК — <strong className="text-fg">по тарифу СДЭК</strong> для вашего города,
            Почта России — по тарифу Почты для вашего индекса,
            Ozon и Яндекс — {formatPrice(FIXED_DELIVERY_COST)}.
            От {formatPrice(FREE_DELIVERY_THRESHOLD)} — бесплатно. Самовывоз бесплатный при любой сумме.
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {DELIVERY_METHODS.map((method) => {
              const isPost = isRussianPost(method.id);
              const isCdekMethod = isCdek(method.id);
              const methodCost = getDeliveryCost(method.id, subtotal, liveCosts);
              const methodIsFree = methodCost === 0;
              const methodPrice = methodIsFree
                ? "Бесплатно"
                : isPost
                  ? (pochtaQuote ? formatPrice(pochtaQuote.mailCost) : pochtaLoading ? "…" : "по тарифу")
                  : isCdekMethod
                    ? (cdekQuote && !cdekQuote.fallback ? formatPrice(cdekQuote.carrierCost) : cdekLoading ? "…" : "по тарифу")
                    : formatPrice(method.cost);
              return (
                <label
                  key={method.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 transition-colors",
                    method.provider === "pickup" && "sm:col-span-2",
                    form.deliveryMethod === method.id
                      ? "bg-bg2 ring-green"
                      : "bg-bg2/40 ring-line/60 hover:ring-line"
                  )}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={method.id}
                    checked={form.deliveryMethod === method.id}
                    onChange={() => setForm((current) => ({ ...current, deliveryMethod: method.id }))}
                    className="mt-1 accent-[#8FCB81]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{method.name}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{method.description}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-bold text-green">
                    {methodPrice}
                  </span>
                </label>
              );
            })}
          </div>

          {delivery.provider === "pickup" ? (
            <div className="rounded-2xl border border-green/30 bg-green/10 p-4" role="note">
              <div className="text-xs font-bold uppercase tracking-wider text-green">Точка самовывоза</div>
              <div className="mt-1 font-bold">{PICKUP_ADDRESS}</div>
              <div className="mt-1 text-sm text-muted">Ежедневно {PICKUP_HOURS}. Поля города и адреса заполнять не нужно.</div>
            </div>
          ) : (
            <>
              {delivery.needsPostcode && (
                <>
                  <Input
                    label="Почтовый индекс"
                    required
                    value={form.postcode}
                    onChange={set("postcode")}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="101000"
                    autoComplete="postal-code"
                  />
                  <RussianPostQuoteInfo
                    quote={pochtaQuote}
                    loading={pochtaLoading}
                    error={pochtaError}
                    subtotal={subtotal}
                  />
                </>
              )}
              <Input
                label="Город"
                required
                value={form.city}
                onChange={cdek ? handleCityChange : set("city")}
                autoComplete="address-level2"
              />
              {cdek && widgetActive && (
                <CdekPvzPicker
                  key={widgetAttempt}
                  config={widgetConfig as CdekWidgetConfig}
                  city={form.city}
                  weightGrams={cdekQuote?.weightGrams ?? 500}
                  selected={pvz}
                  onChoose={handlePvzChoose}
                  onWidgetError={(reason) => {
                    setWidgetFailed(true);
                    setWidgetFailReason(reason);
                  }}
                />
              )}
              {cdek && (
                <CdekQuoteInfo
                  quote={cdekQuote}
                  loading={cdekLoading}
                  error={cdekError}
                  subtotal={subtotal}
                  city={form.city}
                />
              )}
              {cdek && widgetConfig === undefined ? (
                <div className="h-14 animate-pulse rounded-2xl bg-bg2/60 ring-1 ring-line/60" aria-hidden="true" />
              ) : cdek && widgetActive ? null : (
                <Input
                  label={delivery.addressLabel}
                  required
                  value={form.address}
                  onChange={set("address")}
                  autoComplete="street-address"
                />
              )}
              {cdek && widgetFailed && widgetConfig?.enabled && widgetFailReason && (
                <WidgetFailNote
                  reason={widgetFailReason}
                  onRetry={() => {
                    setWidgetFailed(false);
                    setWidgetFailReason(null);
                    setWidgetAttempt((attempt) => attempt + 1);
                  }}
                />
              )}
              {cdek && widgetNeedsRedeploy && <WidgetFailNote reason="no-key" />}
            </>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Комментарий</span>
            <textarea
              value={form.comment}
              onChange={set("comment")}
              rows={2}
              placeholder="Пожелания к заказу или получению"
              className="w-full rounded-2xl bg-bg2 px-4 py-3 text-base outline-none ring-1 ring-line/60 focus:ring-green"
            />
          </label>
        </Fieldset>

        <Fieldset title="Оплата">
          <label className="flex items-start gap-3 rounded-2xl bg-green/10 p-4 ring-1 ring-green/40">
            <input
              type="radio"
              name="paymentMethod"
              value={ONLINE_PAYMENT_METHOD}
              checked
              readOnly
              className="mt-1 accent-[#8FCB81]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-bold">Онлайн через ЮKassa</span>
                <span className="rounded-full bg-green px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-bg">Единственный способ</span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">
                После оформления откроется защищённая страница ЮKassa с доступными способами оплаты.
              </span>
            </span>
          </label>
          <div className="flex gap-3 rounded-2xl bg-bg2/60 p-4 text-sm text-muted ring-1 ring-line/60">
            <svg className="mt-0.5 shrink-0 text-green" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3 5 6v5c0 4.6 2.8 8.3 7 10 4.2-1.7 7-5.4 7-10V6l-7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>Товары попадут в электронный чек отдельными позициями, доставка — отдельной услугой.</span>
          </div>
          {!onlinePayment && (
            <div className="rounded-2xl bg-pink/10 px-4 py-3 text-sm text-pink" role="alert">
              Онлайн-оплата через ЮKassa временно недоступна. Оформление заказа приостановлено — попробуйте позже.
            </div>
          )}
        </Fieldset>
      </div>

      <aside className="rounded-3xl bg-card p-5 ring-1 ring-line/60 sm:p-6 md:sticky md:top-24">
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.productId}-${item.variantName ?? "default"}`} className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-bg2">
                {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{item.name}</div>
                {item.variantName && <div className="text-xs text-muted">Цвет: {item.variantName}</div>}
                <div className="text-xs text-muted">{item.quantity} × {formatPrice(item.price)}</div>
              </div>
              <div className="text-sm font-bold">{formatPrice(item.price * item.quantity)}</div>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
          <Row label="Товары" value={formatPrice(subtotal)} />
          <Row label={delivery.provider === "pickup" ? "Самовывоз" : "Доставка"} value={deliveryIsFree ? "Бесплатно" : formatPrice(deliveryCost)} />
          <div className="flex items-baseline justify-between pt-2">
            <span className="text-base font-bold">К оплате</span>
            <span className="text-right text-2xl font-extrabold tracking-tight">{formatPrice(total)}</span>
          </div>
        </div>

        {error && <div className="mt-4 rounded-2xl bg-pink/10 px-4 py-3 text-sm text-pink" role="alert">{error}</div>}

        <button
          type="submit"
          disabled={loading || !onlinePayment}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-green px-4 text-center text-sm font-bold uppercase tracking-wider text-bg transition-transform disabled:cursor-not-allowed disabled:opacity-50 md:hover:enabled:scale-[1.02]"
        >
          {loading ? "Создаём платёж…" : onlinePayment ? "Перейти к оплате" : "Оплата недоступна"}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          Оплата только онлайн на защищённой странице ЮKassa.
        </p>
      </aside>
    </form>
  );
}

const WIDGET_FAIL_TEXT: Record<CdekWidgetFailReason, string> = {
  "no-key": "Карта пунктов выдачи недоступна: сайт собран без ключа Яндекс.Карт (нужен редеплой).",
  cdn: "Карта пунктов выдачи недоступна: не загрузился скрипт виджета (CDN).",
  init: "Карта пунктов выдачи недоступна: виджет не запустился.",
};

/** Пояснение, почему нет карты, + ручной ввод адреса как запасной путь. */
function WidgetFailNote({ reason, onRetry }: { reason: CdekWidgetFailReason; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
      {WIDGET_FAIL_TEXT[reason]} Введите адрес ПВЗ вручную.{" "}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-bold text-green underline underline-offset-2"
        >
          Попробовать карту снова
        </button>
      )}
    </div>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-3xl bg-card p-5 ring-1 ring-line/60 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="heading mb-4 text-2xl">{title}</div>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
        {props.required && <span className="text-green"> *</span>}
      </span>
      <input
        {...props}
        className="h-13 min-h-12 w-full rounded-2xl bg-bg2 px-4 text-base outline-none ring-1 ring-line/60 focus:ring-green"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-muted">
      <span>{label}</span>
      <span className="text-right text-fg">{value}</span>
    </div>
  );
}
