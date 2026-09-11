import type { ImageKind, OrderStatus, PaymentStatus } from "@/db/schema";

export const IMAGE_KIND_LABELS: Record<ImageKind, string> = {
  main: "Главное",
  front: "Спереди",
  side: "Сбоку",
  back: "Сзади",
  top: "Сверху",
  detail: "Детали",
  hand: "В руке",
  lifestyle: "Lifestyle",
  frame360: "Кадр 360°",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  paid: "Оплачен",
  processing: "В обработке",
  shipped: "Отправлен",
  completed: "Завершён",
  cancelled: "Отменён",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
  refunded: "Возврат",
};

export type DeliveryProvider = "cdek" | "ozon" | "yandex" | "russian_post" | "pickup";

export type DeliveryMethod = {
  id: string;
  provider: DeliveryProvider;
  name: string;
  description: string;
  cost: number;
  needsCity: boolean;
  needsAddress: boolean;
  /** Почта России дополнительно требует индекс получателя для расчёта тарифа. */
  needsPostcode: boolean;
  addressLabel: string;
};

/** Бесплатная доставка применяется при достижении порога по товарам. */
export const FREE_DELIVERY_THRESHOLD = 2_000;

/** Единый тариф для служб доставки ниже порога бесплатной доставки. */
export const FIXED_DELIVERY_COST = 300;

export const PICKUP_CITY = "Краснодар";
export const PICKUP_ADDRESS = "Краснодар, ул. Базовская Дамба, 4";
export const PICKUP_HOURS = "с 9:00 до 20:00";

/** Единственный доступный способ оплаты заказа. */
export const ONLINE_PAYMENT_METHOD = "yookassa" as const;

/** Идентификатор способа доставки Почтой России (тариф считается по индексу). */
export const RUSSIAN_POST_METHOD_ID = "russian_post";

/**
 * Доступные покупателю способы получения заказа.
 * Идентификатор выбранного способа сохраняется в orders.delivery_method.
 */
export const DELIVERY_METHODS: readonly DeliveryMethod[] = [
  {
    id: "cdek_pvz",
    provider: "cdek",
    name: "СДЭК — пункт выдачи",
    description: "Доставка в выбранный пункт СДЭК",
    cost: FIXED_DELIVERY_COST,
    needsCity: true,
    needsAddress: true,
    needsPostcode: false,
    addressLabel: "Адрес пункта выдачи СДЭК",
  },
  {
    id: "ozon_pvz",
    provider: "ozon",
    name: "Ozon — пункт выдачи",
    description: "Доставка в выбранный пункт Ozon",
    cost: FIXED_DELIVERY_COST,
    needsCity: true,
    needsAddress: true,
    needsPostcode: false,
    addressLabel: "Адрес пункта выдачи Ozon",
  },
  {
    id: "yandex_pvz",
    provider: "yandex",
    name: "Яндекс Доставка — пункт выдачи",
    description: "Доставка в выбранный пункт Яндекс Маркета",
    cost: FIXED_DELIVERY_COST,
    needsCity: true,
    needsAddress: true,
    needsPostcode: false,
    addressLabel: "Адрес пункта выдачи Яндекс Маркета",
  },
  {
    id: "russian_post",
    provider: "russian_post",
    name: "Почта России — отделение",
    description: "Тариф рассчитывается по вашему индексу на сайте Почты России",
    cost: FIXED_DELIVERY_COST,
    needsCity: true,
    needsAddress: true,
    needsPostcode: true,
    addressLabel: "Улица, дом, квартира и отделение Почты России",
  },
  {
    id: "pickup",
    provider: "pickup",
    name: "Самовывоз",
    description: `${PICKUP_ADDRESS} · ${PICKUP_HOURS}`,
    cost: 0,
    needsCity: false,
    needsAddress: false,
    needsPostcode: false,
    addressLabel: "",
  },
];

// Старые способы остаются читаемыми в карточках ранее созданных заказов.
const LEGACY_DELIVERY_METHODS: readonly { id: string; name: string }[] = [
  { id: "post", name: "Почта России — отделение" },
  { id: "courier", name: "Курьер до двери" },
];

export function getDeliveryMethod(id: string) {
  return DELIVERY_METHODS.find((method) => method.id === id);
}

export function getDeliveryMethodName(id: string) {
  return (
    getDeliveryMethod(id)?.name ??
    LEGACY_DELIVERY_METHODS.find((method) => method.id === id)?.name ??
    id
  );
}

export function isPickup(id: string) {
  return getDeliveryMethod(id)?.provider === "pickup";
}

export function isFreeDelivery(id: string, subtotal: number) {
  const method = getDeliveryMethod(id);
  return Boolean(method && (method.cost === 0 || subtotal >= FREE_DELIVERY_THRESHOLD));
}

export function isRussianPost(id: string) {
  return id === RUSSIAN_POST_METHOD_ID;
}

export function getDeliveryCost(id: string, subtotal: number, opts?: { russianPostCost?: number }) {
  const method = getDeliveryMethod(id);
  if (!method) return 0;
  if (isFreeDelivery(id, subtotal)) return 0;
  // Почта России: ниже порога бесплатной доставки берём живой тариф из API
  // (см. src/lib/delivery/russian-post.ts); пока тарифа нет — фиксированные 300 ₽.
  if (isRussianPost(id) && opts?.russianPostCost !== undefined) {
    const quoted = Math.round(opts.russianPostCost);
    return Number.isFinite(quoted) && quoted >= 0 ? quoted : method.cost;
  }
  return method.cost;
}

export const SETTING_KEYS = {
  heroProductSlug: "hero_product_slug",
  heroImageUrl: "hero_image_url",
  tactileImageUrl: "tactile_image_url",
  viewerProductSlug: "viewer_product_slug",
  processImages: "process_images", // JSON массив из 5 url
  contactTelegram: "contact_telegram",
  contactVk: "contact_vk",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  seeded: "seeded",
} as const;
