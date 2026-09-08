/**
 * ============================================================
 *  УВЕДОМЛЕНИЯ О НОВЫХ ЗАКАЗАХ
 * ============================================================
 *
 * Telegram: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID —
 * и уведомления начнут приходить автоматически.
 *
 * E-mail / SMS: добавьте реализацию NotificationChannel ниже
 * (например, через Resend / SMTP / SMS.ru) и зарегистрируйте её в channels[].
 */

import type { Order, OrderItem } from "@/db/schema";
import { getDeliveryMethodName, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

export interface NotificationChannel {
  id: string;
  isConfigured: boolean;
  send(message: string, order: Order & { items: OrderItem[] }): Promise<void>;
}

const telegramChannel: NotificationChannel = {
  id: "telegram",
  isConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  async send(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const chatId = process.env.TELEGRAM_CHAT_ID!;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[telegram] Ошибка отправки:", res.status, data);
      throw new Error(`Telegram API ${res.status}: ${JSON.stringify(data)}`);
    }
  },
};

// Место для e-mail и SMS каналов:
// const emailChannel: NotificationChannel = { id: "email", isConfigured: false, async send() {} };
// const smsChannel: NotificationChannel = { id: "sms", isConfigured: false, async send() {} };

const channels: NotificationChannel[] = [telegramChannel];

export function formatOrderMessage(order: Order & { items: OrderItem[] }) {
  const delivery = getDeliveryMethodName(order.deliveryMethod);
  const lines = [
    `<b>Новый заказ ${order.number}</b>`,
    ``,
    ...order.items.map((i) => `• ${i.name} × ${i.quantity} — ${formatPrice(i.price * i.quantity)}`),
    ``,
    `Итого: <b>${formatPrice(order.total)}</b>`,
    `Оплата: ${PAYMENT_STATUS_LABELS[order.paymentStatus]}`,
    ``,
    `${order.customerName}`,
    `${order.phone}`,
    `${order.email}`,
    `${order.city} — ${delivery}`,
    order.address ? order.address : "",
    order.comment ? `Комментарий: ${order.comment}` : "",
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

export async function notifyNewOrder(order: Order & { items: OrderItem[] }) {
  const message = formatOrderMessage(order);
  const active = channels.filter((c) => c.isConfigured);
  if (active.length === 0) {
    console.info("[notifications] Каналы не настроены. Заказ:", order.number);
    return;
  }
  await Promise.allSettled(
    active.map((c) =>
      c.send(message, order).catch((e) => console.error(`[notifications:${c.id}]`, e))
    )
  );
}
