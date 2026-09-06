"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Frame = { url: string; alt: string };

/**
 * Просмотр 360°.
 * Принимает массив кадров (frame360 из админки или ракурсы товара).
 * Desktop — перетаскивание мышью, mobile — свайп. Один кадр — мягкая анимация.
 *
 * Чтобы подключить настоящее 360°: загрузите в админке для товара
 * 24–36 фото с типом «Кадр 360°» в нужном порядке.
 */
export function Viewer360({ frames, className }: { frames: Frame[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const startX = useRef(0);
  const startIndex = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const total = frames.length;
  const interactive = total > 1;

  const pxPerFrame = useCallback(() => {
    const w = containerRef.current?.clientWidth ?? 400;
    return Math.max(8, w / Math.max(total, 1) / (total > 8 ? 1 : 3));
  }, [total]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    setDragging(true);
    setInteracted(true);
    startX.current = e.clientX;
    startIndex.current = index;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !interactive) return;
    const dx = e.clientX - startX.current;
    const delta = Math.round(dx / pxPerFrame());
    const next = (((startIndex.current + delta) % total) + total) % total;
    setIndex(next);
  };

  const stop = () => setDragging(false);

  // Лёгкий автоповорот, пока пользователь не взаимодействовал
  useEffect(() => {
    if (!interactive || interacted) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), 1400);
    return () => clearInterval(t);
  }, [interactive, interacted, total]);

  if (!total) {
    return (
      <div className={cn("flex aspect-square items-center justify-center rounded-3xl bg-card text-muted", className)}>
        Добавьте фото товара в админ-панели
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-square select-none overflow-hidden rounded-3xl bg-bg2 ring-1 ring-line/60",
        interactive && (dragging ? "cursor-grabbing" : "cursor-grab"),
        className
      )}
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      role={interactive ? "slider" : undefined}
      aria-label={interactive ? "Поворот фигурки" : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? total - 1 : undefined}
      aria-valuenow={interactive ? index : undefined}
    >
      <div className="glow-green absolute inset-[-20%] opacity-70" />
      {frames.map((f, i) => (
        <Image
          key={f.url + i}
          src={f.url}
          alt={f.alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          priority={i === 0}
          draggable={false}
          className={cn(
            "object-cover transition-opacity duration-200",
            i === index ? "opacity-100" : "opacity-0",
            !interactive && "animate-float"
          )}
        />
      ))}

      {interactive && (
        <>
          <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-bg/70 px-4 py-2 text-xs font-semibold text-fg backdrop-blur">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            {interacted ? `${index + 1} / ${total}` : "Потяни, чтобы повернуть"}
          </div>
          <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-green/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-green">
            360°
          </div>
        </>
      )}
    </div>
  );
}
