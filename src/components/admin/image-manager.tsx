"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ImageKind, ProductImage } from "@/db/schema";
import { IMAGE_KINDS } from "@/db/schema";
import { IMAGE_KIND_LABELS } from "@/lib/constants";
import { deleteImageAction, reorderImagesAction, setMainImageAction, updateImageAction } from "@/lib/admin-actions";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS = [
  "Синий",
  "Зелёный",
  "Розовый",
  "Красный",
  "Жёлтый",
  "Серый",
  "Коричневый",
  "Чёрный",
  "Сине-фиолетовый",
] as const;

const MAX_BATCH_FILES = 6;
const MAX_BATCH_BYTES = 3.5 * 1024 * 1024; // 3.5 МБ

type UploadProgress = {
  totalFiles: number;
  uploadedFiles: number;
  totalBatches: number;
  currentBatch: number;
  percent: number;
};

export function ImageManager({ productId, images: initial }: { productId: number; images: ProductImage[] }) {
  const [images, setImages] = useState(initial);
  const [kind, setKind] = useState<ImageKind>("detail");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const refresh = () => router.refresh();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const fileList = Array.from(files);
    setUploading(true);
    setError(null);

    // Разбиение файлов на пакеты: до 3.5 МБ и не более 6 файлов в пакете
    const batches: File[][] = [];
    let currentBatch: File[] = [];
    let currentBatchBytes = 0;

    for (const file of fileList) {
      const wouldExceedCount = currentBatch.length >= MAX_BATCH_FILES;
      const wouldExceedBytes = currentBatch.length > 0 && currentBatchBytes + file.size > MAX_BATCH_BYTES;

      if (wouldExceedCount || wouldExceedBytes) {
        batches.push(currentBatch);
        currentBatch = [file];
        currentBatchBytes = file.size;
      } else {
        currentBatch.push(file);
        currentBatchBytes += file.size;
      }
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    setProgress({
      totalFiles: fileList.length,
      uploadedFiles: 0,
      totalBatches: batches.length,
      currentBatch: 1,
      percent: 0,
    });

    let totalUploaded = 0;
    try {
      for (let bIndex = 0; bIndex < batches.length; bIndex++) {
        const batch = batches[bIndex];
        setProgress({
          totalFiles: fileList.length,
          uploadedFiles: totalUploaded,
          totalBatches: batches.length,
          currentBatch: bIndex + 1,
          percent: Math.round((totalUploaded / fileList.length) * 100),
        });

        const fd = new FormData();
        batch.forEach((f) => fd.append("files", f));
        fd.append("productId", String(productId));
        fd.append("kind", kind);

        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Ошибка загрузки пакета ${bIndex + 1}`);
        }

        const now = new Date();
        setImages((prev) => [
          ...prev,
          ...data.files.map(
            (f: { url: string; mediaId: number; imageId: number }, i: number): ProductImage => ({
              id: f.imageId,
              productId,
              url: f.url,
              kind: prev.length === 0 && i === 0 ? "main" : kind,
              alt: "",
              colorVariant: null,
              sortOrder: prev.length + i,
              mediaId: f.mediaId,
              createdAt: now,
            })
          ),
        ]);

        totalUploaded += batch.length;
        setProgress({
          totalFiles: fileList.length,
          uploadedFiles: totalUploaded,
          totalBatches: batches.length,
          currentBatch: bIndex + 1,
          percent: Math.round((totalUploaded / fileList.length) * 100),
        });
      }
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...images], j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setImages(next);
    start(async () => {
      await reorderImagesAction({ productId, ids: next.map((i) => i.id) });
      refresh();
    });
  };

  const setMain = (id: number) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id)!;
      const rest = prev.filter((i) => i.id !== id).map((i) => (i.kind === "main" ? { ...i, kind: "front" as ImageKind } : i));
      return [{ ...target, kind: "main" as ImageKind }, ...rest];
    });
    start(async () => {
      await setMainImageAction({ productId, imageId: id });
      refresh();
    });
  };

  const changeKind = (id: number, k: ImageKind) => {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, kind: k } : i)));
    start(async () => {
      await updateImageAction({ id, kind: k });
      refresh();
    });
  };

  const changeColor = (id: number, color: string) => {
    const colorVariant = color || null;
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, colorVariant } : i)));
    start(async () => {
      await updateImageAction({ id, colorVariant });
      refresh();
    });
  };

  const changeAlt = (id: number, alt: string) =>
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, alt } : i)));

  const saveAlt = (id: number, alt: string) => {
    start(async () => {
      await updateImageAction({ id, alt });
    });
  };

  const remove = (id: number) => {
    if (!confirm("Удалить фото?")) return;
    setImages((prev) => prev.filter((i) => i.id !== id));
    start(async () => {
      await deleteImageAction({ id });
      refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Панель загрузки с поддержкой выбора 10–15+ фото и пакетной загрузкой */}
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="text-sm font-bold">Загрузить фотографии</div>
            <div className="text-xs text-muted">
              JPG, PNG, WebP до 10 МБ на файл. Можно выбирать сразу 10–15+ фото (пакеты до 3.5 МБ / 6 файлов с прогрессом).
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ImageKind)}
              className="h-11 rounded-xl bg-bg2 px-3 text-sm ring-1 ring-line/60 outline-none"
              aria-label="Тип загружаемых фото"
            >
              {IMAGE_KINDS.map((k) => (
                <option key={k} value={k}>{IMAGE_KIND_LABELS[k]}</option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => upload(e.target.files)}
            />
            <Button
              type="button"
              variant="green"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Загружаем…" : "Выбрать файлы"}
            </Button>
          </div>
        </div>

        {/* Прогресс-бар пакетной загрузки */}
        {progress && (
          <div className="space-y-1.5 rounded-xl bg-bg2 p-3 ring-1 ring-line/60">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>
                Загрузка: пакет {progress.currentBatch} из {progress.totalBatches} ({progress.uploadedFiles} из {progress.totalFiles} фото)
              </span>
              <span className="font-mono text-green">{progress.percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-card">
              <div
                className="h-full bg-green transition-all duration-300 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {error && <div className="rounded-xl bg-pink/10 px-4 py-2 text-sm text-pink">{error}</div>}

      {/* Шапка блока с индикатором и счётчиком */}
      <div className="flex items-center justify-between border-b border-line/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Фотографии товара</span>
          <span className="inline-flex items-center rounded-full bg-bg2 px-2.5 py-0.5 text-xs font-bold text-fg ring-1 ring-line/60">
            {images.length}
          </span>
        </div>
        {images.length > 0 && (
          <span className="text-xs text-muted">
            {images.some((i) => i.kind === "main") ? "★ Главное фото назначено" : "⚠️ Главное фото не выбрано"}
          </span>
        )}
      </div>

      {/* Список изображений с внутренней прокруткой и плитками одинаковой высоты */}
      {images.length === 0 ? (
        <p className="text-sm text-muted">Фотографий пока нет.</p>
      ) : (
        <div className="max-h-[620px] overflow-y-auto overscroll-contain pr-1 focus:outline-none">
          <ul className={cn("grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3", pending && "opacity-70")}>
            {images.map((img, i) => (
              <li
                key={img.id}
                className="flex h-full flex-col overflow-hidden rounded-2xl bg-bg2 ring-1 ring-line/60"
              >
                <div className="relative aspect-square w-full shrink-0 bg-card/40">
                  <Image
                    src={img.url}
                    alt={img.alt || ""}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover"
                  />
                  {img.kind === "main" && (
                    <span className="absolute left-2 top-2 rounded-full bg-green px-2 py-0.5 text-[10px] font-bold uppercase text-bg shadow-sm">
                      Главное
                    </span>
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-bg/80 px-2 py-0.5 text-[10px] font-bold text-fg backdrop-blur-sm">
                    {i + 1}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                  <div className="space-y-2">
                    <select
                      value={img.colorVariant ?? ""}
                      onChange={(e) => changeColor(img.id, e.target.value)}
                      className="h-9 w-full rounded-lg bg-card px-2 text-xs font-semibold ring-1 ring-line/60 outline-none"
                      aria-label="Цвет фотографии"
                    >
                      <option value="">Общее фото — не привязано к цвету</option>
                      {COLOR_OPTIONS.map((color) => (
                        <option key={color} value={color}>{color}</option>
                      ))}
                    </select>
                    <select
                      value={img.kind}
                      onChange={(e) => changeKind(img.id, e.target.value as ImageKind)}
                      className="h-9 w-full rounded-lg bg-card px-2 text-xs ring-1 ring-line/60 outline-none"
                      aria-label="Тип фото"
                    >
                      {IMAGE_KINDS.map((k) => (
                        <option key={k} value={k}>{IMAGE_KIND_LABELS[k]}</option>
                      ))}
                    </select>
                    <input
                      value={img.alt}
                      onChange={(e) => changeAlt(img.id, e.target.value)}
                      onBlur={(e) => saveAlt(img.id, e.target.value)}
                      placeholder="Alt-текст (SEO)"
                      className="h-9 w-full rounded-lg bg-card px-2 text-xs ring-1 ring-line/60 outline-none"
                    />
                  </div>

                  {/* Кнопки-иконки ★ ← → ✕ в одну строку */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setMain(img.id)}
                      disabled={img.kind === "main"}
                      title={img.kind === "main" ? "Главное фото" : "Сделать главным"}
                      aria-label="Сделать главным"
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg text-sm font-bold ring-1 transition-colors",
                        img.kind === "main"
                          ? "bg-green text-bg ring-green"
                          : "bg-card text-muted ring-line/60 hover:bg-card/80 hover:text-green"
                      )}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      title="Переместить назад"
                      aria-label="Переместить назад"
                      className="flex h-9 items-center justify-center rounded-lg bg-card text-sm ring-1 ring-line/60 hover:bg-card/80 disabled:pointer-events-none disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === images.length - 1}
                      title="Переместить вперед"
                      aria-label="Переместить вперед"
                      className="flex h-9 items-center justify-center rounded-lg bg-card text-sm ring-1 ring-line/60 hover:bg-card/80 disabled:pointer-events-none disabled:opacity-30"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(img.id)}
                      title="Удалить фото"
                      aria-label="Удалить фото"
                      className="flex h-9 items-center justify-center rounded-lg bg-pink/10 text-sm font-bold text-pink ring-1 ring-pink/20 hover:bg-pink/20"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
