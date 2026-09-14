import { NextResponse } from "next/server";
import { getCdekConfig, isCdekConfigured } from "@/lib/delivery/cdek";

export const dynamic = "force-dynamic";

/**
 * GET /api/delivery/cdek/widget-config
 *
 * Публичная конфигурация для виджета ПВЗ СДЭК на клиенте: откуда везём,
 * какие тарифы показывать, габариты посылки. Секретов нет — ключ Яндекс.Карт
 * клиент берёт из NEXT_PUBLIC_YANDEX_MAPS_API_KEY сам.
 *
 * Ответ: { ok, enabled, configured, yandexKeyConfigured, servicePath, from,
 *          tariffs, package }. enabled=false — виджет не показываем, чекаут
 * работает по ручному вводу города и адреса (как раньше).
 */
export async function GET() {
  const config = getCdekConfig();
  const configured = isCdekConfigured();
  const yandexKeyConfigured = Boolean(process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim());

  // Та же цепочка, что считает сервер (см. tariffChain в cdek.ts): сначала
  // настроенный тариф, затем запасные «до ПВЗ».
  const officeTariffs = [config.tariffCode, 136, 234, 368].filter(
    (code, index, all) => Number.isFinite(code) && all.indexOf(code) === index
  );

  return NextResponse.json({
    ok: true,
    enabled: configured && yandexKeyConfigured,
    configured,
    yandexKeyConfigured,
    servicePath: "/api/delivery/cdek/widget-service",
    // Полная форма объекта from (с null) — как в примере из wiki виджета:
    // частичный объект может не пройти yup-валидацию конструктора.
    from: {
      country_code: "RU",
      city: config.fromCity,
      postal_code: config.fromPostalCode.length === 6 ? config.fromPostalCode : null,
      code: config.fromCityCode ?? null,
      address: null,
    },
    tariffs: { office: officeTariffs, door: [], pickup: [368] },
    package: {
      length: config.packageSize.length,
      width: config.packageSize.width,
      height: config.packageSize.height,
    },
  });
}
