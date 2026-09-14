"use client";

import { useEffect, useState } from "react";

import type { RussianPostOffice } from "@/lib/delivery/russian-post";

type OfficeResponse = {
  ok?: boolean;
  office?: RussianPostOffice | null;
};

/** Отделение Почты по индексу: дебаунс, отмена устаревших запросов. Ошибки немые. */
function usePostOffice(postcode: string) {
  const [office, setOffice] = useState<RussianPostOffice | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Короткий индекс — запрос не шлём (карточка всё равно скрыта).
    if (postcode.replace(/\D/g, "").length !== 6) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setOffice(null);
      try {
        const res = await fetch(`/api/delivery/russian-post/office?index=${encodeURIComponent(postcode.trim())}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as OfficeResponse | null;
        if (!cancelled) setOffice(data?.ok ? (data.office ?? null) : null);
      } catch {
        if (!cancelled) setOffice(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [postcode]);

  return { office, loading };
}

/**
 * Карточка «Ваше отделение» под полем индекса. Чисто информационная:
 * при любой проблеме (нет ключа, нет отделения, сеть) молча прячется,
 * чекаут работает как раньше.
 */
export function RussianPostOfficeInfo({ postcode }: { postcode: string }) {
  const { office, loading } = usePostOffice(postcode);

  if (postcode.replace(/\D/g, "").length !== 6) return null;
  if (loading && !office) {
    return (
      <div
        className="h-20 animate-pulse rounded-2xl bg-bg2/60 ring-1 ring-line/60"
        aria-label="Загрузка отделения"
      />
    );
  }
  if (!office) return null;

  return (
    <div className="rounded-2xl bg-green/10 p-4 ring-1 ring-green/30" role="note">
      <div className="text-xs font-bold uppercase tracking-wider text-green">Ваше отделение Почты России</div>
      <div className="mt-1 font-bold">{office.address}</div>
      <div className="mt-1 text-xs text-muted">
        Индекс {office.postcode}
        {office.workTime ? ` · ${office.workTime}` : ""}
      </div>
      {office.isClosed && (
        <div className="mt-1 text-xs font-bold text-pink">
          Отделение временно закрыто — уточните выдачу на сайте Почты России.
        </div>
      )}
    </div>
  );
}
