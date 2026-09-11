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

export type DeliveryProvider = "cdek" | "ozon" | "yandex" | "russian_post";

export type DeliveryMethod = {
  id: string;
  provider: DeliveryProvider;
  name: string;
  description: string;
  cost: number;
  needsAddress: boolean;
  addressLabel: string;
};

/** Бесплатная доставка применяется при достижении порога по товарам. */
export const FREE_DELIVERY_THRESHOLD = 2_000;

/** Единый временный тариф для всех способов доставки ниже порога. */
export const FIXED_DELIVERY_COST = 300;

/**
 * Доступные покупателю службы доставки.
 * Идентификатор выбранного способа сохраняется в orders.delivery_method.
 */
export const DELIVERY_METHODS: readonly DeliveryMethod[] = [
  {
    id: "cdek_pvz",
    provider: "cdek",
    name: "СДЭК — пункт выдачи",
    description: "Фиксированная стоимость доставки — 300 ₽",
    cost: FIXED_DELIVERY_COST,
    needsAddress: true,
    addressLabel: "Адрес пункта выдачи СДЭК",
  },
  {
    id: "ozon_pvz",
    provider: "ozon",
    name: "Ozon — пункт выдачи",
    description: "Фиксированная стоимость доставки — 300 ₽",
    cost: FIXED_DELIVERY_COST,
    needsAddress: true,
    addressLabel: "Адрес пункта выдачи Ozon",
  },
  {
    id: "yandex_pvz",
    provider: "yandex",
    name: "Яндекс Доставка — пункт выдачи",
    description: "Фиксированная стоимость доставки — 300 ₽",
    cost: FIXED_DELIVERY_COST,
    needsAddress: true,
    addressLabel: "Адрес пункта выдачи Яндекс Маркета",
  },
  {
    id: "russian_post",
    provider: "russian_post",
    name: "Почта России — отделение",
    description: "Фиксированная стоимость доставки — 300 ₽",
    cost: FIXED_DELIVERY_COST,
    needsAddress: true,
    addressLabel: "Индекс и адрес отделения Почты России",
  },
];

// Старые способы остаются читаемыми в карточках ранее созданных заказов.
const LEGACY_DELIVERY_METHODS: readonly Omit<DeliveryMethod, "provider">[] = [
  {
    id: "post",
    name: "Почта России — отделение",
    description: "Архивный способ доставки",
    cost: 300,
    needsAddress: true,
    addressLabel: "Индекс и адрес отделения Почты России",
  },
  {
    id: "courier",
    name: "Курьер до двери",
    description: "Архивный способ доставки",
    cost: 0,
    needsAddress: true,
    addressLabel: "Адрес доставки",
  },
  {
    id: "pickup",
    name: "Самовывоз",
    description: "Архивный способ доставки",
    cost: 0,
    needsAddress: false,
    addressLabel: "",
  },
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

export function isFreeDelivery(id: string, subtotal: number) {
  return Boolean(getDeliveryMethod(id)) && subtotal >= FREE_DELIVERY_THRESHOLD;
}

export function getDeliveryCost(id: string, subtotal: number) {
  const method = getDeliveryMethod(id);
  if (!method) return 0;
  return isFreeDelivery(id, subtotal) ? 0 : method.cost;
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
