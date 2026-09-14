"use client";

import { useEffect, useMemo, useState } from "react";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/constants";
import { formatDeliveryDays, formatPrice } from "@/lib/utils";

export type CdekQuoteDto = {
  cost: number;
  carrierCost: number;
  free: boolean;
  cityCode?: number;
  tariffCode?: number;
  minDays?: number;
  maxDays?: number;
  source: "api" | "fallback";
  fallback: boolean;
  reason?: "not-configured" | "weight-limit" | "api-error";
  weightGrams: number;
  configured: boolean;
};

type QuoteItem = { productId: number; quantity: number };

/** Стандартный тариф, который показываем, когда API СДЭК недоступно. */
const STANDARD_DELIVERY_COST = 300;

/**
 * Пояснение к стандартному тарифу в плашке чекаута — зависит от причины fallback.
 *
 * weight-limit — штатная ситуация, а не сбой: посылка тяжелее предела
 * онлайн-расчёта (CDEK_MAX_WEIGHT_G), поэтому покупателю нельзя показывать
 * «сайт СДЭК недоступен» — вместо этого объясняем, что тариф уточним.
 */
function cdekFallbackNote(reason?: CdekQuoteDto["reason"]) {
  switch (reason) {
    case "weight-limit":
      return " · посылка тяжелее лимита онлайн-расчёта, тариф уточним при оформлении";
    case "not-configured":
      return " · тариф СДЭК уточним при оформлении, ориентир — стандартный";
    default:
      return " · сайт СДЭК недоступен, взят стандартный тариф";
  }
}

/**
 * Живой тариф СДЭК по городу получателя с дебаунсом.
 * Ошибки не блокируют оформление: сервер посчитает сам и применит стандартный тариф.
 */
export function useCdekQuote(opts: {
  enabled: boolean;
  city: string;
  items: QuoteItem[];
  subtotal: number;
  /** Код города и индекс из виджета ПВЗ — тариф точнее, чем по названию. */
  cityCode?: number | null;
  postcode?: string | null;
}) {
  const { enabled, city, items, subtotal, cityCode, postcode } = opts;
  const [data, setData] = useState<{ key: string | null; quote: CdekQuoteDto | null; error: string | null }>({
    key: null,
    quote: null,
    error: null,
  });

  const itemsKey = useMemo(
    () =>
      [...items]
        .map((i) => `${i.productId}:${i.quantity}`)
        .sort()
        .join(","),
    [items]
  );
  const cityValue = city.trim();
  const cityValid = cityValue.length >= 2;
  // Снапшот корзины восстанавливаем из стабильной строки-ключа (без чтения ref во время рендера).
  const snapshot = useMemo(
    () =>
      itemsKey
        .split(",")
        .filter(Boolean)
        .map((pair) => {
          const [productId, quantity] = pair.split(":").map(Number);
          return { productId, quantity };
        }),
    [itemsKey]
  );

  // Ключ активного запроса; null — считать нечего (способ не СДЭК, город не введён, корзина пуста).
  const requestKey =
    enabled && cityValid && items.length > 0
      ? `${cityValue}|${itemsKey}|${subtotal}|${cityCode ?? ""}|${postcode ?? ""}`
      : null;

  // Сброс результата при смене запроса — adjustment во время рендера (без setState в эффекте).
  if (data.key !== requestKey) {
    setData({ key: requestKey, quote: null, error: null });
  }

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/delivery/cdek/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: cityValue,
            items: snapshot,
            ...(cityCode ? { cityCode } : {}),
            ...(postcode ? { postcode } : {}),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Не удалось рассчитать тариф СДЭК");
        }
        if (!cancelled) setData({ key: requestKey, quote: payload as CdekQuoteDto, error: null });
      } catch (caught) {
        if (!cancelled) {
          setData({
            key: requestKey,
            quote: null,
            error: caught instanceof Error ? caught.message : "Тариф временно недоступен",
          });
        }
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requestKey, cityValue, snapshot, cityCode, postcode]);

  const loading = requestKey !== null && data.key === requestKey && !data.quote && !data.error;
  return { quote: data.key === requestKey ? data.quote : null, loading, error: data.error, cityValid };
}

/** Плашка с результатом расчёта тарифа СДЭК. */
export function CdekQuoteInfo({
  quote,
  loading,
  error,
  subtotal,
  city,
}: {
  quote: CdekQuoteDto | null;
  loading: boolean;
  error: string | null;
  subtotal: number;
  city: string;
}) {
  const hasCity = city.trim().length >= 2;

  if (!hasCity && !quote) {
    return (
      <div className="rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
        Укажите город — посчитаем тариф СДЭК до пункта выдачи.
      </div>
    );
  }
  if (loading && !quote) {
    return (
      <div className="animate-pulse rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
        Считаем тариф СДЭК…
      </div>
    );
  }
  if (error && !quote) {
    return (
      <div className="rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
        Точный тариф СДЭК сейчас недоступен — итог посчитаем при оформлении
        (ориентир — {formatPrice(STANDARD_DELIVERY_COST)}).
      </div>
    );
  }
  if (!quote) return null;

  const days = formatDeliveryDays(quote.minDays, quote.maxDays);
  const freeByThreshold = subtotal >= FREE_DELIVERY_THRESHOLD;

  return (
    <div
      className="rounded-2xl bg-green/10 px-4 py-3 text-sm ring-1 ring-green/30"
      role="status"
      aria-live="polite"
    >
      <span className="font-bold text-green">
        {freeByThreshold ? (
          <>Бесплатно — заказ от {formatPrice(FREE_DELIVERY_THRESHOLD)}</>
        ) : (
          <>СДЭК: {formatPrice(quote.carrierCost)}</>
        )}
      </span>
      {days && <span className="text-muted"> · срок {days}</span>}
      {!freeByThreshold && !quote.fallback && (
        <span className="text-muted"> · тариф СДЭК по вашему городу</span>
      )}
      {quote.fallback && !freeByThreshold && (
        <span className="text-muted">{cdekFallbackNote(quote.reason)}</span>
      )}
      <span className="mt-1 block text-xs text-muted">
        Доставка в пункт выдачи СДЭК. Отслеживание — по трек-номеру после отправки.
      </span>
    </div>
  );
}
