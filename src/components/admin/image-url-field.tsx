"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/** Поле «URL изображения» с кнопкой загрузки файла через /api/admin/upload */
export function ImageUrlField({ name, label, defaultValue = "", hint }: { name: string; label: string; defaultValue?: string; hint?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      setValue(data.files[0].url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-bg2 ring-1 ring-line/60">
          {value && <Image src={value} alt="" fill sizes="48px" className="object-cover" />}
        </div>
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="/images/… или загрузите файл"
          className="h-12 min-w-0 flex-1 rounded-xl bg-bg2 px-3.5 text-sm outline-none ring-1 ring-line/60 focus:ring-green"
        />
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="h-12 shrink-0 rounded-xl bg-card px-3 text-xs font-bold ring-1 ring-line/60 hover:text-green disabled:opacity-50">
          {busy ? "…" : "Загрузить"}
        </button>
        {value && (
          <button type="button" onClick={() => setValue("")} className="h-12 shrink-0 px-2 text-xs text-muted hover:text-pink" aria-label="Очистить">
            ×
          </button>
        )}
      </div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-pink">{error}</span>}
    </div>
  );
}
