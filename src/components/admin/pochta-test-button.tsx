"use client";

import { useState } from "react";
import { testRussianPostAction } from "@/lib/admin-actions";

export function PochtaTestButton() {
  const [postcode, setPostcode] = useState("101000");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await testRussianPostAction(postcode);
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
          value={postcode}
          onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          placeholder="101000"
          aria-label="Тестовый индекс получателя"
          className="h-9 w-28 rounded-xl bg-bg2 px-3 text-sm outline-none ring-1 ring-line/60 focus:ring-green"
        />
        <button
          type="button"
          onClick={runTest}
          disabled={loading}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-xl bg-bg2 px-3 text-xs font-bold ring-1 ring-line/60 transition-colors hover:bg-card hover:text-green disabled:opacity-50"
        >
          {loading ? "Считаем тариф…" : "📦 Проверить тариф Почты"}
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
