"use client";

import { useState } from "react";
import { runCdekDiagnosticsAction } from "@/lib/admin-actions";
import type { CdekDiagnosticsReport, CdekDiagnosticStatus, CdekDiagnosticStep } from "@/lib/delivery/cdek-diagnostics";

const STATUS_META: Record<CdekDiagnosticStatus, { icon: string; label: string; box: string; text: string }> = {
  ok: { icon: "✅", label: "OK", box: "ring-green/25 bg-green/5", text: "text-green" },
  warn: { icon: "⚠️", label: "Внимание", box: "ring-amber-400/30 bg-amber-400/5", text: "text-amber-500" },
  error: { icon: "❌", label: "Ошибка", box: "ring-pink/30 bg-pink/5", text: "text-pink" },
  skipped: { icon: "⏭️", label: "Пропущено", box: "ring-line/40 bg-bg2/40", text: "text-muted" },
};

const VERDICT_LABEL: Record<CdekDiagnosticsReport["verdict"], string> = {
  live: "Живой тариф СДЭК работает",
  fallback: "Работает стандартный тариф 300 ₽ (живой выключен)",
  unreachable: "API СДЭК настроен, но недоступен — работает стандартный тариф 300 ₽",
};

export function CdekDiagnosticsButton() {
  const [city, setCity] = useState("Москва");
  const [report, setReport] = useState<CdekDiagnosticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    setReport(null);
    setError(null);
    try {
      const res = await runCdekDiagnosticsAction(city);
      if (res.report) setReport(res.report);
      else setError(res.message ?? "Диагностика не удалась");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить диагностику");
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
          aria-label="Город получателя для диагностики СДЭК"
          className="h-9 min-w-0 flex-1 rounded-xl bg-bg2 px-3 text-sm outline-none ring-1 ring-line/60 focus:ring-green"
        />
        <button
          type="button"
          onClick={runDiagnostics}
          disabled={loading}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-bg2 px-3 text-xs font-bold ring-1 ring-line/60 transition-colors hover:bg-card hover:text-green disabled:opacity-50"
        >
          {loading ? "Проверяем цепочку…" : "🩺 Диагностика СДЭК"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-pink/10 p-3 text-xs leading-relaxed text-pink ring-1 ring-pink/20">
          <span className="font-bold">⚠️ Диагностика: </span>
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-2 rounded-xl p-3 text-xs leading-relaxed ring-1 ring-line/50">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={`font-bold ${report.ok ? "text-green" : "text-pink"}`}>
              {report.ok ? "✅ " : "⚠️ "}
              {VERDICT_LABEL[report.verdict]}
            </span>
            <span className="text-muted">
              {report.testCity} · {new Date(report.checkedAt).toLocaleString("ru-RU")} · {report.totalMs} мс
            </span>
          </div>

          <ol className="space-y-2">
            {report.steps.map((step) => (
              <DiagnosticStep key={step.id} step={step} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function DiagnosticStep({ step }: { step: CdekDiagnosticStep }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[step.status];
  return (
    <li className={`rounded-lg p-2.5 ring-1 ${meta.box}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold">
          {meta.icon} {step.title}
          <span className={`ml-1.5 font-normal ${meta.text}`}>({meta.label})</span>
        </span>
        {step.durationMs > 0 && <span className="shrink-0 text-muted">{step.durationMs} мс</span>}
      </div>
      <p className="mt-1">{step.message}</p>
      {step.hint && <p className="mt-1 text-muted">💡 {step.hint}</p>}
      {step.details.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1 font-semibold text-muted underline underline-offset-2 hover:text-green"
          >
            {open ? "Скрыть параметры" : "Показать параметры"}
          </button>
          {open && (
            <dl className="mt-1.5 grid gap-1">
              {step.details.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="uppercase tracking-wider text-muted">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </li>
  );
}
