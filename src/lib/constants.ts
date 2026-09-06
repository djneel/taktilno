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

export type DeliveryMethod = {
  id: string;
  name: string;
  description: string;
  cost: number | null; // null — рассчитывается менеджером
  needsAddress: boolean;
  addressLabel: string;
};

/** Способы доставки. Расчёт через API СДЭК/Boxberry можно подключить в src/lib/delivery.ts */
export const DELIVERY_METHODS: DeliveryMethod[] = [
  {
    id: "cdek_pvz",
    name: "СДЭК — пункт выдачи",
    description: "3–7 дней по России",
    cost: 350,
    needsAddress: true,
    addressLabel: "Адрес пункта выдачи",
  },
  {
    id: "post",
    name: "Почта России",
    description: "5–14 дней",
    cost: 300,
    needsAddress: true,
    addressLabel: "Индекс и адрес",
  },
  {
    id: "courier",
    name: "Курьер до двери",
    description: "Стоимость рассчитает менеджер",
    cost: null,
    needsAddress: true,
    addressLabel: "Адрес доставки",
  },
  {
    id: "pickup",
    name: "Самовывоз",
    description: "Договоримся о встрече",
    cost: 0,
    needsAddress: false,
    addressLabel: "",
  },
];

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
