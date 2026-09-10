import { db } from "@/db";
import { orders, orderItems, products, type OrderStatus, type PaymentStatus } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { getMainImage } from "./images";
import { getDeliveryMethod, isFreeDelivery } from "./constants";
import { getPaymentProvider } from "./payments";
import { notifyNewOrder } from "./notifications";
import { normalizeInn, validateInn } from "./inn";

export type CheckoutInput = {
  name: string;
  phone: string;
  email: string;
  city: string;
  deliveryMethod: string;
  address: string;
  comment?: string;
  inn?: string;
  items: { productId: number; quantity: number; variantName?: string }[];
};

export class CheckoutError extends Error {}

function makeOrderNumber(id: number) {
  return `ТАК-${String(id).padStart(4, "0")}`;
}

export async function createOrder(input: CheckoutInput) {
  const name = input.name?.trim();
  const phone = input.phone?.trim();
  const email = input.email?.trim();
  const city = input.city?.trim();
  if (!name || name.length < 2) throw new CheckoutError("Укажите имя");
  if (!phone || phone.replace(/\D/g, "").length < 10) throw new CheckoutError("Укажите корректный телефон");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError("Укажите корректный e-mail");
  if (!city) throw new CheckoutError("Укажите город");

  const inn = normalizeInn(input.inn ?? "");
  const innError = validateInn(inn);
  if (innError) throw new CheckoutError(innError);

  const delivery = getDeliveryMethod(input.deliveryMethod);
  if (!delivery) throw new CheckoutError("Выберите способ доставки");
  if (delivery.needsAddress && !input.address?.trim()) {
    throw new CheckoutError("Укажите адрес / пункт выдачи");
  }
  if (!input.items?.length) throw new CheckoutError("Корзина пуста");

  const ids = [...new Set(input.items.map((i) => Number(i.productId)).filter(Boolean))];
  const dbProducts = await db.query.products.findMany({
    where: inArray(products.id, ids),
    with: { images: true },
  });

  const lines = input.items
    .map((i) => {
      const p = dbProducts.find((d) => d.id === Number(i.productId));
      if (!p) return null;
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(i.quantity) || 1)));
      const variantName = typeof i.variantName === "string" ? i.variantName.trim() : "";
      return { product: p, quantity, variantName };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (!lines.length) throw new CheckoutError("Товары из корзины больше не доступны");

  for (const l of lines) {
    if (!l.product.isAvailable) throw new CheckoutError(`«${l.product.name}» сейчас недоступен`);
    if (l.product.stock < l.quantity) {
      throw new CheckoutError(
        l.product.stock === 0
          ? `«${l.product.name}» закончился`
          : `«${l.product.name}»: в наличии только ${l.product.stock} шт.`
      );
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const deliveryIsFree = isFreeDelivery(delivery.id, subtotal);
  // В текущей схеме delivery_cost обязателен. Для заказа ниже порога ноль —
  // служебное значение старой схемы, а не стоимость доставки: UI и оплата
  // определяют состояние «По расчёту» по активному способу и сумме товаров.
  const deliveryCost = deliveryIsFree ? 0 : delivery.cost ?? 0;
  const total = subtotal + deliveryCost;
  const hasFinalTotal = deliveryIsFree || delivery.cost !== null;

  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        number: `TMP-${Date.now()}`,
        customerName: name,
        phone,
        email,
        city,
        deliveryMethod: delivery.id,
        address: input.address?.trim() ?? "",
        comment: input.comment?.trim() ?? "",
        inn,
        subtotal,
        deliveryCost,
        total,
        status: "new",
        paymentStatus: "pending",
        // Пока стоимость доставки не рассчитана, платёж не создаём: итоговая сумма ещё неизвестна.
        paymentProvider: hasFinalTotal ? getPaymentProvider().id : "manual",
      })
      .returning();

    const number = makeOrderNumber(order.id);
    await tx.update(orders).set({ number }).where(eq(orders.id, order.id));

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.product.id,
        name: l.variantName ? `${l.product.name} — ${l.variantName}` : l.product.name,
        slug: l.product.slug,
        price: l.product.price,
        quantity: l.quantity,
        imageUrl: getMainImage(l.product)?.url ?? null,
      }))
    );

    // Списываем остатки и увеличиваем популярность
    for (const l of lines) {
      await tx
        .update(products)
        .set({
          stock: sql`GREATEST(${products.stock} - ${l.quantity}, 0)`,
          popularity: sql`${products.popularity} + ${l.quantity}`,
        })
        .where(eq(products.id, l.product.id));
    }

    return { ...order, number };
  });

  // Платёж создаём только когда известна итоговая сумма. При «По расчёту»
  // менеджер сначала подтверждает стоимость доставки покупателю.
  let paymentUrl: string | null = null;
  let paymentMode: "redirect" | "manual" = "manual";
  if (hasFinalTotal) {
    const provider = getPaymentProvider();
    try {
      const result = await provider.createPayment({
        orderId: created.id,
        orderNumber: created.number,
        amount: total,
        description: `Заказ ${created.number} — ТАКТИЛЬНО`,
        customerEmail: email,
        customerPhone: phone,
      });
      if (result.kind === "redirect") {
        paymentUrl = result.url;
        paymentMode = "redirect";
        await db
          .update(orders)
          .set({ paymentId: result.paymentId, paymentUrl: result.url, paymentProvider: result.provider })
          .where(eq(orders.id, created.id));
      }
    } catch (e) {
      console.error("[payments] Не удалось создать платёж:", e);
    }
  }

  const full = await db.query.orders.findFirst({
    where: eq(orders.id, created.id),
    with: { items: true },
  });
  if (full) {
    try {
      await notifyNewOrder(full);
    } catch (e) {
      console.error("[notifications] Ошибка отправки уведомления:", e);
    }
  }

  return { orderNumber: created.number, paymentUrl, paymentMode, total: hasFinalTotal ? total : null };
}

export async function markOrderPaid(opts: { paymentId?: string; orderNumber?: string }) {
  const where = opts.paymentId
    ? eq(orders.paymentId, opts.paymentId)
    : opts.orderNumber
      ? eq(orders.number, opts.orderNumber)
      : null;
  if (!where) return null;
  const [updated] = await db
    .update(orders)
    .set({ paymentStatus: "paid" satisfies PaymentStatus, status: "paid" satisfies OrderStatus, updatedAt: new Date() })
    .where(where)
    .returning();
  return updated ?? null;
}

export async function markOrderPaymentFailed(paymentId: string) {
  await db
    .update(orders)
    .set({ paymentStatus: "failed", updatedAt: new Date() })
    .where(eq(orders.paymentId, paymentId));
}
