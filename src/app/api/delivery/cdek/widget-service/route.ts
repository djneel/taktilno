import { NextResponse } from "next/server";
import { clientIp, isRateLimited } from "@/lib/delivery/rate-limit";
import { getAccessToken, getCdekConfig, isCdekConfigured, type CdekConfig } from "@/lib/delivery/cdek";

export const dynamic = "force-dynamic";

/**
 * /api/delivery/cdek/widget-service — аналог service.php из официального
 * виджета ПВЗ СДЭК (cdek-it/widget), переписанный под Next.js (PHP на
 * хостинге нет). Виджет ходит сюда за списком ПВЗ и расчётом тарифов:
 *
 *   GET  ?action=offices&...   → GET {CDEK}/deliverypoints?... (сырой ответ)
 *   POST {action:"calculate", ...} → POST {CDEK}/calculator/tarifflist (сырой ответ)
 *
 * Как и service.php, проксируем запросы в API СДЭК с нашими кредами
 * (токен кэшируется в cdek.ts) и отдаём ответ СДЭК как есть, с его же
 * HTTP-статусом. Формат ошибок валидации — тоже как у service.php:
 * { message }.
 *
 * Совместимо с виджетом @cdek-it/widget@3 (WIDGET_VERSION ниже).
 */

const WIDGET_VERSION = "3.13.1";
// Виджет дёргает offices при каждом движении карты — лимит щедрый.
const RATE_LIMIT = 120;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 64 * 1024;

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (isRateLimited("cdek-widget", clientIp(req), RATE_LIMIT)) {
    return serviceError("Слишком много запросов. Подождите минуту.", 429);
  }
  if (!isCdekConfigured()) {
    return serviceError("Интеграция СДЭК не настроена", 503);
  }
  const config = getCdekConfig();

  // service.php мержит $_GET и JSON-body — повторяем, чтобы принять запрос
  // виджета в любом виде.
  const query: Record<string, string> = {};
  new URL(req.url).searchParams.forEach((value, key) => {
    query[key] = value;
  });
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    const text = await req.text().catch(() => "");
    if (text.length > MAX_BODY_BYTES) {
      return serviceError("Слишком большой запрос", 413);
    }
    if (text.trim()) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return serviceError("Некорректный JSON", 400);
        }
        body = parsed as Record<string, unknown>;
      } catch {
        return serviceError("Некорректный JSON", 400);
      }
    }
  }
  const action = String(body.action ?? query.action ?? "").trim();

  try {
    if (action === "offices") {
      const merged: Record<string, string> = { ...query };
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) merged[key] = String(value);
      }
      delete merged.action;
      return await proxy(config, "deliverypoints", { query: merged });
    }
    if (action === "calculate") {
      if (req.method !== "POST") return serviceError("Метод calculate требует POST", 405);
      const { action: _omit, ...payload } = { ...query, ...body };
      void _omit;
      return await proxy(config, "calculator/tarifflist", { json: payload });
    }
    return serviceError("Unknown action", 400);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[cdek] widget-service timeout");
      return serviceError("API СДЭК не отвечает (таймаут)", 504);
    }
    console.error("[cdek] widget-service failed:", error instanceof Error ? error.message : error);
    return serviceError("API СДЭК недоступно", 502);
  }
}

/**
 * Проксирует запрос в API СДЭК и возвращает сырой ответ с его статусом
 * (как service.php с августа 2026: статус апстрима пробрасывается наружу,
 * виджет сам решает, что показать). При 401 один раз обновляем токен.
 */
async function proxy(
  config: CdekConfig,
  path: string,
  init: { query: Record<string, string> } | { json: Record<string, unknown> }
): Promise<Response> {
  const attempt = async (forceToken: boolean) => {
    const token = await getAccessToken(config, forceToken);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      let target = `${config.baseUrl}/${path}`;
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-App-Name": "widget_pvz",
        "X-App-Version": WIDGET_VERSION,
        "User-Agent": `widget/${WIDGET_VERSION}`,
      };
      let request: RequestInit;
      if ("json" in init) {
        request = {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(init.json),
          signal: controller.signal,
          cache: "no-store",
        };
      } else {
        const qs = new URLSearchParams(init.query).toString();
        if (qs) target += `?${qs}`;
        request = { method: "GET", headers, signal: controller.signal, cache: "no-store" };
      }
      const res = await fetch(target, request);
      return { status: res.status, text: await res.text() };
    } finally {
      clearTimeout(timer);
    }
  };

  let result = await attempt(false);
  if (result.status === 401) result = await attempt(true);
  return new Response(result.status === 204 ? null : result.text || "{}", {
    status: result.status,
    headers: {
      "Content-Type": "application/json",
      "X-Service-Version": WIDGET_VERSION,
      "Cache-Control": "no-store",
    },
  });
}

function serviceError(message: string, status: number) {
  return NextResponse.json(
    { message },
    { status, headers: { "X-Service-Version": WIDGET_VERSION } }
  );
}
