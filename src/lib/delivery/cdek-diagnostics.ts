/**
 * ============================================================
 *  ДИАГНОСТИКА ИНТЕГРАЦИИ С СДЭК
 * ============================================================
 *
 * Пошаговая проверка всей цепочки расчёта живого тарифа — для
 * админки (кнопка «Диагностика СДЭК» на странице настроек):
 *
 *   1. config   — переменные окружения (CDEK_ACCOUNT/CDEK_SECRET и настройки),
 *                 контур (боевой/тестовый), маскированные креды;
 *   2. auth     — получение OAuth-токена у api.cdek.ru (всегда начисто, кэш сбрасывается);
 *   3. location — поиск города получателя в реестре СДЭК (/location/cities);
 *   4. tariff   — расчёт тарифа калькулятором (/calculator/tariff), 500 г.
 *
 * Каждый шаг возвращает статус ok/warn/error/skipped, длительность и
 * подсказку, что чинить. Диагностика ничего не меняет в работе магазина:
 * заказы в любом случае оформляются по стандартному тарифу (см. cdek.ts).
 *
 * Используется серверным экшеном runCdekDiagnosticsAction (admin-actions.ts).
 */

import {
  clearCdekCaches,
  getCdekConfig,
  getCdekQuote,
  getAccessToken,
  isCdekConfigured,
  isCdekTestMode,
  resolveCityCode,
  type CdekConfig,
} from "./cdek";

export type CdekDiagnosticStatus = "ok" | "warn" | "error" | "skipped";

export type CdekDiagnosticStepId = "config" | "auth" | "location" | "tariff";

export type CdekDiagnosticStep = {
  id: CdekDiagnosticStepId;
  /** Человекочитаемое название шага. */
  title: string;
  status: CdekDiagnosticStatus;
  /** Краткий итог шага — что именно проверялось и чем закончилось. */
  message: string;
  /** Подсказка по починке (если шаг не прошёл). */
  hint?: string;
  /** Сколько длился шаг, мс (0 для мгновенных проверок). */
  durationMs: number;
  /** Дополнительные строки для развёрнутого вывода. */
  details: [string, string][];
};

export type CdekDiagnosticsVerdict = "live" | "fallback" | "unreachable";

export type CdekDiagnosticsReport = {
  /** live — живой тариф СДЭК работает; fallback — работает стандартный тариф
   *  (договор не настроен — это штатный режим); unreachable — API настроен,
   *  но недоступен, покупатели ходят по стандартному тарифу. */
  verdict: CdekDiagnosticsVerdict;
  /** true, если ни один шаг не завершился ошибкой. */
  ok: boolean;
  steps: CdekDiagnosticStep[];
  totalMs: number;
  /** ISO-момент запуска диагностики. */
  checkedAt: string;
  testCity: string;
};

const DEFAULT_TEST_CITY = "Москва";
/** Вес тестовой посылки для шага «тариф», г. */
const TEST_WEIGHT_GRAMS = 500;

/** Запускает полную диагностику СДЭК. Не бросает исключений — все ошибки внутри шагов. */
export async function runCdekDiagnostics(city?: string): Promise<CdekDiagnosticsReport> {
  const startedAt = Date.now();
  const config = getCdekConfig();
  const testCity = (city ?? "").trim() || DEFAULT_TEST_CITY;
  const steps: CdekDiagnosticStep[] = [];

  // 1. Конфигурация — без неё дальше идти бессмысленно.
  const configStep = checkConfig(config);
  steps.push(configStep);

  let authStep: CdekDiagnosticStep | null = null;
  let locationStep: CdekDiagnosticStep | null = null;
  let tariffStep: CdekDiagnosticStep | null = null;

  if (!isCdekConfigured()) {
    // Штатный режим без договора: магазин работает на стандартном тарифе.
    steps.push(skipStep("auth", "Авторизация (OAuth)", "Пропущено: креды СДЭК не заданы."));
    steps.push(skipStep("location", "Справочник городов", "Пропущено: нет авторизации."));
    steps.push(skipStep("tariff", "Расчёт тарифа", "Пропущено: нет авторизации."));
  } else {
    // Чистая проверка: сбрасываем кэши, чтобы запросы точно ушли в живое API.
    clearCdekCaches();

    authStep = await checkAuth(config);
    steps.push(authStep);

    if (authStep.status === "ok") {
      locationStep = await checkLocation(testCity, config);
      steps.push(locationStep);
      tariffStep = await checkTariff(testCity);
      steps.push(tariffStep);
    } else {
      steps.push(skipStep("location", "Справочник городов", "Пропущено: авторизация не прошла."));
      steps.push(skipStep("tariff", "Расчёт тарифа", "Пропущено: авторизация не прошла."));
    }
  }

  const hasError = steps.some((step) => step.status === "error");
  const tariffOk = tariffStep?.status === "ok";
  const verdict: CdekDiagnosticsVerdict = tariffOk ? "live" : hasError ? "unreachable" : "fallback";
  const totalMs = Date.now() - startedAt;

  // Компактная строка в серверные логи — чтобы диагностику было видно без админки.
  const summary = steps.map((step) => `${step.id}:${step.status}`).join(" → ");
  console.log(`[cdek] diagnostics: ${verdict} (${totalMs} мс) — ${summary}`);

  return {
    verdict,
    ok: !hasError,
    steps,
    totalMs,
    checkedAt: new Date(startedAt).toISOString(),
    testCity,
  };
}

/* ---------------- Шаги диагностики ---------------- */

function checkConfig(config: CdekConfig): CdekDiagnosticStep {
  const configured = Boolean(config.account && config.secret);
  const details: [string, string][] = [
    ["CDEK_ACCOUNT", maskSecret(config.account)],
    ["CDEK_SECRET", config.secret ? `задан (${config.secret.length} симв.)` : "не задан"],
    ["CDEK_API_URL", isCdekTestMode() ? `${config.baseUrl} (тестовый контур)` : `${config.baseUrl} (боевой)`],
    ["Город отправления", config.fromCityCode ? `${config.fromCity} (код ${config.fromCityCode})` : config.fromCity],
    ["Код тарифа", `${config.tariffCode} (запасные: 136, 234, 368)`],
    ["Вес изделия / упаковки", `${config.defaultItemWeightG} г / ${config.packagingWeightG} г`],
    [
      "Габариты посылки",
      `${config.packageSize.length}×${config.packageSize.width}×${config.packageSize.height} см`,
    ],
    ["Предел веса онлайн-расчёта", `${config.maxWeightG} г`],
  ];

  if (!configured) {
    return {
      id: "config",
      title: "Конфигурация",
      status: "warn",
      message:
        "CDEK_ACCOUNT и CDEK_SECRET не заданы — живой тариф выключен, покупатели видят стандартный тариф 300 ₽.",
      hint: "Добавьте ключи из ЛК СДЭК (Настройки → API) в переменные окружения хостинга и сделайте редеплой. Магазин при этом продолжает работать.",
      durationMs: 0,
      details,
    };
  }
  return {
    id: "config",
    title: "Конфигурация",
    status: "ok",
    message: `Креды заданы, контур: ${isCdekTestMode() ? "тестовый" : "боевой"} api.cdek.ru.`,
    durationMs: 0,
    details,
  };
}

async function checkAuth(config: CdekConfig): Promise<CdekDiagnosticStep> {
  const t0 = Date.now();
  try {
    // force=true — всегда новый токен, чтобы проверить актуальность кредов,
    // а не остаток жизни закэшированного.
    const token = await getAccessToken(config, true);
    return {
      id: "auth",
      title: "Авторизация (OAuth)",
      status: "ok",
      message: `Токен получен (${(Date.now() - t0)} мс), живёт ~1 час.`,
      durationMs: Date.now() - t0,
      details: [["Токен", maskSecret(token)]],
    };
  } catch (error) {
    const message = shortError(error);
    const credentialsProblem = /401|403|access_token|client/i.test(message);
    return {
      id: "auth",
      title: "Авторизация (OAuth)",
      status: "error",
      message: `СДЭК не выдал токен: ${message}`,
      hint: credentialsProblem
        ? "Проверьте CDEK_ACCOUNT (это client_id) и CDEK_SECRET (secure password) в ЛК СДЭК → Настройки → API. Убедитесь, что договор подключён к API."
        : "Похоже, api.cdek.ru недоступен с сервера хостинга (сеть/файрвол/таймаут). Повторите позже или проверьте исходящий доступ.",
      durationMs: Date.now() - t0,
      details: [],
    };
  }
}

async function checkLocation(city: string, config: CdekConfig): Promise<CdekDiagnosticStep> {
  const t0 = Date.now();
  try {
    const code = await resolveCityCode(city, config);
    if (code) {
      return {
        id: "location",
        title: "Справочник городов",
        status: "ok",
        message: `Город «${city}» найден в реестре СДЭК — код ${code}.`,
        durationMs: Date.now() - t0,
        details: [],
      };
    }
    return {
      id: "location",
      title: "Справочник городов",
      status: "warn",
      message: `Город «${city}» не найден в реестре — расчёт пойдёт по названию и индексу (как в чекауте).`,
      hint: "Попробуйте другое написание города. Покупателям советуем указывать индекс — он точнее справочника.",
      durationMs: Date.now() - t0,
      details: [],
    };
  } catch (error) {
    return {
      id: "location",
      title: "Справочник городов",
      status: "error",
      message: `Поиск города не удался: ${shortError(error)}`,
      hint: "Метод /location/cities недоступен — вероятно, проблема на стороне API СДЭК. Тариф считается по запасной цепочке.",
      durationMs: Date.now() - t0,
      details: [],
    };
  }
}

async function checkTariff(city: string): Promise<CdekDiagnosticStep> {
  const t0 = Date.now();
  const quote = await getCdekQuote({ city, weightGrams: TEST_WEIGHT_GRAMS, declaredValueRub: 1000 });
  const durationMs = Date.now() - t0;
  const days =
    quote.minDays !== undefined || quote.maxDays !== undefined
      ? `, срок ${quote.minDays ?? "?"}–${quote.maxDays ?? "?"} раб. дн.`
      : "";
  const details: [string, string][] = [
    ["Тестовая посылка", `${city}, ${quote.weightGrams} г`],
    ["Тариф СДЭК", quote.tariffCode ? String(quote.tariffCode) : "не определён"],
    ["Код города", quote.cityCode ? String(quote.cityCode) : "не определён"],
  ];

  if (!quote.fallback) {
    return {
      id: "tariff",
      title: "Расчёт тарифа",
      status: "ok",
      message: `Калькулятор СДЭК посчитал: ${quote.cost} ₽${days}. Живой тариф работает.`,
      durationMs,
      details,
    };
  }
  if (quote.reason === "weight-limit") {
    return {
      id: "tariff",
      title: "Расчёт тарифа",
      status: "warn",
      message: `Тестовые ${TEST_WEIGHT_GRAMS} г превысили CDEK_MAX_WEIGHT_G (${quote.weightGrams} г лимит) — проверьте настройку.`,
      hint: `CDEK_MAX_WEIGHT_G должен быть больше ${TEST_WEIGHT_GRAMS} г (по умолчанию 30000).`,
      durationMs,
      details,
    };
  }
  return {
    id: "tariff",
    title: "Расчёт тарифа",
    status: "error",
    message: `Калькулятор СДЭК отклонил расчёт: ${quote.reason === "not-configured" ? "нет кредов" : "API недоступен"}.`,
    hint: "Смотрите шаги «Авторизация» и «Справочник городов» выше — обычно причина там. До починки покупатели видят стандартный тариф 300 ₽.",
    durationMs,
    details,
  };
}

/* ---------------- Утилиты ---------------- */

function skipStep(id: CdekDiagnosticStepId, title: string, message: string): CdekDiagnosticStep {
  return { id, title, status: "skipped", message, durationMs: 0, details: [] };
}

/** Маскирует значение: оставляет первые 2 и последние 2 символа. */
function maskSecret(value: string) {
  if (!value) return "не задан";
  if (value.length <= 6) return `${value.length} симв. (скрыт)`;
  return `${value.slice(0, 2)}…${value.slice(-2)} (${value.length} симв.)`;
}

function shortError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}
