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
  "Фиолетовый",
  "Зелёный",
  "Синий",
  "Розовый",
  "Серый",
  "Коричневый",
  "Чёрный",
  "Сине-фиолетовый",
] as const;

export function ImageManager({ productId, images: initial }: { productId: number; images: ProductImage[] }) {
  const [images, setImages] = useState(initial);
  const [kind, setKind] = useState<ImageKind>("detail");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const refresh = () => router.refresh();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      fd.append("productId", String(productId)); fd.append("kind", kind);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      refresh();
      const now = new Date();
      setImages((prev) => [...prev, ...data.files.map((f: { url: string; mediaId: number; imageId: number }, i: number): ProductImage => ({ id: f.imageId, productId, url: f.url, kind: prev.length === 0 && i === 0 ? "main" : kind, alt: "", colorVariant: null, sortOrder: prev.length + i, mediaId: f.mediaId, createdAt: now }))]);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...images], j = index + dir; if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]]; setImages(next);
    start(async () => { await reorderImagesAction({ productId, ids: next.map((i) => i.id) }); refresh(); });
  };

  const setMain = (id: number) => {
    setImages((prev) => { const target = prev.find((i) => i.id === id)!; const rest = prev.filter((i) => i.id !== id).map((i) => i.kind === "main" ? { ...i, kind: "front" as ImageKind } : i); return [{ ...target, kind: "main" as ImageKind }, ...rest]; });
    start(async () => { await setMainImageAction({ productId, imageId: id }); refresh(); });
  };

  const changeKind = (id: number, k: ImageKind) => {
    setImages((prev) => prev.map((i) => i.id === id ? { ...i, kind: k } : i));
    start(async () => { await updateImageAction({ id, kind: k }); refresh(); });
  };

  const changeColor = (id: number, color: string) => {
    const colorVariant = color || null;
    setImages((prev) => prev.map((i) => i.id === id ? { ...i, colorVariant } : i));
    start(async () => { await updateImageAction({ id, colorVariant }); refresh(); });
  };

  const changeAlt = (id: number, alt: string) => setImages((prev) => prev.map((i) => i.id === id ? { ...i, alt } : i));
  const saveAlt = (id: number, alt: string) => { start(async () => { await updateImageAction({ id, alt }); }); };
  const remove = (id: number) => {
    if (!confirm("Удалить фото?")) return;
    setImages((prev) => prev.filter((i) => i.id !== id));
    start(async () => { await deleteImageAction({ id }); refresh(); });
  };

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line p-4 sm:flex-row sm:items-center">
      <div className="flex-1"><div className="text-sm font-bold">Загрузить фотографии</div><div className="text-xs text-muted">JPG, PNG, WebP до 10 МБ. Можно выбрать несколько. После загрузки назначьте каждой фотографии цвет.</div></div>
      <select value={kind} onChange={(e) => setKind(e.target.value as ImageKind)} className="h-11 rounded-xl bg-bg2 px-3 text-sm ring-1 ring-line/60 outline-none" aria-label="Тип загружаемых фото">
        {IMAGE_KINDS.map((k) => <option key={k} value={k}>{IMAGE_KIND_LABELS[k]}</option>)}
      </select>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <Button type="button" variant="green" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Загружаем…" : "Выбрать файлы"}</Button>
    </div>
    {error && <div className="rounded-xl bg-pink/10 px-4 py-2 text-sm text-pink">{error}</div>}
    {images.length === 0 ? <p className="text-sm text-muted">Фотографий пока нет.</p> : <ul className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", pending && "opacity-70")}>
      {images.map((img, i) => <li key={img.id} className="overflow-hidden rounded-2xl bg-bg2 ring-1 ring-line/60">
        <div className="relative aspect-square"><Image src={img.url} alt={img.alt} fill sizes="300px" className="object-cover" />{img.kind === "main" && <span className="absolute left-2 top-2 rounded-full bg-green px-2 py-0.5 text-[10px] font-bold uppercase text-bg">Главное</span>}<span className="absolute right-2 top-2 rounded-full bg-bg/70 px-2 py-0.5 text-[10px] font-bold text-fg">{i + 1}</span></div>
        <div className="space-y-2 p-3">
          <select value={img.colorVariant ?? ""} onChange={(e) => changeColor(img.id, e.target.value)} className="h-10 w-full rounded-lg bg-card px-2 text-sm font-semibold ring-1 ring-line/60 outline-none" aria-label="Цвет фотографии"><option value="">Общее фото — не привязано к цвету</option>{COLOR_OPTIONS.map((color) => <option key={color} value={color}>{color}</option>)}</select>
          <select value={img.kind} onChange={(e) => changeKind(img.id, e.target.value as ImageKind)} className="h-10 w-full rounded-lg bg-card px-2 text-sm ring-1 ring-line/60 outline-none" aria-label="Тип фото">{IMAGE_KINDS.map((k) => <option key={k} value={k}>{IMAGE_KIND_LABELS[k]}</option>)}</select>
          <input value={img.alt} onChange={(e) => changeAlt(img.id, e.target.value)} onBlur={(e) => saveAlt(img.id, e.target.value)} placeholder="Alt-текст (SEO)" className="h-10 w-full rounded-lg bg-card px-2 text-sm ring-1 ring-line/60 outline-none" />
          <div className="flex flex-wrap gap-1.5">
            {img.kind !== "main" && <button type="button" onClick={() => setMain(img.id)} className="h-9 rounded-full bg-card px-3 text-xs font-bold ring-1 ring-line/60 hover:text-green">Сделать главным</button>}
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="h-9 w-9 rounded-full bg-card text-sm ring-1 ring-line/60 disabled:opacity-30" aria-label="Выше">←</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="h-9 w-9 rounded-full bg-card text-sm ring-1 ring-line/60 disabled:opacity-30" aria-label="Ниже">→</button>
            <button type="button" onClick={() => remove(img.id)} className="ml-auto h-9 rounded-full bg-pink/10 px-3 text-xs font-bold text-pink">Удалить</button>
          </div>
        </div>
      </li>)}
    </ul>}
  </div>;
}
