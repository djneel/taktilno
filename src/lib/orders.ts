import { db } from "@/db";
import { orders, orderItems, products, type OrderStatus, type PaymentStatus } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { getMainImage } from "./images";
import {
  FREE_DELIVERY_THRESHOLD,
  getDeliveryCost,
  getDeliveryMethod,
  isCdek,
  isRussianPost,
  ONLINE_PAYMENT_METHOD,
  PICKUP_ADDRESS,
  PICKUP_CITY,
} from "./constants";
import { getPaymentProvider } from "./payments";
import { notifyNewOrder } from "./notifications";
import { normalizeInn, validateInn } from "./inn";
import {
  estimateParcelWeightGrams,
  getRussianPostQuote,
  isValidPostcode,
  normalizePostcode,
} from "./delivery/russian-post";
import { getCdekQuote } from "./delivery/cdek";

/**
 * Пункт выдачи СДЭК, выбранный покупателем в виджете на карте.
 * Код едет в накладную, остальное — для точного тарифа и отображения.
 */
export type CdekPvzSelection = {
  code: string;
  name?: string;
  address?: string;
  city?: string;
  cityCode?: number;
  postalCode?: string;
  workTime?: string;
  type?: string;
};

export type CheckoutInput = {
  name: string;
  phone: string;
  email: string;
  city?: string;
  deliveryMethod: string;
  cdekPvz?: CdekPvzSelection;
  postcode?: string;
  address?: string;
  paymentMethod: string;
  comment?: string;
  inn?: string;
  items: { productId: number; quantity: number; variantName?: string }[];
};

export class CheckoutError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "CheckoutError";
  }
}

/** Чистит выбор ПВЗ из виджета: код обязателен, остальное опционально. */
function sanitizePvzSelection(input: CheckoutInput["cdekPvz"]): CdekPvzSelection | null {
  if (!input || typeof input !== "object") return null;
  const code = String(input.code ?? "").trim().slice(0, 30);
  if (!code) return null;
  const cityCode = Math.round(Number(input.cityCode));
  const postalCode = String(input.postalCode ?? "").replace(/\D/g, "").slice(0, 6);
  return {
    code,
    ...(typeof input.name === "string" && input.name.trim() ? { name: input.name.trim().slice(0, 160) } : {}),
    ...(typeof input.address === "string" && input.address.trim()
      ? { address: input.address.trim().slice(0, 255) }
      : {}),
    ...(typeof input.city === "string" && input.city.trim() ? { city: input.city.trim().slice(0, 120) } : {}),
    ...(Number.isFinite(cityCode) && cityCode > 0 ? { cityCode } : {}),
    ...(postalCode.length === 6 ? { postalCode } : {}),
    ...(typeof input.workTime === "string" && input.workTime.trim()
      ? { workTime: input.workTime.trim().slice(0, 255) }
      : {}),
    ...(typeof input.type === "string" && input.type.trim() ? { type: input.type.trim().slice(0, 20) } : {}),
  };
}

function makeOrderNumber(id: number) {
  return `ТАК-${String(id).padStart(4, "0")}`;
}

export async function createOrder(input: CheckoutInput) {
  const name = input.name?.trim();
  const phone = input.phone?.trim();
  const email = input.email?.trim();
  if (!name || name.length < 2) throw new CheckoutError("Укажите имя");
  if (!phone || phone.replace(/\D/g, "").length < 10) throw new CheckoutError("Укажите корректный телефон");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError("Укажите корректный e-mail");

  const delivery = getDeliveryMethod(input.deliveryMethod);
  if (!delivery) throw new CheckoutError("Выберите способ доставки");

  const submittedCity = input.city?.trim() ?? "";
  const submittedAddress = input.address?.trim() ?? "";
  const submittedPostcode = normalizePostcode(input.postcode ?? "");
  if (delivery.needsCity && !submittedCity) throw new CheckoutError("Укажите город");
  if (delivery.needsPostcode && !isValidPostcode(submittedPostcode)) {
    throw new CheckoutError("Укажите корректный индекс (6 цифр)");
  }
  if (delivery.needsAddress && !submittedAddress) {
    throw new CheckoutError("Укажите адрес / пункт выдачи");
  }

  // ПВЗ из виджета: чистим всё, что прислал клиент (доверяем как обычному вводу формы).
  const pvz = sanitizePvzSelection(isCdek(delivery.id) ? input.cdekPvz : undefined);

  // Для самовывоза не доверяем скрытым полям формы: сохраняем единые адрес и город точки выдачи.
  const city = delivery.needsCity ? submittedCity : PICKUP_CITY;
  const address = delivery.needsAddress ? submittedAddress : PICKUP_ADDRESS;

  if (input.paymentMethod !== ONLINE_PAYMENT_METHOD) {
    throw new CheckoutError("Доступна только онлайн-оплата через ЮKassa");
  }

  const paymentProvider = getPaymentProvider();
  if (!paymentProvider.isConfigured) {
    throw new CheckoutError("Онлайн-оплата через ЮKassa временно недоступна", 503);
  }

  const inn = normalizeInn(input.inn ?? "");
  const innError = validateInn(inn);
  if (innError) throw new CheckoutError(innError);

  if (!input.items?.length) throw new CheckoutError("Корзина пуста");

  const ids = [...new Set(input.items.map((item) => Number(item.productId)).filter(Boolean))];
  const dbProducts = await db.query.products.findMany({
    where: inArray(products.id, ids),
    with: { images: true },
  });

  const lines = input.items
    .map((item) => {
      const product = dbProducts.find((candidate) => candidate.id === Number(item.productId));
      if (!product) return null;
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
      const variantName = typeof item.variantName === "string" ? item.variantName.trim() : "";
      const itemName = variantName ? `${product.name} — ${variantName}` : product.name;
      return { product, quantity, itemName };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (!lines.length) throw new CheckoutError("Товары из корзины больше не доступны");

  const requestedByProduct = new Map<number, number>();
  for (const line of lines) {
    requestedByProduct.set(
      line.product.id,
      (requestedByProduct.get(line.product.id) ?? 0) + line.quantity
    );
  }

  for (const product of dbProducts) {
    const requested = requestedByProduct.get(product.id) ?? 0;
    if (requested === 0) continue;
    if (!product.isAvailable) throw new CheckoutError(`«${product.name}» сейчас недоступен`);
    if (product.stock < requested) {
      throw new CheckoutError(
        product.stock === 0
          ? `«${product.name}» закончился`
          : `«${product.name}»: в наличии только ${product.stock} шт.`
      );
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  // Итог всегда рассчитывается на сервере. Почта России и СДЭК (гибрид): бесплатно
  // от порога, ниже порога — живой тариф службы (Почта — по индексу получателя,
  // СДЭК — по городу) с graceful fallback на 300 ₽, если API недоступны или
  // договора нет. Остальные службы — 300 ₽ ниже порога, бесплатно от порога;
  // самовывоз бесплатен всегда.
  let deliveryCost: number;
  if (subtotal < FREE_DELIVERY_THRESHOLD && (isRussianPost(delivery.id) || isCdek(delivery.id))) {
    const weightGrams = estimateParcelWeightGrams(
      lines.map((line) => ({ weightGrams: line.product.weightGrams ?? null, quantity: line.quantity }))
    );
    if (isRussianPost(delivery.id)) {
      const quote = await getRussianPostQuote({
        postcode: submittedPostcode,
        weightGrams,
        declaredValueRub: subtotal,
      });
      deliveryCost = getDeliveryCost(delivery.id, subtotal, { russianPostCost: quote.cost });
    } else {
      const quote = await getCdekQuote({
        city: submittedCity,
        address: submittedAddress,
        // Код города и индекс из виджета точнее названия — тариф считается по ним.
        ...(pvz?.cityCode ? { cityCode: pvz.cityCode } : {}),
        ...(pvz?.postalCode ? { postcode: pvz.postalCode } : {}),
        weightGrams,
        declaredValueRub: subtotal,
      });
      deliveryCost = getDeliveryCost(delivery.id, subtotal, { cdekCost: quote.cost });
    }
  } else {
    deliveryCost = getDeliveryCost(delivery.id, subtotal);
  }
  const total = subtotal + deliveryCost;

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
        postcode: delivery.needsPostcode ? submittedPostcode : "",
        address,
        cdekPvzCode: pvz?.code ?? null,
        comment: input.comment?.trim() ?? "",
        inn,
        subtotal,
        deliveryCost,
        total,
        status: "new",
        paymentStatus: "pending",
        paymentProvider: paymentProvider.id,
      })
      .returning();

    const number = makeOrderNumber(order.id);
    await tx.update(orders).set({ number }).where(eq(orders.id, order.id));

    await tx.insert(orderItems).values(
      lines.map((line) => ({
        orderId: order.id,
        productId: line.product.id,
        name: line.itemName,
        slug: line.product.slug,
        price: line.product.price,
        quantity: line.quantity,
        imageUrl: getMainImage(line.product)?.url ?? null,
      }))
    );

    // Резервируем остатки до подтверждения платежа и увеличиваем популярность.
    for (const line of lines) {
      await tx
        .update(products)
        .set({
          stock: sql`GREATEST(${products.stock} - ${line.quantity}, 0)`,
          popularity: sql`${products.popularity} + ${line.quantity}`,
        })
        .where(eq(products.id, line.product.id));
    }

    return { ...order, number };
  });

  let payment;
  try {
    payment = await paymentProvider.createPayment({
      orderId: created.id,
      orderNumber: created.number,
      amount: total,
      description: `Заказ ${created.number} — ТАКТИЛЬНО`,
      customerEmail: email,
      customerPhone: phone,
      items: lines.map((line) => ({
        name: line.itemName,
        quantity: line.quantity,
        price: line.product.price,
      })),
      delivery: {
        name: delivery.name,
        price: deliveryCost,
      },
    });
  } catch (error) {
    console.error("[payments] Не удалось создать платёж ЮKassa:", error);
    try {
      await releaseOrderReservation(created.id, lines);
    } catch (releaseError) {
      console.error("[orders] Не удалось освободить резерв после ошибки оплаты:", releaseError);
    }
    throw new CheckoutError("Не удалось создать платёж в ЮKassa. Попробуйте ещё раз.", 502);
  }

  await db
    .update(orders)
    .set({
      paymentId: payment.paymentId,
      paymentUrl: payment.url,
      paymentProvider: payment.provider,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, created.id));

  const full = await db.query.orders.findFirst({
    where: eq(orders.id, created.id),
    with: { items: true },
  });
  if (full) {
    try {
      await notifyNewOrder(full);
    } catch (error) {
      console.error("[notifications] Ошибка отправки уведомления:", error);
    }
  }

  return {
    orderNumber: created.number,
    paymentUrl: payment.url,
    paymentMode: "redirect" as const,
    total,
  };
}

async function releaseOrderReservation(
  orderId: number,
  lines: { product: typeof products.$inferSelect; quantity: number }[]
) {
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "cancelled", paymentStatus: "failed", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    for (const line of lines) {
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} + ${line.quantity}`,
          popularity: sql`GREATEST(${products.popularity} - ${line.quantity}, 0)`,
        })
        .where(eq(products.id, line.product.id));
    }
  });
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
