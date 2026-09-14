"use client";

import { useState } from "react";
import { testCdekAction } from "@/lib/admin-actions";

export function CdekTestButton() {
  const [city, setCity] = useState("Москва");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await testCdekAction(city);
      setStatus(res);
    } catch (e) {
      setStatus({
        ok: false,
        message: e instanceof Error ? e.message : "Не удалось выполнить проверку",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={60}
          placeholder="Москва"
          aria-label="Город получателя для проверки тарифа СДЭК"
          className="h-9 min-w-0 flex-1 rounded-xl bg-bg2 px-3 text-sm outline-none ring-1 ring-line/60 focus:ring-green"
        />
        <button
          type="button"
          onClick={runTest}
          disabled={loading}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-bg2 px-3 text-xs font-bold ring-1 ring-line/60 transition-colors hover:bg-card hover:text-green disabled:opacity-50"
        >
          {loading ? "Считаем тариф…" : "🚚 Проверить тариф СДЭК"}
        </button>
      </div>

      {status && (
        <div
          className={`rounded-xl p-3 text-xs leading-relaxed ${
            status.ok
              ? "bg-green/10 text-green ring-1 ring-green/20"
              : "bg-pink/10 text-pink ring-1 ring-pink/20"
          }`}
        >
          <span className="font-bold">{status.ok ? "✅ Тариф посчитан: " : "⚠️ Проверка: "}</span>
          {status.message}
        </div>
      )}
    </div>
  );
}
