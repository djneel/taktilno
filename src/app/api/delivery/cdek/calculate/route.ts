import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/constants";
import { clientIp, isRateLimited } from "@/lib/delivery/rate-limit";
import { getCdekQuote, isCdekConfigured } from "@/lib/delivery/cdek";
import { estimateParcelWeightGrams } from "@/lib/delivery/weight";

export const dynamic = "force-dynamic";

/**
 * POST /api/delivery/cdek/calculate
 *
 * Тело — один из вариантов:
 *   { city, items: [{ productId, quantity }] } — чекаут (вес и сумма из БД)
 *   { city, weightGrams, subtotal? }           — виджет на странице доставки
 *
 * Опционально (после выбора ПВЗ на карте): cityCode и postcode из виджета —
 * тариф считается точнее, чем по одному названию города.
 *
 * Ответ: { ok: true, city, cityCode?, cost, carrierCost, free, minDays?,
 *          maxDays?, source, fallback, reason?, weightGrams, configured }
 * cost — итог с учётом бесплатного порога, carrierCost — сырой тариф СДЭК.
 *
 * Если договор с СДЭК не настроен или API недоступен, ответ всё равно ok:
 * тариф заменяется стандартным (300 ₽), оформление заказа не блокируется.
 */

const RATE_LIMIT = 60;

export async function POST(req: Request) {
  try {
    if (isRateLimited("cdek", clientIp(req), RATE_LIMIT)) {
      return NextResponse.json({ ok: false, error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      city?: unknown;
      items?: unknown;
      weightGrams?: unknown;
      subtotal?: unknown;
      cityCode?: unknown;
      postcode?: unknown;
    };

    const city = String(body.city ?? "").trim().slice(0, 120);
    if (city.length < 2) {
      return NextResponse.json({ ok: false, error: "Укажите город получателя" }, { status: 400 });
    }

    let weightGrams: number;
    let subtotal = 0;

    if (Array.isArray(body.items) && body.items.length > 0) {
      const cleaned = body.items
        .map((item) => ({
          productId: Number((item as { productId?: unknown })?.productId),
          quantity: Math.max(1, Math.min(99, Math.floor(Number((item as { quantity?: unknown })?.quantity) || 1))),
        }))
        .filter((item) => Number.isFinite(item.productId) && item.productId > 0)
        .slice(0, 50);
      if (cleaned.length === 0) {
        return NextResponse.json({ ok: false, error: "Корзина пуста" }, { status: 400 });
      }
      const ids = [...new Set(cleaned.map((item) => item.productId))];
      const dbProducts = await db.query.products.findMany({ where: inArray(products.id, ids) });
      const lines = cleaned
        .map((item) => {
          const product = dbProducts.find((candidate) => candidate.id === item.productId);
          if (!product) return null;
          subtotal += product.price * item.quantity;
          return { weightGrams: product.weightGrams ?? null, quantity: item.quantity };
        })
        .filter((line): line is NonNullable<typeof line> => line !== null);
      if (lines.length === 0) {
        return NextResponse.json({ ok: false, error: "Товары больше не доступны" }, { status: 400 });
      }
      weightGrams = estimateParcelWeightGrams(lines, { defaultItemWeightG: 150, packagingWeightG: 150, minWeightGrams: 100 });
    } else {
      weightGrams = Math.round(Number(body.weightGrams));
      if (!Number.isFinite(weightGrams) || weightGrams < 100 || weightGrams > 31_500) {
        return NextResponse.json(
          { ok: false, error: "Укажите вес посылки от 100 до 31500 г" },
          { status: 400 }
        );
      }
      const rawSubtotal = Math.round(Number(body.subtotal));
      subtotal = Number.isFinite(rawSubtotal) && rawSubtotal > 0 ? rawSubtotal : 0;
    }

    const cityCode = Math.round(Number(body.cityCode));
    const postcode = String(body.postcode ?? "").replace(/\D/g, "").slice(0, 6);
    const quote = await getCdekQuote({
      city,
      ...(Number.isFinite(cityCode) && cityCode > 0 ? { cityCode } : {}),
      ...(postcode.length === 6 ? { postcode } : {}),
      weightGrams,
      declaredValueRub: subtotal,
    });
    const free = subtotal >= FREE_DELIVERY_THRESHOLD;

    return NextResponse.json({
      ok: true,
      city,
      cost: free ? 0 : quote.cost,
      carrierCost: quote.cost,
      free,
      ...(quote.cityCode !== undefined ? { cityCode: quote.cityCode } : {}),
      ...(quote.tariffCode !== undefined ? { tariffCode: quote.tariffCode } : {}),
      ...(quote.minDays !== undefined ? { minDays: quote.minDays } : {}),
      ...(quote.maxDays !== undefined ? { maxDays: quote.maxDays } : {}),
      ...(quote.reason !== undefined ? { reason: quote.reason } : {}),
      source: quote.source,
      fallback: quote.fallback,
      weightGrams: quote.weightGrams,
      configured: isCdekConfigured(),
    });
  } catch (e) {
    console.error("[cdek] calculate failed", e);
    const message = e instanceof Error ? e.message : "Не удалось рассчитать тариф СДЭК";
    const status = message.includes("город") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
