"use client";

import { useEffect, useMemo, useState } from "react";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/constants";
import { formatPrice, pluralize } from "@/lib/utils";

export type RussianPostQuoteDto = {
  cost: number;
  mailCost: number;
  free: boolean;
  minDays?: number;
  maxDays?: number;
  source: "otpravka" | "tariff" | "fallback";
  fallback: boolean;
  weightGrams: number;
};

type QuoteItem = { productId: number; quantity: number };

/** Живой тариф Почты России с дебаунсом. Не блокирует оформление при ошибках. */
export function useRussianPostQuote(opts: {
  enabled: boolean;
  postcode: string;
  items: QuoteItem[];
  subtotal: number;
}) {
  const { enabled, postcode, items, subtotal } = opts;
  const [data, setData] = useState<{ key: string | null; quote: RussianPostQuoteDto | null; error: string | null }>({
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
  const postcodeValid = /^\d{6}$/.test(postcode.replace(/\D/g, ""));
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

  // Ключ активного запроса; null — считать нечего (способ не Почта, индекс неполный, корзина пуста).
  const requestKey =
    enabled && postcodeValid && items.length > 0 ? `${postcode}|${itemsKey}|${subtotal}` : null;

  // Сброс результата при смене запроса — adjustment во время рендера (без setState в эффекте).
  if (data.key !== requestKey) {
    setData({ key: requestKey, quote: null, error: null });
  }

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/delivery/russian-post/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postcode, items: snapshot }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Не удалось рассчитать тариф");
        }
        if (!cancelled) setData({ key: requestKey, quote: payload as RussianPostQuoteDto, error: null });
      } catch (caught) {
        // Не мешаем оформить заказ: сервер посчитает сам и применит fallback.
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
  }, [requestKey, postcode, snapshot]);

  const loading = requestKey !== null && data.key === requestKey && !data.quote && !data.error;
  return { quote: data.key === requestKey ? data.quote : null, loading, error: data.error, postcodeValid };
}

export function formatDeliveryDays(minDays?: number, maxDays?: number) {
  if (minDays === undefined && maxDays === undefined) return null;
  const min = minDays ?? maxDays!;
  const max = maxDays ?? minDays!;
  if (min === max) return `${min} ${pluralize(min, ["день", "дня", "дней"])}`;
  return `${min}–${max} ${pluralize(max, ["день", "дня", "дней"])}`;
}

/** Плашка с результатом расчёта тарифа Почты России. */
export function RussianPostQuoteInfo({
  quote,
  loading,
  error,
  subtotal,
}: {
  quote: RussianPostQuoteDto | null;
  loading: boolean;
  error: string | null;
  subtotal: number;
}) {
  if (loading && !quote) {
    return (
      <div className="animate-pulse rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
        Считаем тариф Почты России…
      </div>
    );
  }
  if (error && !quote) {
    return (
      <div className="rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
        Точный тариф Почты сейчас недоступен — итог посчитаем при оформлении
        (ориентир — {formatPrice(300)}).
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
          <>Почта России: {formatPrice(quote.mailCost)}</>
        )}
      </span>
      {days && <span className="text-muted"> · срок {days}</span>}
      {!freeByThreshold && !quote.fallback && (
        <span className="text-muted"> · тариф по вашему индексу</span>
      )}
      {quote.fallback && !freeByThreshold && (
        <span className="text-muted"> · сайт Почты недоступен, взят стандартный тариф</span>
      )}
    </div>
  );
}
