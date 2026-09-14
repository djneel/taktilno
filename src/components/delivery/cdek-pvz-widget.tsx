"use client";

/**
 * Виджет пунктов выдачи СДЭК (официальный cdek-it/widget v3).
 *
 * Два режима:
 *   CdekPvzPicker — чекаут: кнопка открывает карту в popup-окне, покупатель
 *   выбирает ПВЗ (onChoose), выбор летит в заказ (код — в накладную).
 *   Тяжёлые скрипты (UMD ~700 КБ + лоадер Яндекс.Карт) прогреваются заранее
 *   через warmupCdekWidget(), как только известно, что виджет включён.
 *   Тариф виджета — ориентир; авторитетная цена — наш серверный расчёт.
 *
 *   CdekPvzMap — страница доставки: встроенная карта ПВЗ без выбора
 *   (canChoose: false), чисто «посмотреть где забирать».
 *
 * Если скрипт/карта недоступны — зовём onWidgetError, родитель откатывается
 * на ручной ввод города и адреса (оформление не блокируется никогда).
 */

import { useEffect, useId, useRef, useState } from "react";

import "./cdek-pvz-popup.css";

/** Запиненная версия виджета (см. DEPLOY.md, раздел «Виджет ПВЗ СДЭК»). */
export const CDEK_WIDGET_VERSION = "3.13.1";
const WIDGET_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/@cdek-it/widget@${CDEK_WIDGET_VERSION}/dist/cdek-widget.umd.js`;

/* ---------------- Типы виджета (подмножество cdek-widget.es.d.ts) ---------------- */

export type CdekWidgetFrom = {
  country_code: string;
  city: string;
  postal_code?: string | null;
  code?: number | null;
  address?: string | null;
};

/** Почему карта недоступна: нет ключа в сборке / не грузится CDN / упал конструктор. */
export type CdekWidgetFailReason = "no-key" | "cdn" | "init";

export type CdekWidgetTariff = {
  tariff_code: number;
  tariff_name: string;
  tariff_description: string;
  delivery_mode: number;
  period_min: number;
  period_max: number;
  delivery_sum: number;
};

export type CdekWidgetOffice = {
  city_code: number;
  city: string;
  type: string;
  postal_code: string;
  country_code: string;
  have_cashless: boolean;
  have_cash: boolean;
  allowed_cod: boolean;
  is_dressing_room: boolean;
  code: string;
  name: string;
  address: string;
  work_time: string;
  location: number[];
};

/** Выбор покупателя в виджете — уходит в заказ. */
export type CdekPvzChoice = {
  tariffCode: number | null;
  tariffName: string | null;
  deliverySum: number | null;
  periodMin: number | null;
  periodMax: number | null;
  office: {
    code: string;
    name: string;
    address: string;
    city: string;
    cityCode: number | null;
    postalCode: string | null;
    workTime: string | null;
    type: string;
  };
};

type CdekWidgetInstance = {
  open(): void;
  close(): void;
  destroy(): void;
  addParcel(parcel: { length: number; width: number; height: number; weight: number }): void;
  resetParcels(): void;
  updateLocation(location: string | number[]): void;
};

type CdekWidgetConstructor = new (opts: {
  from: string | CdekWidgetFrom;
  root: string;
  apiKey: string;
  servicePath: string;
  popup?: boolean;
  canChoose?: boolean;
  hideFilters?: { have_cashless?: boolean; have_cash?: boolean; is_dressing_room?: boolean; type?: boolean };
  hideDeliveryOptions?: { door?: boolean; office?: boolean };
  tariffs?: { office?: number[]; door?: number[]; pickup?: number[] };
  goods?: { length: number; width: number; height: number; weight: number }[];
  defaultLocation?: string | number[];
  lang?: string;
  currency?: string;
  onReady?(): void;
  onCalculate?(tariffs: unknown, address: unknown): void;
  onChoose?(mode: string, tariff: CdekWidgetTariff | null, target: CdekWidgetOffice): void;
}) => CdekWidgetInstance;

declare global {
  interface Window {
    CDEKWidget?: CdekWidgetConstructor;
  }
}

/* ---------------- Загрузчик скрипта (один на страницу) ---------------- */

let scriptPromise: Promise<CdekWidgetConstructor> | null = null;

/** Грузит UMD-бандл виджета с CDN. Повторный вызов переиспользует промис. */
export function loadCdekWidget(): Promise<CdekWidgetConstructor> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.CDEKWidget) return Promise.resolve(window.CDEKWidget);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = WIDGET_SCRIPT_URL;
      script.async = true;
      script.charset = "utf-8";
      script.onload = () => {
        if (window.CDEKWidget) resolve(window.CDEKWidget);
        else {
          scriptPromise = null;
          reject(cdnError("Виджет СДЭК загрузился, но не инициализировался"));
        }
      };
      script.onerror = () => {
        scriptPromise = null;
        script.remove();
        reject(cdnError("Не удалось загрузить виджет СДЭК с CDN"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

function cdnError(message: string) {
  return Object.assign(new Error(message), { code: "cdn" });
}

function isCdnError(error: unknown) {
  return (
    error instanceof Error && (error as { code?: unknown }).code === "cdn"
  );
}

let warmedUp = false;

/**
 * Прогрев тяжёлых скриптов карты ДО клика: UMD виджета (~700 КБ),
 * preconnect к хостам и preload лоадера Яндекс.Карт v3.
 *
 * Вызывать, как только известно, что виджет включён (в чекауте — сразу при
 * получении конфига, пока покупатель заполняет контакты). Квоту Яндекс.Карт
 * не тратит: засчитываются только инициализации карты, а не скачивание JS.
 * Идемпотентна: повторные вызовы — no-op.
 */
export function warmupCdekWidget() {
  if (typeof window === "undefined" || warmedUp) return;
  const yandexKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ?? "";
  if (!yandexKey) return;
  warmedUp = true;
  // Тот же промис, что использует open(), — к клику скрипт уже в кеше.
  loadCdekWidget().catch(() => {
    // Клик повторит загрузку и покажет ошибку, если CDN недоступен.
  });
  // DNS+TLS заранее — экономим рукопожатия в момент открытия карты.
  for (const href of ["https://cdn.jsdelivr.net", "https://api-maps.yandex.ru", "https://geocode-maps.yandex.ru"]) {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    document.head.appendChild(link);
  }
  // Точный URL лоадера, который запросит виджет (vue-yandex-maps внутри
  // бандла 3.13.1: `${domain}/${version}/` + lang, apikey — в этом порядке).
  // Классический <script> виджета подхватит предзагруженное из кеша.
  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "script";
  preload.href = `https://api-maps.yandex.ru/v3/?lang=ru_RU&apikey=${encodeURIComponent(yandexKey)}`;
  document.head.appendChild(preload);
}

/* ---------------- Конфиг виджета с сервера ---------------- */

export type CdekWidgetConfig = {
  ok: boolean;
  enabled: boolean;
  configured: boolean;
  yandexKeyConfigured: boolean;
  servicePath: string;
  from: CdekWidgetFrom;
  tariffs: { office: number[]; door: number[]; pickup: number[] };
  package: { length: number; width: number; height: number };
};

export async function fetchCdekWidgetConfig(): Promise<CdekWidgetConfig> {
  const res = await fetch("/api/delivery/cdek/widget-config", { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось получить конфигурацию виджета СДЭК");
  return (await res.json()) as CdekWidgetConfig;
}

/* ---------------- Общие опции ---------------- */

function baseOptions(config: CdekWidgetConfig, yandexKey: string) {
  return {
    from: config.from,
    apiKey: yandexKey,
    servicePath: config.servicePath,
    // Оплата только онлайн и только предоплата — фильтры «оплата в ПВЗ» прячем,
    // примерочную и тип точки оставляем на усмотрение покупателя.
    // Объекты полные (как в wiki) — частичные может не принять валидация.
    hideFilters: { have_cash: true, have_cashless: true, is_dressing_room: false, type: false },
    // Способ доставки у нас только «до пункта выдачи» — курьера прячем.
    hideDeliveryOptions: { door: true, office: false },
    tariffs: config.tariffs,
    lang: "rus",
    currency: "RUB",
  };
}

/* ---------------- Пикер для чекаута (popup) ---------------- */

export function CdekPvzPicker({
  config,
  city,
  weightGrams,
  selected,
  onChoose,
  onWidgetError,
}: {
  /** Конфиг с /api/delivery/cdek/widget-config (enabled уже проверен родителем). */
  config: CdekWidgetConfig;
  /** Город для центрирования карты. */
  city: string;
  /** Вес посылки для расчёта тарифов внутри виджета. */
  weightGrams: number;
  selected: CdekPvzChoice | null;
  onChoose: (choice: CdekPvzChoice) => void;
  /**
   * Скрипт или виджет не завелись — родитель откатывается на ручной ввод.
   * Причина (для понятной подсказки): no-key — ключа нет в сборке (нужен
   * редеплой), cdn — не загрузился скрипт, init — упал конструктор/карта.
   */
  onWidgetError: (reason: CdekWidgetFailReason) => void;
}) {
  const rootId = `cdek-map-${useId().replace(/:/g, "")}`;
  const instanceRef = useRef<CdekWidgetInstance | null>(null);
  const [opening, setOpening] = useState(false);
  const failedRef = useRef(false);
  // Карта хоть раз полностью инициализировалась (сработал onReady виджета).
  const readyRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Актуальные колбэки для замыканий виджета (пересоздавать инстанс не хотим).
  const callbacksRef = useRef({ onChoose, onWidgetError });
  const configRef = useRef(config);
  useEffect(() => {
    callbacksRef.current = { onChoose, onWidgetError };
    configRef.current = config;
  });

  // Кнопка видна — начинаем греть скрипты, не дожидаясь клика.
  useEffect(() => {
    warmupCdekWidget();
  }, []);

  useEffect(() => {
    const instance = instanceRef.current;
    return () => {
      instanceRef.current = null;
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
      try {
        instance?.destroy();
      } catch {
        // Виджет уже мёртв — нечего чистить.
      }
    };
  }, []);

  // Вес приехал позже (из серверной котировки) — обновляем посылку в виджете.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !Number.isFinite(weightGrams) || weightGrams < 100) return;
    try {
      const { length, width, height } = configRef.current.package;
      instance.resetParcels();
      instance.addParcel({ length, width, height, weight: Math.round(weightGrams) });
    } catch {
      // Не критично: тарифы в виджете — ориентир, цена считается на сервере.
    }
  }, [weightGrams]);

  const fail = (reason: CdekWidgetFailReason, detail: unknown) => {
    console.error(
      "[cdek-widget] карта недоступна:",
      reason,
      detail instanceof Error ? detail.message : detail
    );
    if (failedRef.current) return;
    failedRef.current = true;
    setOpening(false);
    callbacksRef.current.onWidgetError(reason);
  };

  // Виджет глотает ошибки карты (белый экран без колбэка): если onReady
  // (стреляет после полной загрузки UI виджета) не сработал за 40 секунд
  // после открытия — считаем карту недоступной и откатываемся на ручной
  // ввод: родитель покажет подсказку и кнопку «Попробовать карту снова».
  const armWatchdog = () => {
    if (readyRef.current || watchdogRef.current) return;
    watchdogRef.current = setTimeout(() => {
      watchdogRef.current = null;
      if (readyRef.current) return;
      try {
        instanceRef.current?.close();
      } catch {
        // Уже закрыт или мёртв.
      }
      fail(
        "init",
        "карта не инициализировалась за 40 секунд — вероятно, блокировщик рекламы режет api-maps.yandex.ru или Яндекс недоступен"
      );
    }, 40_000);
  };

  const open = async () => {
    const yandexKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ?? "";
    if (!yandexKey) {
      fail("no-key", "NEXT_PUBLIC_YANDEX_MAPS_API_KEY пуст в сборке — нужен редеплой");
      return;
    }
    // Инстанс уже есть — двигаем карту к актуальному городу и открываем.
    if (instanceRef.current) {
      try {
        if (city.trim()) instanceRef.current.updateLocation(city.trim());
        armWatchdog();
        instanceRef.current.open();
      } catch (error) {
        fail("init", error);
      }
      return;
    }
    setOpening(true);
    try {
      const CDEKWidget = await loadCdekWidget();
      const cfg = configRef.current;
      const weight = Number.isFinite(weightGrams) && weightGrams >= 100 ? Math.round(weightGrams) : 500;
      const instance = new CDEKWidget({
        ...baseOptions(cfg, yandexKey),
        root: rootId,
        popup: true,
        canChoose: true,
        goods: [
          {
            length: cfg.package.length,
            width: cfg.package.width,
            height: cfg.package.height,
            weight,
          },
        ],
        ...(city.trim() ? { defaultLocation: city.trim() } : {}),
        onChoose: (mode, tariff, target) => {
          try {
            instanceRef.current?.close();
          } catch {
            // Виджет сам закрыл popup — ок.
          }
          if (mode !== "office" || !target?.code) return;
          callbacksRef.current.onChoose({
            tariffCode: tariff?.tariff_code ?? null,
            tariffName: tariff?.tariff_name ?? null,
            deliverySum: typeof tariff?.delivery_sum === "number" ? tariff.delivery_sum : null,
            periodMin: typeof tariff?.period_min === "number" ? tariff.period_min : null,
            periodMax: typeof tariff?.period_max === "number" ? tariff.period_max : null,
            office: {
              code: String(target.code),
              name: String(target.name ?? ""),
              address: String(target.address ?? ""),
              city: String(target.city ?? ""),
              cityCode: Number.isFinite(Number(target.city_code)) ? Number(target.city_code) : null,
              postalCode: target.postal_code ? String(target.postal_code) : null,
              workTime: target.work_time ? String(target.work_time) : null,
              type: String(target.type ?? "PVZ"),
            },
          });
        },
        // onReady стреляет после полной загрузки UI (карта + офисы):
        // если не стрельнул — карта не завелась (см. armWatchdog).
        onReady: () => {
          readyRef.current = true;
          if (watchdogRef.current) {
            clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
          }
        },
      });
      instanceRef.current = instance;
      failedRef.current = false;
      setOpening(false);
      armWatchdog();
      instance.open();
    } catch (error) {
      fail(isCdnError(error) ? "cdn" : "init", error);
    }
  };

  return (
    <div className="space-y-3">
      {/* Якорь для popup-виджета (сам виджет рисует модалку поверх страницы). */}
      <div id={rootId} className="cdek-pvz-popup-anchor" aria-hidden="true" />
      {selected ? (
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
            onClick={open}
            disabled={opening}
            className="mt-3 inline-flex h-10 items-center rounded-full bg-bg2 px-4 text-xs font-bold ring-1 ring-line/60 transition-colors hover:text-green disabled:opacity-50"
          >
            {opening ? "Открываем карту…" : "Выбрать другой пункт →"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={opening}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-green px-4 py-3 text-center text-sm font-bold text-bg transition-transform disabled:opacity-60 md:hover:scale-[1.01]"
        >
          <span aria-hidden="true">📍</span>
          {opening ? "Открываем карту…" : "Выбрать пункт выдачи на карте"}
        </button>
      )}
    </div>
  );
}

/* ---------------- Секция карты для страницы доставки ---------------- */

/** Грузит конфиг и показывает карту ПВЗ; без договора/ключа — ничего не рисует. */
export function CdekPvzMapSection({ defaultLocation }: { defaultLocation?: string }) {
  const [config, setConfig] = useState<CdekWidgetConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCdekWidgetConfig()
      .then((cfg) => {
        if (!cancelled) setConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config?.enabled) return null;
  return (
    <section className="mt-12" aria-label="Карта пунктов выдачи СДЭК">
      <h2 className="heading text-3xl sm:text-4xl">Пункты выдачи СДЭК</h2>
      <p className="mt-2 text-sm text-muted">
        Найдите удобный пункт на карте — точный адрес выберете при оформлении заказа.
      </p>
      <div className="mt-5">
        <CdekPvzMap config={config} defaultLocation={defaultLocation} />
      </div>
    </section>
  );
}

/* ---------------- Карта для страницы доставки (встроенная, без выбора) ---------------- */

export function CdekPvzMap({ config, defaultLocation }: { config: CdekWidgetConfig; defaultLocation?: string }) {
  const rootId = `cdek-map-${useId().replace(/:/g, "")}`;
  const [failed, setFailed] = useState(() => !process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim());

  useEffect(() => {
    let instance: CdekWidgetInstance | null = null;
    let cancelled = false;
    const yandexKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ?? "";
    if (!yandexKey) return;
    warmupCdekWidget();
    (async () => {
      try {
        const CDEKWidget = await loadCdekWidget();
        if (cancelled) return;
        instance = new CDEKWidget({
          ...baseOptions(config, yandexKey),
          root: rootId,
          popup: false,
          canChoose: false,
          goods: [
            {
              length: config.package.length,
              width: config.package.width,
              height: config.package.height,
              weight: 500,
            },
          ],
          defaultLocation: defaultLocation?.trim() || config.from.city,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      try {
        instance?.destroy();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId]);

  if (failed) {
    return (
      <div className="rounded-3xl bg-card p-6 text-sm text-muted ring-1 ring-line/60">
        Карта пунктов выдачи СДЭК временно недоступна. Актуальный список адресов — на сайте СДЭК и в чекауте при
        оформлении заказа.
      </div>
    );
  }
  // Виджет требует заданную высоту контейнера, иначе схлопнется в ноль.
  return (
    <div className="overflow-hidden rounded-3xl ring-1 ring-line/60">
      <div id={rootId} className="h-[520px] w-full bg-bg2 sm:h-[600px]" role="application" aria-label="Карта пунктов выдачи СДЭК" />
    </div>
  );
}
