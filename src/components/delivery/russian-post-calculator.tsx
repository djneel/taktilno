"use client";

import { useState } from "react";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { formatDeliveryDays } from "@/components/checkout/russian-post-fields";

type Result = {
  mailCost: number;
  minDays?: number;
  maxDays?: number;
  fallback: boolean;
};

const AVG_ITEM_WEIGHT_G = 150;
const PACKAGING_WEIGHT_G = 150;

export function RussianPostCalculator() {
  const [postcode, setPostcode] = useState("");
  const [count, setCount] = useState(1);
  const [subtotal, setSubtotal] = useState("1500");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = /^\d{6}$/.test(postcode.replace(/\D/g, ""));

  const calculate = async () => {
    setError(null);
    setResult(null);
    if (!valid) {
      setError("Введите индекс из 6 цифр");
      return;
    }
    setLoading(true);
    try {
      const sum = Math.max(0, Math.round(Number(subtotal) || 0));
      const response = await fetch("/api/delivery/russian-post/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postcode: postcode.replace(/\D/g, ""),
          weightGrams: PACKAGING_WEIGHT_G + count * AVG_ITEM_WEIGHT_G,
          subtotal: sum,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось рассчитать тариф");
      }
      setResult(data as Result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка расчёта. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card p-6 ring-1 ring-line/60 sm:p-8">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-green">Калькулятор Почты России</div>
      <h2 className="heading mt-2 text-3xl sm:text-4xl">Сколько стоит доставка</h2>
      <p className="mt-2 text-sm text-muted">
        Тариф запрашиваем у Почты России по вашему индексу. Точную стоимость для вашей корзины
        покажем при оформлении — там же применится бесплатная доставка от {formatPrice(FREE_DELIVERY_THRESHOLD)}.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Индекс</span>
          <input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="101000"
            className="h-12 w-full rounded-2xl bg-bg2 px-4 text-base outline-none ring-1 ring-line/60 focus:ring-green"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Фигурок</span>
          <span className="flex h-12 items-center justify-between rounded-2xl bg-bg2 px-1 ring-1 ring-line/60">
            <button
              type="button"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              disabled={count <= 1}
              aria-label="Меньше"
              className="flex h-10 w-10 items-center justify-center text-xl disabled:text-line"
            >
              −
            </button>
            <span className="text-base font-bold tabular-nums">{count}</span>
            <button
              type="button"
              onClick={() => setCount((c) => Math.min(10, c + 1))}
              disabled={count >= 10}
              aria-label="Больше"
              className="flex h-10 w-10 items-center justify-center text-xl disabled:text-line"
            >
              +
            </button>
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Сумма, ₽</span>
          <input
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="1500"
            className="h-12 w-full rounded-2xl bg-bg2 px-4 text-base outline-none ring-1 ring-line/60 focus:ring-green"
          />
        </label>
        <button
          type="button"
          onClick={calculate}
          disabled={loading}
          className="h-12 shrink-0 rounded-full bg-green px-6 text-sm font-bold uppercase tracking-wider text-bg transition-transform disabled:opacity-50 md:hover:scale-[1.02]"
        >
          {loading ? "Считаем…" : "Рассчитать"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-pink/10 px-4 py-3 text-sm text-pink" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-2xl bg-green/10 px-4 py-3 text-sm ring-1 ring-green/30" role="status">
          <span className="font-bold text-green">≈ {formatPrice(result.mailCost)}</span>
          {formatDeliveryDays(result.minDays, result.maxDays) && (
            <span className="text-muted"> · срок {formatDeliveryDays(result.minDays, result.maxDays)}</span>
          )}
          {result.fallback && (
            <span className="text-muted"> · сайт Почты недоступен, показан стандартный тариф</span>
          )}
          <span className="mt-1 block text-xs text-muted">
            Ориентир для посылки ~{PACKAGING_WEIGHT_G + count * AVG_ITEM_WEIGHT_G} г. Заказы от{" "}
            {formatPrice(FREE_DELIVERY_THRESHOLD)} доставляем бесплатно.
          </span>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Отследить посылку можно по трек-номеру с чека:{" "}
        <a href="https://www.pochta.ru/tracking" target="_blank" rel="noreferrer" className="text-green hover:underline">
          pochta.ru/tracking ↗
        </a>
      </p>
    </div>
  );
}
