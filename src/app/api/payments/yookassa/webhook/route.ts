import { NextResponse } from "next/server";
import { markOrderPaid, markOrderPaymentFailed } from "@/lib/orders";

/**
 * Webhook ЮKassa. URL для личного кабинета: https://<домен>/api/payments/yookassa/webhook
 * События: payment.succeeded, payment.canceled.
 * Для надёжности статус платежа перепроверяется запросом к API ЮKassa.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    return NextResponse.json({ error: "ЮKassa не настроена" }, { status: 503 });
  }

  let body: { event?: string; object?: { id?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const paymentId = body.object?.id;
  if (!paymentId) return NextResponse.json({ ok: true });

  // Проверяем статус у ЮKassa, чтобы не доверять телу запроса вслепую
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return NextResponse.json({ error: "verify failed" }, { status: 502 });
  const payment = (await res.json()) as { status: string };

  if (payment.status === "succeeded") {
    await markOrderPaid({ paymentId });
  } else if (payment.status === "canceled") {
    await markOrderPaymentFailed(paymentId);
  }
  return NextResponse.json({ ok: true });
}
