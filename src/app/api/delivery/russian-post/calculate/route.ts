import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/constants";
import {
  estimateParcelWeightGrams,
  getRussianPostQuote,
  isValidPostcode,
  normalizePostcode,
} from "@/lib/delivery/russian-post";

export const dynamic = "force-dynamic";

/**
 * POST /api/delivery/russian-post/calculate
 *
 * Тело — один из вариантов:
 *   { postcode, items: [{ productId, quantity }] } — чекаут (вес и сумма из БД)
 *   { postcode, weightGrams, subtotal? }            — виджет на странице доставки
 *
 * Ответ: { ok: true, postcode, cost, mailCost, free, minDays?, maxDays?,
 *          source, fallback, weightGrams }
 * cost — итог с учётом бесплатного порога, mailCost — сырой тариф Почты.
 */

// Простой per-instance лимитер, чтобы через нас не долбили API Почты.
const hits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (hits.size > 1000) hits.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      postcode?: unknown;
      items?: unknown;
      weightGrams?: unknown;
      subtotal?: unknown;
    };

    const postcode = normalizePostcode(String(body.postcode ?? ""));
    if (!isValidPostcode(postcode)) {
      return NextResponse.json({ ok: false, error: "Укажите корректный индекс (6 цифр)" }, { status: 400 });
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
      weightGrams = estimateParcelWeightGrams(lines);
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

    const quote = await getRussianPostQuote({ postcode, weightGrams, declaredValueRub: subtotal });
    const free = subtotal >= FREE_DELIVERY_THRESHOLD;

    return NextResponse.json({
      ok: true,
      postcode,
      cost: free ? 0 : quote.cost,
      mailCost: quote.cost,
      free,
      ...(quote.minDays !== undefined ? { minDays: quote.minDays } : {}),
      ...(quote.maxDays !== undefined ? { maxDays: quote.maxDays } : {}),
      source: quote.source,
      fallback: quote.fallback,
      weightGrams: quote.weightGrams,
    });
  } catch (e) {
    console.error("[pochta] calculate failed", e);
    const message = e instanceof Error ? e.message : "Не удалось рассчитать тариф";
    const status = message.includes("индекс") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
