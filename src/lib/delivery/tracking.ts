/**
 * Трек-номера и ссылки на отслеживание: у каждой службы свой сайт и формат номера.
 */

import { isCdek, isRussianPost } from "@/lib/constants";
import {
  getCdekTrackingUrl,
  isCdekTrackingNumber,
  normalizeCdekTrackingNumber,
} from "./cdek";
import { getRussianPostTrackingUrl, isTrackingNumber, normalizeTrackingNumber } from "./russian-post";

export type TrackingLink = {
  url: string;
  /** Подпись для карточки заказа: «Отслеживание СДЭК» и т. п. */
  label: string;
};

/**
 * Ссылка на отслеживание по способу доставки заказа.
 * null — служба без публичного трекинга по номеру (Ozon, Яндекс): показываем только номер.
 */
export function getTrackingLink(deliveryMethod: string, trackingNumber: string): TrackingLink | null {
  const number = (trackingNumber ?? "").trim();
  if (!number) return null;
  if (isCdek(deliveryMethod)) {
    return { url: getCdekTrackingUrl(number), label: "Отслеживание СДЭК" };
  }
  if (isRussianPost(deliveryMethod)) {
    return { url: getRussianPostTrackingUrl(number), label: "Отслеживание Почты России" };
  }
  return null;
}

export type TrackingNumberCheck =
  | { ok: true; number: string }
  | { ok: false; number: string; error: string };

/** Проверяет и нормализует трек-номер по правилам службы доставки заказа. */
export function normalizeOrderTrackingNumber(deliveryMethod: string, raw: string): TrackingNumberCheck {
  if (isCdek(deliveryMethod)) {
    const number = normalizeCdekTrackingNumber(raw);
    return isCdekTrackingNumber(raw)
      ? { ok: true, number }
      : {
          ok: false,
          number,
          error: "Трек-номер СДЭК — 8–20 цифр или букв с накладной (обычно 10 цифр)",
        };
  }
  const number = normalizeTrackingNumber(raw);
  return isTrackingNumber(raw)
    ? { ok: true, number }
    : {
        ok: false,
        number,
        error: "Трек-номер Почты России — 14 цифр (или международный формат S10, например RA123456789RU)",
      };
}

/** Подсказка под полем трек-номера в админке. */
export function getTrackingHint(deliveryMethod: string) {
  if (isCdek(deliveryMethod)) {
    return "Номер с накладной СДЭК — обычно 10 цифр. Пусто — убрать номер.";
  }
  if (isRussianPost(deliveryMethod)) {
    return "14 цифр с чека Почты (или международный формат S10). Пусто — убрать номер.";
  }
  return "Трек-номер перевозчика. Пусто — убрать номер.";
}
