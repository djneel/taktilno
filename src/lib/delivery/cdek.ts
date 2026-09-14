/**
 * ============================================================
 *  ИНТЕГРАЦИЯ С СДЭК (API v2)
 * ============================================================
 *
 * Схема работы:
 *
 * 1) Живой тариф — API СДЭК v2 (https://api.cdek.ru/v2), если заданы
 *    CDEK_ACCOUNT и CDEK_SECRET (договор с СДЭК: ЛК → Настройки → API).
 *    Город получателя ищется в реестре СДЭК (/location/cities), затем
 *    калькулятор (/calculator/tariff) считает тариф «Посылка склад-склад»
 *    (по умолчанию 136) до пункта выдачи в этом городе.
 *
 * 2) Fallback — фиксированные 300 ₽ (FIXED_DELIVERY_COST), если договора
 *    нет или API недоступен. Оформление заказа никогда не блокируется
 *    из-за СДЭК: покупатель всегда видит понятную цену.
 *
 * Ценообразование (гибрид, как у Почты России): при сумме товаров от
 * FREE_DELIVERY_THRESHOLD доставка бесплатна, ниже порога — живой тариф
 * СДЭК. Итоговая стоимость всегда пересчитывается на сервере (см. orders.ts).
 *
 * Переменные окружения (см. .env.example):
 *   CDEK_ACCOUNT / CDEK_SECRET        — Account и Secure password из ЛК СДЭК (обязательны)
 *   CDEK_API_URL                      — по умолчанию https://api.cdek.ru/v2
 *                                       (тестовый контур: https://api.edu.cdek.ru/v2)
 *   CDEK_FROM_CITY                    — город отправления, по умолчанию «Краснодар»
 *   CDEK_FROM_CITY_CODE               — код города отправления в реестре СДЭК (необязательно)
 *   CDEK_FROM_POSTAL_CODE             — индекс отправления (необязательно)
 *   CDEK_TARIFF_CODE                  — 136 «Посылка склад-склад» (по умолчанию), 234 — экономичная
 *   CDEK_DEFAULT_ITEM_WEIGHT_G        — вес одного изделия по умолчанию, г
 *   CDEK_PACKAGE_WEIGHT_G             — вес упаковки посылки, г
 *   CDEK_PACKAGE_LENGTH_CM / _WIDTH_CM / _HEIGHT_CM — габариты посылки, см
 *   CDEK_MAX_WEIGHT_G                 — предел веса для онлайн-расчёта, г
 */

import { FIXED_DELIVERY_COST } from "@/lib/constants";

export type CdekQuoteSource = "api" | "fallback";

/** Почему не удалось посчитать живой тариф (для админки и диагностики). */
export type CdekFallbackReason = "not-configured" | "weight-limit" | "api-error";

export type CdekQuote = {
  /** Стоимость доставки в рублях (округлённо). */
  cost: number;
  /** Минимальный срок доставки в рабочих днях (если удалось узнать). */
  minDays?: number;
  /** Максимальный срок доставки в рабочих днях (если удалось узнать). */
  maxDays?: number;
  /** Каким способом посчитано: живые API СДЭК или стандартный тариф. */
  source: CdekQuoteSource;
  /** true, если взят стандартный тариф вместо тарифа СДЭК. */
  fallback: boolean;
  /** Причина fallback — заполняется только когда fallback = true. */
  reason?: CdekFallbackReason;
  /** Вес посылки в граммах, для которого посчитан тариф. */
  weightGrams: number;
  /** Код тарифа СДЭК, по которому посчитано (если удалось). */
  tariffCode?: number;
  /** Код города получателя в реестре СДЭК (если удалось определить). */
  cityCode?: number;
};

export type CdekConfig = {
  account: string;
  secret: string;
  baseUrl: string;
  fromCity: string;
  fromCityCode: number | null;
  fromPostalCode: string;
  tariffCode: number;
  defaultItemWeightG: number;
  packagingWeightG: number;
  maxWeightG: number;
  packageSize: { length: number; width: number; height: number };
};

const DEFAULT_API_URL = "https://api.cdek.ru/v2";

// Запасные тарифы, если настроенный недоступен для направления.
// 136 — «Посылка склад-склад», 234 — «Экономичная посылка склад-склад»
// (действует на дальних направлениях), 368 — «Посылка склад-постамат».
const FALLBACK_TARIFF_CODES = [136, 234, 368];

const REQUEST_TIMEOUT_MS = 8_000;
// Тарифы СДЭК меняются редко — кэшируем удачные расчёты 6 часов,
// fallback-ответы — 5 минут, чтобы не долбить упавший API.
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const FALLBACK_CACHE_TTL_MS = 5 * 60 * 1_000;
const CITY_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const CACHE_MAX_ENTRIES = 500;

type CacheEntry<T> = { expiresAt: number; value: T };

const quoteCache = new Map<string, CacheEntry<CdekQuote>>();
const cityCodeCache = new Map<string, CacheEntry<number | null>>();
let tokenCache: CacheEntry<string> | null = null;

/** Логическая ошибка API СДЭК (ответ получен, но запрос отклонён). */
class CdekApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CdekApiError";
  }
}

/** HTTP-ошибка API СДЭК (важен код: по 401 обновляем токен и повторяем запрос). */
class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
}

function numEnv(name: string, def: number, min: number, max: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return def;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

export function getCdekConfig(): CdekConfig {
  const cityCode = Number(process.env.CDEK_FROM_CITY_CODE);
  return {
    account: process.env.CDEK_ACCOUNT?.trim() ?? "",
    secret: process.env.CDEK_SECRET?.trim() ?? "",
    baseUrl: (process.env.CDEK_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, ""),
    fromCity: process.env.CDEK_FROM_CITY?.trim() || "Краснодар",
    fromCityCode: Number.isFinite(cityCode) && cityCode > 0 ? Math.round(cityCode) : null,
    fromPostalCode: (process.env.CDEK_FROM_POSTAL_CODE ?? "").replace(/\D/g, "").slice(0, 6),
    tariffCode: numEnv("CDEK_TARIFF_CODE", 136, 1, 9999),
    defaultItemWeightG: numEnv("CDEK_DEFAULT_ITEM_WEIGHT_G", 150, 10, 5000),
    packagingWeightG: numEnv("CDEK_PACKAGE_WEIGHT_G", 150, 0, 5000),
    maxWeightG: numEnv("CDEK_MAX_WEIGHT_G", 30_000, 1000, 50_000),
    packageSize: {
      length: numEnv("CDEK_PACKAGE_LENGTH_CM", 20, 1, 200),
      width: numEnv("CDEK_PACKAGE_WIDTH_CM", 15, 1, 200),
      height: numEnv("CDEK_PACKAGE_HEIGHT_CM", 12, 1, 200),
    },
  };
}

/** Договор с СДЭК настроен — можно считать живой тариф. */
export function isCdekConfigured() {
  const config = getCdekConfig();
  return Boolean(config.account && config.secret);
}

/** Тестовый контур СДЭК (см. CDEK_API_URL). */
export function isCdekTestMode() {
  return getCdekConfig().baseUrl !== DEFAULT_API_URL;
}

/* ---------------- Трек-номера ---------------- */

/** Нормализует трек-номер СДЭК: верхний регистр, без пробелов и дефисов. */
export function normalizeCdekTrackingNumber(raw: string) {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);
}

/**
 * Трек-номер СДЭК: обычно 10 цифр (внутрироссийские заказы), 14 цифр
 * у международных отправлений, иногда с буквенным префиксом.
 */
export function isCdekTrackingNumber(raw: string) {
  const value = normalizeCdekTrackingNumber(raw);
  return /^[A-Z0-9]{8,20}$/.test(value) && /\d{6,}/.test(value);
}

/** Ссылка на официальное отслеживание отправления СДЭК. */
export function getCdekTrackingUrl(trackingNumber: string) {
  return `https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(normalizeCdekTrackingNumber(trackingNumber))}`;
}

/* ---------------- Расчёт тарифа ---------------- */

export async function getCdekQuote(opts: {
  /** Город получателя — обязателен (доставка в ПВЗ этого города). */
  city: string;
  /** Адрес пункта выдачи — уточняет расчёт, если СДЭК сможет сопоставить. */
  address?: string;
  /** Индекс получателя, если известен. */
  postcode?: string;
  weightGrams: number;
  /** Объявленная ценность в рублях (для справки и услуг страхования). */
  declaredValueRub?: number;
}): Promise<CdekQuote> {
  const config = getCdekConfig();
  const city = (opts.city ?? "").trim();

  if (!isCdekConfigured()) {
    return fallbackQuote(opts.weightGrams, "not-configured");
  }
  if (city.length < 2) {
    return fallbackQuote(opts.weightGrams, "api-error");
  }

  const weightGrams = Math.max(100, Math.round(opts.weightGrams) || 100);
  if (weightGrams > config.maxWeightG) {
    return fallbackQuote(weightGrams, "weight-limit");
  }

  const postcode = (opts.postcode ?? "").replace(/\D/g, "").slice(0, 6);
  const cacheKey = `${config.tariffCode}:${city.toLowerCase()}:${postcode}:${weightGrams}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const location = await resolveDestination({ city, address: opts.address, postcode }, config);
    const quote = await quoteViaTariff(location, weightGrams, config);
    putCache(quoteCache, cacheKey, quote, false);
    return quote;
  } catch (error) {
    console.error("[cdek] tariff request failed, using fallback:", shortError(error));
    const quote = fallbackQuote(weightGrams, "api-error");
    putCache(quoteCache, cacheKey, quote, true);
    return quote;
  }
}

/** Город получателя в формате запроса СДЭК: код из реестра либо индекс/название. */
type CdekLocation = { code?: number; city: string; address?: string; postal_code?: string; country_code?: string };

async function resolveDestination(
  opts: { city: string; address?: string; postcode?: string },
  config: CdekConfig
): Promise<CdekLocation> {
  const address = (opts.address ?? "").trim().slice(0, 255);
  // Индекс — самый точный способ без справочника городов.
  if (opts.postcode && /^\d{6}$/.test(opts.postcode)) {
    return {
      city: opts.city,
      postal_code: opts.postcode,
      country_code: "RU",
      ...(address ? { address } : {}),
    };
  }
  const code = await resolveCityCode(opts.city, config);
  if (code) return { code, city: cityQuery(opts.city) };
  return { city: cityQuery(opts.city), country_code: "RU", ...(address ? { address } : {}) };
}

/** «г. Москва», «город Псков» → «Москва», «Псков» — реестр СДЭК ждёт чистое название. */
function cityQuery(city: string) {
  return city
    .replace(/^\s*(?:г\.|гор\.|город)\s*/i, "")
    .replace(/[«»"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Код города в реестре СДЭК (метод «Список населённых пунктов»). Кэш — сутки. */
export async function resolveCityCode(city: string, config = getCdekConfig()): Promise<number | null> {
  const query = cityQuery(city);
  const key = query.toLowerCase();
  if (!key) return null;
  const cached = cityCodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: number | null = null;
  try {
    const url =
      `${config.baseUrl}/location/cities?country_codes=RU` +
      `&city=${encodeURIComponent(query)}&size=1`;
    const data = await authorizedFetch<unknown>(url, { method: "GET" }, config);
    const list = Array.isArray(data)
      ? data
      : Array.isArray((data as { items?: unknown })?.items)
        ? ((data as { items: unknown[] }).items)
        : [];
    const first = list[0] as { code?: unknown } | undefined;
    const code = Number(first?.code);
    if (Number.isFinite(code) && code > 0) value = Math.round(code);
  } catch (error) {
    console.error("[cdek] city lookup failed:", shortError(error));
  }

  putCache(cityCodeCache, key, value, value === null);
  return value;
}

/** Калькулятор СДЭК по коду тарифа с перебором запасных тарифов. */
async function quoteViaTariff(
  location: CdekLocation,
  weightGrams: number,
  config: CdekConfig
): Promise<CdekQuote> {
  const from: CdekLocation = config.fromCityCode
    ? { code: config.fromCityCode, city: config.fromCity }
    : {
        city: config.fromCity,
        country_code: "RU",
        ...(config.fromPostalCode.length === 6 ? { postal_code: config.fromPostalCode } : {}),
      };

  let lastError: unknown;
  for (const tariffCode of tariffChain(config)) {
    try {
      const data = await authorizedFetch<Record<string, unknown>>(
        `${config.baseUrl}/calculator/tariff`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: 1,
            currency: 1,
            tariff_code: tariffCode,
            from_location: from,
            to_location: location,
            packages: [
              {
                weight: weightGrams,
                length: config.packageSize.length,
                width: config.packageSize.width,
                height: config.packageSize.height,
              },
            ],
          }),
        },
        config
      );

      const cost = pickCost(data);
      if (cost === null) {
        throw new CdekApiError("СДЭК не вернул стоимость доставки");
      }
      return {
        cost,
        source: "api",
        fallback: false,
        weightGrams,
        tariffCode,
        ...dayBounds(data),
        ...(location.code ? { cityCode: location.code } : {}),
      };
    } catch (error) {
      lastError = error;
      // Ошибка авторизации/сети — перебор тарифов не поможет.
      if (!(error instanceof CdekApiError)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new CdekApiError("СДЭК отклонил расчёт тарифа");
}

/** Цепочка тарифов без повторов: настроенный + запасные. */
function tariffChain(config: CdekConfig): number[] {
  const chain = [config.tariffCode, ...FALLBACK_TARIFF_CODES];
  return chain.filter((code, index) => Number.isFinite(code) && chain.indexOf(code) === index);
}

/** Стоимость из ответа: total_sum (с доп. услугами) или delivery_sum. */
function pickCost(data: Record<string, unknown>): number | null {
  for (const candidate of [data.total_sum, data.delivery_sum, data.deliverySum, data.totalSum]) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return Math.max(1, Math.round(value));
  }
  return null;
}

function dayBounds(data: Record<string, unknown>) {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = Number(data[key]);
      if (Number.isFinite(value) && value > 0 && value < 365) return Math.round(value);
    }
    return undefined;
  };
  const minDays = pick("period_min", "periodMin");
  const maxDays = pick("period_max", "periodMax");
  if (minDays === undefined && maxDays === undefined) return {};
  return {
    minDays: minDays ?? maxDays!,
    maxDays: maxDays ?? minDays!,
  };
}

function fallbackQuote(weightGrams: number, reason: CdekFallbackReason): CdekQuote {
  return {
    cost: FIXED_DELIVERY_COST,
    source: "fallback",
    fallback: true,
    reason,
    weightGrams: Math.max(100, Math.round(weightGrams) || 100),
  };
}

function putCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, isFallback: boolean) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + (isFallback ? FALLBACK_CACHE_TTL_MS : CACHE_TTL_MS),
  });
}

function shortError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

/* ---------------- Авторизация и запросы ---------------- */

/** OAuth-токен СДЭК (client_credentials). Живёт час — кэшируем в памяти. */
async function getAccessToken(config: CdekConfig, force = false): Promise<string> {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.account,
    client_secret: config.secret,
  });
  const data = await fetchJson(`${config.baseUrl}/oauth/token?parameters`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const token = String((data as { access_token?: unknown }).access_token ?? "");
  if (!token) {
    throw new CdekApiError("СДЭК не вернул access_token — проверьте CDEK_ACCOUNT и CDEK_SECRET");
  }
  const expiresIn = Number((data as { expires_in?: unknown }).expires_in);
  const ttlSeconds = Number.isFinite(expiresIn) && expiresIn > 60 ? expiresIn : 3600;
  tokenCache = { value: token, expiresAt: Date.now() + (ttlSeconds - 60) * 1_000 };
  return token;
}

/** Запрос к API СДЭК с авторизацией и одним повтором после 401. */
async function authorizedFetch<T>(url: string, init: RequestInit, config: CdekConfig): Promise<T> {
  const call = async (force: boolean) => {
    const token = await getAccessToken(config, force);
    return fetchJson(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });
  };
  try {
    return (await call(false)) as T;
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      tokenCache = null;
      return (await call(true)) as T;
    }
    throw error;
  }
}

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = null;
    }
    if (!res.ok) {
      const details = collectErrors(data);
      throw new HttpError(
        `HTTP ${res.status}${details ? `: ${details}` : `: ${text.slice(0, 200)}`}`,
        res.status
      );
    }
    if (data === null) {
      throw new CdekApiError(`Неожиданный ответ API СДЭК: ${text.slice(0, 200)}`);
    }
    const details = collectErrors(data);
    // v2 отвечает 200 с блоком errors — это логическая ошибка, а не успех.
    if (details) throw new CdekApiError(details);
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Превышен таймаут запроса к СДЭК (${REQUEST_TIMEOUT_MS} мс)`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Текст ошибок из ответа СДЭК: { errors: [...] } или { requests: [{ errors: [...] }] }. */
function collectErrors(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const source = data as { errors?: unknown; requests?: unknown };
  const groups: unknown[] = Array.isArray(source.errors) ? [...source.errors] : [];
  if (Array.isArray(source.requests)) {
    for (const request of source.requests) {
      const nested = (request as { errors?: unknown })?.errors;
      if (Array.isArray(nested)) groups.push(...nested);
    }
  }
  const messages = groups
    .map((item) => (typeof item === "string" ? item : ((item as { message?: string })?.message ?? "")))
    .filter(Boolean);
  if (messages.length === 0) return null;
  return messages.slice(0, 3).join("; ").slice(0, 300);
}
