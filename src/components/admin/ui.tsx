import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="heading text-3xl">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl bg-card p-5 ring-1 ring-line/60 sm:p-6", className)}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-12 w-full rounded-xl bg-bg2 px-3.5 text-base outline-none ring-1 ring-line/60 focus:ring-green disabled:opacity-50";
export const textareaCls =
  "w-full rounded-xl bg-bg2 px-3.5 py-3 text-base outline-none ring-1 ring-line/60 focus:ring-green";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(textareaCls, props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, "appearance-none", props.className)} />;
}

export function Checkbox({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-bg2 px-3.5 ring-1 ring-line/60">
      <input type="checkbox" {...props} className="h-5 w-5 accent-[#8FCB81]" />
      <span className="text-sm font-semibold">{label}</span>
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: { variant?: "primary" | "ghost" | "danger" | "green" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-colors disabled:opacity-50",
        variant === "primary" && "bg-fg text-bg hover:bg-green",
        variant === "green" && "bg-green text-bg hover:bg-fg",
        variant === "ghost" && "bg-bg2 text-fg ring-1 ring-line/60 hover:ring-line",
        variant === "danger" && "bg-pink/10 text-pink hover:bg-pink/20",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "green" | "pink" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
        tone === "green" && "bg-green/15 text-green",
        tone === "pink" && "bg-pink/15 text-pink",
        tone === "muted" && "bg-bg2 text-muted"
      )}
    >
      {children}
    </span>
  );
}
