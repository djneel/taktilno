/**
 * Общий расчёт веса посылки для служб доставки.
 *
 * Вес берётся из карточки товара (products.weight_grams), иначе —
 * значение по умолчанию у службы; сверху добавляется вес упаковки.
 */

export type ParcelWeightOptions = {
  /** Вес одного изделия по умолчанию, г (когда у товара не указан вес). */
  defaultItemWeightG: number;
  /** Вес упаковки посылки, г. */
  packagingWeightG: number;
  /** Минимальный вес к расчёту, г. По умолчанию 100 — легче перевозчики не считают. */
  minWeightGrams?: number;
};

export function estimateParcelWeightGrams(
  lines: { weightGrams?: number | null; quantity: number }[],
  opts: ParcelWeightOptions
): number {
  const items = lines.reduce((sum, line) => {
    const perUnit =
      line.weightGrams && Number.isFinite(line.weightGrams) && line.weightGrams > 0
        ? Math.round(line.weightGrams)
        : opts.defaultItemWeightG;
    const qty = Math.max(1, Math.min(99, Math.floor(line.quantity) || 1));
    return sum + perUnit * qty;
  }, 0);
  return Math.max(opts.minWeightGrams ?? 100, items + opts.packagingWeightG);
}
