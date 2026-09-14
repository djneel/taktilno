"use client";

import { useEffect, useRef, useState } from "react";

import type { CdekOffice } from "@/lib/delivery/cdek";
import { cn } from "@/lib/utils";

/** Выбор покупателя — уходит в заказ (код пункта нужен для накладной). */
export type CdekPvzChoice = {
  office: CdekOffice;
};

/** Почему списка нет: API недоступен / в городе ничего не нашли. */
export type CdekOfficesFailReason = "unavailable" | "empty";

type OfficesResponse = {
  ok?: boolean;
  offices?: CdekOffice[];
  reason?: string;
  detail?: string;
};

/** Список офисов СДЭК по городу: дебаунс, отмена устаревших запросов, ретрай. */
export function useCdekOffices(city: string, enabled: boolean) {
  const [offices, setOffices] = useState<CdekOffice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CdekOfficesFailReason | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Короткий город: запрос не шлём, старое состояние не трогаем —
    // пикер всё равно показывает подсказку «введите город», а при новом
    // запросе данные/ошибка перезапишутся (без мигания скелетоном).
    if (!enabled || city.trim().length < 2) {
      return;
    }
    let cancelled = false;
    // Город печатают — ждём паузу, чтобы не дёргать API на каждую букву.
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/delivery/cdek/offices?city=${encodeURIComponent(city.trim())}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as OfficesResponse | null;
        if (cancelled) return;
        const list = data?.ok && Array.isArray(data.offices) ? data.offices : [];
        setOffices(list);
        if (!data?.ok) {
          console.error("[cdek-offices] список недоступен:", data?.reason, data?.detail ?? "");
          // Город не найден — просим проверить название, остальное
          // (договор, сеть) — временная недоступность списка.
          setError(data?.reason === "api-error" || data?.reason === "not-configured" ? "unavailable" : "empty");
        } else {
          setError(list.length === 0 ? "empty" : null);
        }
      } catch {
        if (!cancelled) {
          setOffices([]);
          setError("unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [city, enabled, attempt]);

  return { offices, loading, error, retry: () => setAttempt((number) => number + 1) };
}

/** Список ПВЗ/постаматов СДЭК с поиском по адресу. Без карты и Яндекс-ключа. */
export function CdekOfficesPicker({
  city,
  selected,
  onChoose,
  onOfficesError,
}: {
  city: string;
  selected: CdekPvzChoice | null;
  onChoose: (choice: CdekPvzChoice) => void;
  /** Список получить не удалось — родитель переключается на ручной ввод. */
  onOfficesError: (reason: CdekOfficesFailReason) => void;
}) {
  const { offices, loading, error } = useCdekOffices(city, true);
  const [query, setQuery] = useState("");
  const [showList, setShowList] = useState(false);
  const reportedRef = useRef<CdekOfficesFailReason | null>(null);

  // Ошибка → родитель показывает ручной ввод (один раз на каждую ошибку).
  useEffect(() => {
    if (error && reportedRef.current !== error) {
      reportedRef.current = error;
      onOfficesError(error);
    }
    if (!error) reportedRef.current = null;
  }, [error, onOfficesError]);

  // Сбрасывать showList при смене выбора не нужно: карточка рисуется
  // только при selected, без выбора всегда виден список.
  const trimmedCity = city.trim();
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? offices.filter((office) => `${office.name} ${office.address}`.toLowerCase().includes(normalizedQuery))
    : offices;

  if (selected && !showList) {
    return (
      <div className="rounded-2xl bg-green/10 p-4 ring-1 ring-green/30">
        <div className="text-xs font-bold uppercase tracking-wider text-green">
          {selected.office.type === "POSTAMAT" ? "Постамат СДЭК" : "Пункт выдачи СДЭК"}
        </div>
        <div className="mt-1 font-bold">{selected.office.name || selected.office.address}</div>
        {selected.office.name && <div className="text-sm text-muted">{selected.office.address}</div>}
        <div className="mt-1 text-xs text-muted">
          {selected.office.city}
          {selected.office.postalCode ? `, ${selected.office.postalCode}` : ""} · код {selected.office.code}
          {selected.office.workTime ? ` · ${selected.office.workTime}` : ""}
        </div>
        <button
          type="button"
          onClick={() => setShowList(true)}
          className="mt-3 inline-flex h-10 items-center rounded-full bg-bg2 px-4 text-xs font-bold ring-1 ring-line/60 transition-colors hover:text-green"
        >
          Выбрать другой пункт →
        </button>
      </div>
    );
  }

  if (trimmedCity.length < 2) {
    return (
      <div className="rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
        Введите город выше — покажем пункты выдачи СДЭК списком.
      </div>
    );
  }

  if (loading && offices.length === 0) {
    return (
      <div className="space-y-2" aria-label="Загрузка пунктов выдачи">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl bg-bg2/60 ring-1 ring-line/60" aria-hidden="true" />
        ))}
      </div>
    );
  }

  // Ошибка: родитель уже переключил блок на ручной ввод и подсказку.
  if (error) return null;

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        Пункт выдачи <span className="text-green">*</span>
      </span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Улица, дом или название…"
        autoComplete="off"
        aria-label="Найти пункт выдачи по адресу"
        className="h-13 min-h-12 w-full rounded-2xl bg-bg2 px-4 text-base outline-none ring-1 ring-line/60 focus:ring-green"
      />
      <div className="mt-1.5 text-xs text-muted">
        {normalizedQuery && filtered.length === 0
          ? "Ничего не найдено — измените запрос."
          : `Найдено: ${filtered.length}`}
      </div>
      <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
        {filtered.map((office) => {
          const active = selected?.office.code === office.code;
          return (
            <li key={office.code}>
              <button
                type="button"
                onClick={() => onChoose({ office })}
                aria-pressed={active}
                className={cn(
                  "w-full rounded-2xl p-4 text-left ring-1 transition-colors",
                  active ? "bg-bg2 ring-green" : "bg-bg2/40 ring-line/60 hover:ring-line"
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold leading-snug">{office.address}</span>
                  <span className="shrink-0 rounded-full bg-green/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-green">
                    {office.type === "POSTAMAT" ? "Постамат" : "ПВЗ"}
                  </span>
                </span>
                {(office.name || office.workTime) && (
                  <span className="mt-0.5 block text-xs text-muted">
                    {[office.name, office.workTime].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const OFFICES_FAIL_TEXT: Record<CdekOfficesFailReason, string> = {
  unavailable: "Список пунктов выдачи СДЭК временно недоступен.",
  empty: "В этом городе пункты выдачи СДЭК не найдены — проверьте название города.",
};

/** Пояснение, почему нет списка, + ручной ввод адреса как запасной путь. */
export function CdekOfficesFailNote({ reason, onRetry }: { reason: CdekOfficesFailReason; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl bg-bg2/60 px-4 py-3 text-sm text-muted ring-1 ring-line/60">
      {OFFICES_FAIL_TEXT[reason]} Введите адрес ПВЗ вручную.{" "}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-bold text-green underline underline-offset-2"
        >
          Попробовать список снова
        </button>
      )}
    </div>
  );
}
