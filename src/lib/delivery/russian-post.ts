/**
 * ============================================================
 *  ИНТЕГРАЦИЯ С ПОЧТОЙ РОССИИ
 * ============================================================
 *
 * Режимы работы (по приоритету):
 *
 * 1) API «Отправка» (otpravka.pochta.ru) — если заданы POCHTA_TOKEN и
 *    POCHTA_KEY (договор юрлица/ИП с Почтой). Тариф считается по
 *    персональным условиям договора, доступна нормализация адресов.
 *
 * 2) Публичный тарификатор (tariff.pochta.ru) + сроки доставки
 *    (delivery.pochta.ru). Без авторизации, по открытым тарифам.
 *    Основной режим для магазина без договора.
 *
 * 3) Fallback — фиксированные 300 ₽ (FIXED_DELIVERY_COST), если оба API
 *    недоступны. Оформление заказа никогда не блокируется из-за Почты.
 *
 * Ценообразование (гибрид): при сумме товаров от FREE_DELIVERY_THRESHOLD
 * доставка Почтой бесплатна, ниже порога — живой тариф из API.
 * Итоговая стоимость всегда пересчитывается на сервере (см. orders.ts).
 *
 * Переменные окружения (см. .env.example):
 *   POCHTA_FROM_INDEX            — индекс пункта отправления (Краснодар)
 *   POCHTA_TARIFF_OBJECT         — код объекта тарификации (по умолчанию 27030 «Посылка стандарт»)
 *   POCHTA_DEFAULT_ITEM_WEIGHT_G — вес одного изделия по умолчанию, г
 *   POCHTA_PACKAGING_WEIGHT_G    — вес упаковки посылки, г
 *   POCHTA_MAX_WEIGHT_G          — предел веса для онлайн-расчёта, г
 *   POCHTA_TOKEN / POCHTA_KEY    — доступ к API «Отправка» (необязательно)
 */

import { FIXED_DELIVERY_COST } from "@/lib/constants";

export type RussianPostQuoteSource = "otpravka" | "tariff" | "fallback";

export type RussianPostQuote = {
  /** Стоимость доставки в рублях (округлённо, с НДС). */
  cost: number;
  /** Минимальный срок доставки в днях (если удалось узнать). */
  minDays?: number;
  /** Максимальный срок доставки в днях (если удалось узнать). */
  maxDays?: number;
  /** Каким API посчитано. */
  source: RussianPostQuoteSource;
  /** true, если API недоступны и взят фиксированный тариф. */
  fallback: boolean;
  /** Вес посылки в граммах, для которого посчитан тариф. */
  weightGrams: number;
};

export type RussianPostConfig = {
  fromIndex: string;
  tariffObject: string;
  defaultItemWeightG: number;
  packagingWeightG: number;
  maxWeightG: number;
};

const TARIFF_API = "https://tariff.pochta.ru/tariff/v1/calculate";
const DELIVERY_API = "https://delivery.pochta.ru/delivery/v1/calculate";
const OTPRAVKA_API = "https://otpravka.pochta.ru/1.0";

const REQUEST_TIMEOUT_MS = 8_000;
// Тарифы меняются редко — кэшируем удачные расчёты 6 часов,
// fallback-ответы — 5 минут (чтобы не долбить упавший API).
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const FALLBACK_CACHE_TTL_MS = 5 * 60 * 1_000;
const CACHE_MAX_ENTRIES = 500;

type CacheEntry = { expiresAt: number; quote: RussianPostQuote };
const quoteCache = new Map<string, CacheEntry>();

function numEnv(name: string, def: number, min: number, max: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return def;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

export function getRussianPostConfig(): RussianPostConfig {
  const fromIndex = (process.env.POCHTA_FROM_INDEX ?? "350000").replace(/\D/g, "") || "350000";
  return {
    fromIndex,
    tariffObject: (process.env.POCHTA_TARIFF_OBJECT ?? "27030").replace(/\D/g, "") || "27030",
    defaultItemWeightG: numEnv("POCHTA_DEFAULT_ITEM_WEIGHT_G", 150, 10, 5000),
    packagingWeightG: numEnv("POCHTA_PACKAGING_WEIGHT_G", 150, 0, 5000),
    maxWeightG: numEnv("POCHTA_MAX_WEIGHT_G", 20_000, 1000, 31_500),
  };
}

/** Доступ к API «Отправка» по договору (токен + ключ) настроен. */
export function isOtpravkaConfigured() {
  return Boolean(process.env.POCHTA_TOKEN?.trim() && process.env.POCHTA_KEY?.trim());
}

/* ---------------- Индексы и трек-номера ---------------- */

/** Оставляет только цифры. */
export function normalizePostcode(raw: string) {
  return (raw ?? "").replace(/\D/g, "").slice(0, 6);
}

/** Индекс Почты России — 6 цифр. */
export function isValidPostcode(raw: string) {
  const digits = normalizePostcode(raw);
  return /^\d{6}$/.test(digits) && digits !== "000000";
}

/**
 * Нормализует трек-номер: верхний регистр, без пробелов.
 * Внутрироссийские РПО — 14 цифр, международные — формат S10 (например, RA123456789RU).
 */
export function normalizeTrackingNumber(raw: string) {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);
}

export function isTrackingNumber(raw: string) {
  const value = normalizeTrackingNumber(raw);
  return /^\d{14}$/.test(value) || /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(value);
}

/** Ссылка на официальное отслеживание отправления. */
export function getRussianPostTrackingUrl(trackingNumber: string) {
  return `https://www.pochta.ru/tracking#${encodeURIComponent(normalizeTrackingNumber(trackingNumber))}`;
}

/* ---------------- Вес посылки ---------------- */

export function estimateParcelWeightGrams(
  lines: { weightGrams?: number | null; quantity: number }[],
  config: RussianPostConfig = getRussianPostConfig()
) {
  const items = lines.reduce((sum, line) => {
    const perUnit =
      line.weightGrams && Number.isFinite(line.weightGrams) && line.weightGrams > 0
        ? Math.round(line.weightGrams)
        : config.defaultItemWeightG;
    const qty = Math.max(1, Math.min(99, Math.floor(line.quantity) || 1));
    return sum + perUnit * qty;
  }, 0);
  // Минимум 100 г — легче посылок тарификатор не считает.
  return Math.max(100, items + config.packagingWeightG);
}

/* ---------------- Расчёт тарифа ---------------- */

export async function getRussianPostQuote(opts: {
  postcode: string;
  weightGrams: number;
  /** Объявленная ценность в рублях (обычно = сумме товаров). */
  declaredValueRub?: number;
}): Promise<RussianPostQuote> {
  const config = getRussianPostConfig();
  const indexTo = normalizePostcode(opts.postcode);
  if (!isValidPostcode(indexTo)) {
    throw new Error("Укажите корректный индекс (6 цифр)");
  }
  const weightGrams = Math.max(100, Math.round(opts.weightGrams) || 100);
  const declaredKopecks = Math.max(0, Math.round((opts.declaredValueRub ?? 0) * 100));

  // Слишком тяжёлые посылки онлайн-тарифом не считаем — сразу fallback,
  // чтобы не показывать покупателю ошибку API.
  if (weightGrams > config.maxWeightG) {
    return fallbackQuote(weightGrams, config);
  }

  const cacheKey = `${config.fromIndex}:${config.tariffObject}:${indexTo}:${weightGrams}:${declaredKopecks}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.quote;
  }

  // 1) API «Отправка» — персональные тарифы по договору.
  if (isOtpravkaConfigured()) {
    try {
      const quote = await quoteViaOtpravka(indexTo, weightGrams, config);
      putCache(cacheKey, quote, false);
      return quote;
    } catch (error) {
      console.error("[pochta] otpravka tariff failed, trying public tarifficator:", shortError(error));
    }
  }

  // 2) Публичный тарификатор + сроки доставки.
  try {
    const [costRub, days] = await Promise.all([
      quoteViaTarifficator(indexTo, weightGrams, declaredKopecks, config),
      quoteDeliveryDays(indexTo, weightGrams, config).catch((error) => {
        console.error("[pochta] delivery terms failed (non-fatal):", shortError(error));
        return undefined;
      }),
    ]);
    const quote: RussianPostQuote = {
      cost: costRub,
      source: "tariff",
      fallback: false,
      weightGrams,
      ...(days ?? {}),
    };
    putCache(cacheKey, quote, false);
    return quote;
  } catch (error) {
    console.error("[pochta] public tarifficator failed, using fallback:", shortError(error));
  }

  // 3) Fallback — фиксированный тариф.
  const quote = fallbackQuote(weightGrams, config);
  putCache(cacheKey, quote, true);
  return quote;
}

function fallbackQuote(weightGrams: number, _config: RussianPostConfig): RussianPostQuote {
  return { cost: FIXED_DELIVERY_COST, source: "fallback", fallback: true, weightGrams };
}

function putCache(key: string, quote: RussianPostQuote, isFallback: boolean) {
  if (quoteCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = quoteCache.keys().next();
    if (!oldest.done) quoteCache.delete(oldest.value);
  }
  quoteCache.set(key, {
    quote,
    expiresAt: Date.now() + (isFallback ? FALLBACK_CACHE_TTL_MS : CACHE_TTL_MS),
  });
}

function shortError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Неожиданный ответ API: ${text.slice(0, 200)}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Превышен таймаут запроса (${REQUEST_TIMEOUT_MS} мс)`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Публичный тарификатор: https://tariff.pochta.ru — суммы в копейках. */
async function quoteViaTarifficator(
  indexTo: string,
  weightGrams: number,
  declaredKopecks: number,
  config: RussianPostConfig
): Promise<number> {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const url =
    `${TARIFF_API}?json` +
    `&object=${encodeURIComponent(config.tariffObject)}` +
    `&from=${encodeURIComponent(config.fromIndex)}` +
    `&to=${encodeURIComponent(indexTo)}` +
    `&weight=${weightGrams}` +
    `&sumoc=${declaredKopecks}` +
    `&date=${stamp}`;
  const data = await fetchJson(url);

  const errors = Array.isArray(data.errors) ? data.errors : Array.isArray(data.error) ? data.error : [];
  if (errors.length > 0) {
    const messages = errors
      .map((item) => (typeof item === "string" ? item : (item as { msg?: string })?.msg ?? ""))
      .filter(Boolean)
      .join("; ");
    throw new Error(messages || "Тарификатор отклонил запрос");
  }

  // Ответ содержит paynds (итог с НДС, коп.) и ground.valnds (наземный тариф, коп.).
  // Перебираем известные поля, чтобы пережить смену формата.
  const ground = (data.ground ?? {}) as Record<string, unknown>;
  const candidates = [
    data.paynds,
    data.payNds,
    ground.valnds,
    ground.valNds,
    (data as Record<string, unknown>)["total-rate"],
    data.totalRate,
    data.pay,
  ];
  for (const candidate of candidates) {
    const kop = Number(candidate);
    if (Number.isFinite(kop) && kop > 0) {
      return Math.max(1, Math.round(kop / 100));
    }
  }
  throw new Error("Тарификатор не вернул стоимость");
}

/** Публичные сроки доставки: https://delivery.pochta.ru. Best-effort. */
async function quoteDeliveryDays(
  indexTo: string,
  weightGrams: number,
  config: RussianPostConfig
): Promise<{ minDays: number; maxDays: number } | undefined> {
  const url =
    `${DELIVERY_API}?json` +
    `&object=${encodeURIComponent(config.tariffObject)}` +
    `&from=${encodeURIComponent(config.fromIndex)}` +
    `&to=${encodeURIComponent(indexTo)}` +
    `&weight=${weightGrams}`;
  const data = await fetchJson(url);
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = Number(data[key]);
      if (Number.isFinite(value) && value > 0 && value < 365) return Math.round(value);
    }
    return undefined;
  };
  const minDays = pick("min-days", "minDays", "deliveryPeriodMin", "periodMin", "min");
  const maxDays = pick("max-days", "maxDays", "deliveryPeriodMax", "periodMax", "max");
  if (minDays === undefined && maxDays === undefined) return undefined;
  return { minDays: minDays ?? maxDays!, maxDays: maxDays ?? minDays! };
}

/** API «Отправка» по договору: POST /1.0/tariff, суммы в копейках. */
async function quoteViaOtpravka(
  indexTo: string,
  weightGrams: number,
  config: RussianPostConfig
): Promise<RussianPostQuote> {
  const token = process.env.POCHTA_TOKEN!.trim();
  const key = process.env.POCHTA_KEY!.trim();
  const data = await fetchJson(`${OTPRAVKA_API}/tariff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `AccessToken ${token}`,
      "X-User-Authorization": `Basic ${key}`,
    },
    body: JSON.stringify({
      "index-from": config.fromIndex,
      "index-to": indexTo,
      "mail-category": "ORDINARY",
      "mail-type": "POSTAL_PARCEL",
      mass: weightGrams,
      "payment-method": "CASHLESS",
      fragile: false,
      "with-simple-notice": false,
      "with-order-of-notice": false,
    }),
  });

  const totalRate = Number((data as Record<string, unknown>)["total-rate"] ?? data.totalRate);
  if (!Number.isFinite(totalRate) || totalRate <= 0) {
    const desc =
      (data as Record<string, unknown>)["error-message"] ??
      (data as Record<string, unknown>).message ??
      JSON.stringify(data).slice(0, 200);
    throw new Error(`API «Отправка» не вернуло тариф: ${String(desc).slice(0, 200)}`);
  }
  const time = ((data as Record<string, unknown>)["delivery-time"] ?? {}) as Record<string, unknown>;
  const minDays = Number(time["min-days"]);
  const maxDays = Number(time["max-days"]);
  return {
    cost: Math.max(1, Math.round(totalRate / 100)),
    source: "otpravka",
    fallback: false,
    weightGrams,
    ...(Number.isFinite(minDays) && minDays > 0 ? { minDays: Math.round(minDays) } : {}),
    ...(Number.isFinite(maxDays) && maxDays > 0 ? { maxDays: Math.round(maxDays) } : {}),
  };
}

/* ---------------- Нормализация адреса (только «Отправка») ---------------- */

export type NormalizedAddress = {
  /** Индекс, подобранный Почтой. */
  postcode?: string;
  /** Полный нормализованный адрес. */
  address?: string;
  /** Код качества распознавания (0 — идеально). */
  qualityCode?: string;
  /** Сырой ответ API для диагностики. */
  raw: unknown;
};

/**
 * Проверка адреса и автоподбор индекса через API «Отправка».
 * Требует договора (POCHTA_TOKEN + POCHTA_KEY), без них возвращает null.
 * Не бросает исключений — ошибки только логируются.
 */
export async function normalizeAddressViaOtpravka(
  address: string
): Promise<NormalizedAddress | null> {
  if (!isOtpravkaConfigured()) return null;
  const original = address.trim();
  if (!original) return null;
  try {
    const token = process.env.POCHTA_TOKEN!.trim();
    const key = process.env.POCHTA_KEY!.trim();
    const data = (await fetchJson(`${OTPRAVKA_API}/clean/address`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `AccessToken ${token}`,
        "X-User-Authorization": `Basic ${key}`,
      },
      body: JSON.stringify([{ "original-address": original }]),
    })) as unknown;
    const first = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!first) return { raw: data };
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = first[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return undefined;
    };
    return {
      postcode: pick("index", "postcode", "post-code"),
      address: pick("address", "full-address", "fullAddress"),
      qualityCode: pick("quality-code", "qualityCode"),
      raw: data,
    };
  } catch (error) {
    console.error("[pochta] address normalization failed:", shortError(error));
    return null;
  }
}
