/**
 * ИНН покупателя в заказе — необязательное поле для юрлиц и ИП
 * (нужно для счёта и закрывающих документов).
 *
 * Чистые функции без серверных зависимостей: используются и в форме
 * оформления заказа (клиент), и при создании заказа на сервере.
 */

/** Убирает всё, кроме цифр: «7712345678 » → «7112345678». */
export function normalizeInn(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Проверяет ИНН по правилам ФНС: 10 цифр (юрлица) или 12 цифр (ИП и физлица),
 * включая контрольную цифру. Возвращает понятное сообщение об ошибке или null.
 */
export function validateInn(raw: string): string | null {
  const inn = normalizeInn(raw);
  if (!inn) return null; // поле необязательное
  if (!/^\d{10}$|^\d{12}$/.test(inn)) {
    return "ИНН должен состоять из 10 цифр (организация) или 12 цифр (ИП)";
  }
  if (inn.length === 10 && !isValidChecksum(inn, [2, 4, 10, 3, 5, 9, 4, 6, 8])) {
    return "Проверьте ИНН — контрольная цифра не сходится";
  }
  if (inn.length === 12 && (!isValidChecksum(inn.slice(0, 11), [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) || !isValidChecksum(inn, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]))) {
    return "Проверьте ИНН — контрольные цифры не сходятся";
  }
  return null;
}

/** Контрольная цифра: сумма произведений цифр на коэффициенты mod 11 mod 10. */
function isValidChecksum(digits: string, weights: number[]) {
  const control = digits
    .slice(0, weights.length)
    .split("")
    .reduce((sum, d, i) => sum + Number(d) * weights[i], 0);
  return control % 11 % 10 === Number(digits[weights.length]);
}
