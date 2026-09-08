"use client";

import { useState } from "react";
import { testTelegramAction } from "@/lib/admin-actions";

export function TelegramTestButton() {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await testTelegramAction();
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
    <div className="mt-4 space-y-2.5 border-t border-line/60 pt-3">
      <button
        type="button"
        onClick={runTest}
        disabled={loading}
        className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-bg2 px-3 text-xs font-bold ring-1 ring-line/60 transition-colors hover:bg-card hover:text-green disabled:opacity-50"
      >
        {loading ? "Отправляем тестовое сообщение…" : "✉️ Проверить Telegram (тест)"}
      </button>

      {status && (
        <div
          className={`rounded-xl p-3 text-xs leading-relaxed ${
            status.ok
              ? "bg-green/10 text-green ring-1 ring-green/20"
              : "bg-pink/10 text-pink ring-1 ring-pink/20"
          }`}
        >
          <span className="font-bold">{status.ok ? "✅ Успех: " : "❌ Ошибка: "}</span>
          {status.message}
        </div>
      )}
    </div>
  );
}
