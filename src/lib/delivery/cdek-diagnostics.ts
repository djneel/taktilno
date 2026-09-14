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
 *   2. network  — сеть до хоста API: DNS → TCP → TLS-рукопожатие (с таймингами);
 *   3. auth     — получение OAuth-токена (всегда начисто, кэш сбрасывается);
 *   4. location — поиск города получателя в реестре СДЭК (/location/cities);
 *   5. tariff   — расчёт тарифа калькулятором (/calculator/tariff), 500 г.
 *
 * Каждый шаг возвращает статус ok/warn/error/skipped, длительность и
 * подсказку, что чинить. Диагностика ничего не меняет в работе магазина:
 * заказы в любом случае оформляются по стандартному тарифу (см. cdek.ts).
 *
 * Используется серверным экшеном runCdekDiagnosticsAction (admin-actions.ts).
 * Модуль серверный (использует node:dns/net/tls) — на клиенте только типы.
 */

import { lookup } from "node:dns/promises";
import { connect as tcpConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";

import {
  CdekNetworkError,
  cdekContourLabel,
  clearCdekCaches,
  formatCdekError,
  getCdekConfig,
  getCdekQuote,
  getAccessToken,
  isCdekConfigured,
  parseCdekBaseUrl,
  resolveCityCode,
  type CdekConfig,
} from "./cdek";

export type CdekDiagnosticStatus = "ok" | "warn" | "error" | "skipped";

export type CdekDiagnosticStepId = "config" | "network" | "auth" | "location" | "tariff";

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
  const baseUrl = parseCdekBaseUrl(config.baseUrl);

  let authStep: CdekDiagnosticStep | null = null;
  let locationStep: CdekDiagnosticStep | null = null;
  let tariffStep: CdekDiagnosticStep | null = null;

  if (!baseUrl.ok) {
    // Непонятно, куда стучаться, — проверяем только конфиг.
    const reason = "Пропущено: адрес API некорректен (см. шаг «Конфигурация»).";
    steps.push(skipStep("network", "Сеть (DNS → TCP → TLS)", reason));
    steps.push(skipStep("auth", "Авторизация (OAuth)", reason));
    steps.push(skipStep("location", "Справочник городов", reason));
    steps.push(skipStep("tariff", "Расчёт тарифа", reason));
  } else if (!isCdekConfigured()) {
    // Штатный режим без договора: магазин работает на стандартном тарифе.
    steps.push(skipStep("network", "Сеть (DNS → TCP → TLS)", "Пропущено: креды СДЭК не заданы."));
    steps.push(skipStep("auth", "Авторизация (OAuth)", "Пропущено: креды СДЭК не заданы."));
    steps.push(skipStep("location", "Справочник городов", "Пропущено: нет авторизации."));
    steps.push(skipStep("tariff", "Расчёт тарифа", "Пропущено: нет авторизации."));
  } else {
    // Чистая проверка: сбрасываем кэши, чтобы запросы точно ушли в живое API.
    clearCdekCaches();

    steps.push(await checkNetwork(baseUrl));

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
  const base = parseCdekBaseUrl(config.baseUrl);
  const details: [string, string][] = [
    ["CDEK_ACCOUNT", maskSecret(config.account)],
    ["CDEK_SECRET", config.secret ? `задан (${config.secret.length} симв.)` : "не задан"],
    ["CDEK_API_URL", config.baseUrl || "не задан"],
    ["Контур", base.ok ? cdekContourLabel(config) : "адрес некорректен"],
    ["Хост API", base.ok ? `${base.host}:${base.port}` : "—"],
    ["Город отправления", config.fromCityCode ? `${config.fromCity} (код ${config.fromCityCode})` : config.fromCity],
    ["Код тарифа", `${config.tariffCode} (запасные: 136, 234, 368)`],
    ["Вес изделия / упаковки", `${config.defaultItemWeightG} г / ${config.packagingWeightG} г`],
    [
      "Габариты посылки",
      `${config.packageSize.length}×${config.packageSize.width}×${config.packageSize.height} см`,
    ],
    ["Предел веса онлайн-расчёта", `${config.maxWeightG} г`],
  ];

  if (!base.ok) {
    return {
      id: "config",
      title: "Конфигурация",
      status: "error",
      message: `Адрес API некорректен: ${base.problem}`,
      hint: "Исправьте CDEK_API_URL в переменных окружения хостинга и сделайте редеплой. Боевой контур: https://api.cdek.ru/v2, тестовый: https://api.edu.cdek.ru/v2.",
      durationMs: 0,
      details,
    };
  }
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
    message: `Креды заданы, контур: ${cdekContourLabel(config)}.`,
    durationMs: 0,
    details,
  };
}

/**
 * Шаг «Сеть»: проверяет путь до хоста API по этапам — DNS, TCP, TLS.
 * Отвечает на вопрос «где именно рвётся», который fetch прячет за «fetch failed».
 */
async function checkNetwork(target: { host: string; port: number }): Promise<CdekDiagnosticStep> {
  const t0 = Date.now();
  const { host, port } = target;
  const details: [string, string][] = [];
  const elapsed = () => Date.now() - t0;

  // 1. DNS — резолвим хост в IP.
  let ip: string;
  try {
    const t = Date.now();
    ip = (await lookup(host)).address;
    details.push(["DNS", `${host} → ${ip} · ${Date.now() - t} мс`]);
  } catch (error) {
    return {
      id: "network",
      title: "Сеть (DNS → TCP → TLS)",
      status: "error",
      message: `DNS не резолвит ${host}: ${formatCdekError(error)}.`,
      hint: "Проверьте CDEK_API_URL на опечатки и DNS на сервере хостинга.",
      durationMs: elapsed(),
      details,
    };
  }

  // 2. TCP — открывается ли порт.
  try {
    const t = Date.now();
    await tcpProbe(ip, port, 5_000);
    details.push(["TCP", `${ip}:${port} · соединение OK · ${Date.now() - t} мс`]);
  } catch (error) {
    return {
      id: "network",
      title: "Сеть (DNS → TCP → TLS)",
      status: "error",
      message: `TCP-подключение к ${ip}:${port} не удалось: ${formatCdekError(error)}.`,
      hint: `Хостинг режет исходящие соединения либо неверны адрес/порт. Проверьте с сервера: curl -v https://${host}/v2/oauth/token`,
      durationMs: elapsed(),
      details,
    };
  }

  // 3. TLS — проходит ли рукопожатие и валиден ли сертификат.
  try {
    const t = Date.now();
    const tls = await tlsProbe(host, ip, port, 7_000);
    details.push([
      "TLS",
      `${ip}:${port} · ${tls.protocol}, ${tls.cipher} · ${Date.now() - t} мс · сертификат ${tls.authorized ? "OK" : "НЕ ПРОШЁЛ ПРОВЕРКУ"}`,
    ]);
    if (!tls.authorized) {
      return {
        id: "network",
        title: "Сеть (DNS → TCP → TLS)",
        status: "error",
        message: `TLS до ${host} установился, но сертификат не прошёл проверку: ${tls.authError ?? "неизвестная причина"}.`,
        hint: "Между сервером и СДЭК, похоже, MITM-прокси, либо сбиты дата/время на сервере. Проверьте curl -v и часы сервера.",
        durationMs: elapsed(),
        details,
      };
    }
    return {
      id: "network",
      title: "Сеть (DNS → TCP → TLS)",
      status: "ok",
      message: `DNS, TCP и TLS до ${host} в порядке (${tls.protocol}, ${tls.cipher}).`,
      durationMs: elapsed(),
      details,
    };
  } catch (error) {
    return {
      id: "network",
      title: "Сеть (DNS → TCP → TLS)",
      status: "error",
      message: `TLS-рукопожатие с ${host} не удалось: ${formatCdekError(error)}.`,
      hint: "Сервер СДЭК (или фильтр на пути) рвёт соединение до ответа — anti-DDoS-защита часто режет IP хостингов. Проверьте с сервера curl -v, узнайте исходящий IP (curl ifconfig.me) и напишите в поддержку СДЭК (интеграция API) и хостеру. Магазин при этом работает на стандартном тарифе 300 ₽.",
      durationMs: elapsed(),
      details,
    };
  }
}

/** TCP-подключение с таймаутом. */
function tcpProbe(ip: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = tcpConnect({ host: ip, port, timeout: timeoutMs });
    const done = (fn: () => void) => {
      socket.removeAllListeners();
      socket.destroy();
      fn();
    };
    socket.once("connect", () => done(resolve));
    socket.once("timeout", () => done(() => reject(new Error("таймаут TCP-подключения"))));
    socket.once("error", (err) => done(() => reject(err)));
  });
}

/**
 * TLS-рукопожатие с хостом (SNI — имя хоста, коннект — к резолвнутому IP).
 * Сертификат не отбраковываем сразу, а возвращаем verdict — чтобы различить
 * «рукопожатие рвут» и «рукопожатие прошло, но сертификат чужой».
 */
function tlsProbe(
  host: string,
  ip: string,
  port: number,
  timeoutMs: number
): Promise<{ protocol: string; cipher: string; authorized: boolean; authError: string | null }> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({
      host: ip,
      servername: host,
      port,
      timeout: timeoutMs,
      rejectUnauthorized: false,
    });
    const fail = (err: Error) => {
      socket.removeAllListeners();
      socket.destroy();
      reject(err);
    };
    socket.once("secureConnect", () => {
      const result = {
        protocol: socket.getProtocol() ?? "?",
        cipher: socket.getCipher()?.name ?? "?",
        authorized: socket.authorized,
        authError: socket.authorizationError ? String(socket.authorizationError) : null,
      };
      socket.removeAllListeners();
      socket.end();
      resolve(result);
    });
    socket.once("timeout", () => fail(new Error("таймаут TLS-рукопожатия")));
    socket.once("error", fail);
  });
}

async function checkAuth(config: CdekConfig): Promise<CdekDiagnosticStep> {
  const t0 = Date.now();
  const tokenUrl = `${config.baseUrl}/oauth/token`;
  try {
    // force=true — всегда новый токен, чтобы проверить актуальность кредов,
    // а не остаток жизни закэшированного.
    const token = await getAccessToken(config, true);
    return {
      id: "auth",
      title: "Авторизация (OAuth)",
      status: "ok",
      message: `Токен получен (${Date.now() - t0} мс), живёт ~1 час.`,
      durationMs: Date.now() - t0,
      details: [
        ["Токен", maskSecret(token)],
        ["Точка авторизации", tokenUrl],
      ],
    };
  } catch (error) {
    const message = formatCdekError(error);
    const details: [string, string][] = [["Точка авторизации", tokenUrl]];
    if (error instanceof CdekNetworkError && error.code) {
      details.push(["Сетевой код", error.code]);
    }
    const credentialsProblem = /401|403|access_token|client/i.test(message);
    const notFound = /HTTP 404/.test(message);
    const hint = credentialsProblem
      ? "Проверьте CDEK_ACCOUNT (это client_id) и CDEK_SECRET (secure password) в ЛК СДЭК → Настройки → API. Помните: ключи боевого и тестового контуров разные — боевые не работают на api.edu.cdek.ru и наоборот."
      : notFound
        ? "Хост отвечает, но путь не найден — CDEK_API_URL должен заканчиваться на /v2: боевой https://api.cdek.ru/v2, тестовый https://api.edu.cdek.ru/v2."
        : networkHint(error);
    return {
      id: "auth",
      title: "Авторизация (OAuth)",
      status: "error",
      message: `СДЭК не выдал токен: ${message}`,
      hint,
      durationMs: Date.now() - t0,
      details,
    };
  }
}

/** Подсказка для сетевой ошибки авторизации — по этапу, где рвётся соединение. */
function networkHint(error: unknown): string {
  const intro = "Подробности — в шаге «Сеть» выше. ";
  const stage = error instanceof CdekNetworkError ? error.stage : null;
  switch (stage) {
    case "dns":
      return `${intro}DNS не находит хост API — проверьте CDEK_API_URL на опечатки.`;
    case "tcp":
      return `${intro}Порт API закрыт или исходящие соединения режет хостинг — проверьте curl -v с сервера.`;
    case "tls":
      return `${intro}Соединение рвётся на TLS — защита СДЭК или провайдер режет IP сервера. Проверьте curl -v с сервера, узнайте исходящий IP (curl ifconfig.me) и напишите в поддержку СДЭК (интеграция API) и хостеру.`;
    case "timeout":
      return `${intro}API не отвечает вовремя — повторите позже; если повторится, проверьте исходящие соединения сервера.`;
    case "config":
      return "Исправьте CDEK_API_URL: нужен полный https-адрес (боевой https://api.cdek.ru/v2, тестовый https://api.edu.cdek.ru/v2).";
    default:
      return `${intro}Похоже, API СДЭК недоступен с сервера хостинга (сеть/файрвол). Повторите позже или проверьте исходящий доступ.`;
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
      message: `Поиск города не удался: ${formatCdekError(error)}`,
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
      ? `, срок ${quote.minDays ?? "?"}–${quote.maxDays ?? "?"} раб. дн`
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
