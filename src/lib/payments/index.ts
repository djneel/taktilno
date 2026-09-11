/**
 * Онлайн-оплата через ЮKassa (https://yookassa.ru/developers/api).
 *
 * Обязательные переменные окружения:
 *   YOOKASSA_SHOP_ID=123456
 *   YOOKASSA_SECRET_KEY=live_XXXXXXXX
 *   NEXT_PUBLIC_SITE_URL=https://taktilno.ru
 *
 * Webhook в личном кабинете ЮKassa:
 *   https://<домен>/api/payments/yookassa/webhook
 * События: payment.succeeded, payment.canceled.
 */

import { randomUUID } from "crypto";
import { SITE_URL } from "@/lib/utils";
import { ONLINE_PAYMENT_METHOD } from "@/lib/constants";

const CURRENCY = "RUB" as const;
const MAX_RECEIPT_ITEMS = 80;

export type PaymentProduct = {
  name: string;
  quantity: number;
  price: number; // цена одной единицы в рублях
};

export type PaymentDelivery = {
  name: string;
  price: number; // стоимость доставки в рублях
};

export type CreatePaymentInput = {
  orderId: number;
  orderNumber: string;
  amount: number; // итоговая сумма в рублях
  description: string;
  customerEmail: string;
  customerPhone: string;
  items: readonly PaymentProduct[];
  delivery: PaymentDelivery;
};

export type CreatePaymentResult = {
  kind: "redirect";
  provider: typeof ONLINE_PAYMENT_METHOD;
  paymentId: string;
  url: string;
};

export type YooKassaReceiptItem = {
  description: string;
  quantity: string;
  amount: { value: string; currency: typeof CURRENCY };
  vat_code: 1;
  payment_mode: "full_payment";
  payment_subject: "commodity" | "service";
};

export interface PaymentProvider {
  readonly id: typeof ONLINE_PAYMENT_METHOD;
  readonly isConfigured: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function cleanDescription(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;
  return Array.from(normalized).slice(0, 128).join("");
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Некорректное значение ${field} для чека ЮKassa`);
  }
}

/**
 * Формирует фискальные позиции: каждая товарная строка отдельно, доставка —
 * отдельной услугой. Бесплатная доставка не попадает в чек, потому что
 * ЮKassa принимает только позиции с положительной суммой.
 */
export function buildYooKassaReceiptItems(input: Pick<CreatePaymentInput, "amount" | "items" | "delivery">) {
  if (!input.items.length) throw new Error("В чеке ЮKassa нет товаров");

  const receiptItems: YooKassaReceiptItem[] = input.items.map((item) => {
    assertPositiveInteger(item.quantity, "количества товара");
    assertPositiveInteger(item.price, "цены товара");

    return {
      description: cleanDescription(item.name, "Товар"),
      quantity: item.quantity.toFixed(2),
      amount: { value: formatMoney(item.price), currency: CURRENCY },
      vat_code: 1,
      payment_mode: "full_payment",
      payment_subject: "commodity",
    };
  });

  if (!Number.isSafeInteger(input.delivery.price) || input.delivery.price < 0) {
    throw new Error("Некорректная стоимость доставки для чека ЮKassa");
  }

  if (input.delivery.price > 0) {
    receiptItems.push({
      description: cleanDescription(`Доставка — ${input.delivery.name}`, "Доставка"),
      quantity: "1.00",
      amount: { value: formatMoney(input.delivery.price), currency: CURRENCY },
      vat_code: 1,
      payment_mode: "full_payment",
      payment_subject: "service",
    });
  }

  if (receiptItems.length > MAX_RECEIPT_ITEMS) {
    throw new Error(`В чеке ЮKassa может быть не более ${MAX_RECEIPT_ITEMS} позиций`);
  }

  const receiptTotal =
    input.items.reduce((sum, item) => sum + item.price * item.quantity, 0) + input.delivery.price;
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || receiptTotal !== input.amount) {
    throw new Error("Сумма позиций чека ЮKassa не совпадает с суммой платежа");
  }

  return receiptItems;
}

function normalizeReceiptPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null;
}

const yookassaProvider: PaymentProvider = {
  id: ONLINE_PAYMENT_METHOD,
  get isConfigured() {
    return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
  },
  async createPayment(input) {
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) {
      throw new Error("ЮKassa не настроена");
    }

    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
    const phone = normalizeReceiptPhone(input.customerPhone);
    const customer: { email: string; phone?: string } = { email: input.customerEmail };
    if (phone) customer.phone = phone;

    const body = {
      amount: { value: formatMoney(input.amount), currency: CURRENCY },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: `${SITE_URL.replace(/\/$/, "")}/order/${encodeURIComponent(input.orderNumber)}`,
      },
      description: cleanDescription(input.description, `Заказ ${input.orderNumber}`),
      metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
      receipt: {
        customer,
        items: buildYooKassaReceiptItems(input),
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
      provider: ONLINE_PAYMENT_METHOD,
      paymentId: data.id,
      url: data.confirmation.confirmation_url,
    };
  },
};

/** Офлайн-оплаты и ручного fallback нет: магазин принимает оплату только через ЮKassa. */
export function getPaymentProvider(): PaymentProvider {
  return yookassaProvider;
}

export function isOnlinePaymentEnabled() {
  return yookassaProvider.isConfigured;
}
