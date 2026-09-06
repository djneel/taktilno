/**
 * ============================================================
 *  ПЛАТЕЖИ — точка подключения платёжного провайдера
 * ============================================================
 *
 * Поддерживается ЮKassa (https://yookassa.ru/developers/api).
 * Для включения задайте переменные окружения:
 *
 *   YOOKASSA_SHOP_ID=123456
 *   YOOKASSA_SECRET_KEY=live_XXXXXXXX
 *   NEXT_PUBLIC_SITE_URL=https://taktilno.ru   (для return_url)
 *
 * В личном кабинете ЮKassa укажите URL уведомлений (webhook):
 *   https://<домен>/api/payments/yookassa/webhook
 *   события: payment.succeeded, payment.canceled
 *
 * Пока ключи не заданы, используется провайдер "manual": заказ создаётся
 * со статусом «Ожидает оплаты», покупатель видит честное сообщение, что
 * онлайн-оплата пока не подключена и с ним свяжутся для оплаты.
 *
 * Чтобы добавить CloudPayments / Robokassa и т.д. — реализуйте интерфейс
 * PaymentProvider и верните его из getPaymentProvider().
 */

import { randomUUID } from "crypto";
import { SITE_URL } from "@/lib/utils";

export type CreatePaymentInput = {
  orderId: number;
  orderNumber: string;
  amount: number; // рубли
  description: string;
  customerEmail: string;
  customerPhone: string;
};

export type CreatePaymentResult =
  | { kind: "redirect"; provider: string; paymentId: string; url: string }
  | { kind: "manual"; provider: "manual" };

export interface PaymentProvider {
  readonly id: string;
  readonly isConfigured: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}

/* ---------- Заглушка: провайдер не настроен ---------- */
const manualProvider: PaymentProvider = {
  id: "manual",
  isConfigured: false,
  async createPayment() {
    return { kind: "manual", provider: "manual" };
  },
};

/* ---------- ЮKassa ---------- */
const yookassaProvider: PaymentProvider = {
  id: "yookassa",
  isConfigured: Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY),
  async createPayment(input) {
    const shopId = process.env.YOOKASSA_SHOP_ID!;
    const secretKey = process.env.YOOKASSA_SECRET_KEY!;
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const body = {
      amount: { value: input.amount.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: `${SITE_URL}/order/${encodeURIComponent(input.orderNumber)}`,
      },
      description: input.description,
      metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
      receipt: {
        customer: { email: input.customerEmail, phone: input.customerPhone },
        items: [
          {
            description: input.description.slice(0, 128),
            quantity: "1.00",
            amount: { value: input.amount.toFixed(2), currency: "RUB" },
            vat_code: 1,
            payment_mode: "full_payment",
            payment_subject: "commodity",
          },
        ],
      },
    };

    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
        "Idempotence-Key": randomUUID(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ЮKassa error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as {
      id: string;
      confirmation?: { confirmation_url?: string };
    };
    if (!data.confirmation?.confirmation_url) {
      throw new Error("ЮKassa не вернула confirmation_url");
    }
    return {
      kind: "redirect",
      provider: "yookassa",
      paymentId: data.id,
      url: data.confirmation.confirmation_url,
    };
  },
};

export function getPaymentProvider(): PaymentProvider {
  if (yookassaProvider.isConfigured) return yookassaProvider;
  return manualProvider;
}

export function isOnlinePaymentEnabled() {
  return getPaymentProvider().isConfigured;
}
