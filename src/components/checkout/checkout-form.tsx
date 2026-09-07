"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCart } from "@/components/cart/cart-context";
import { DELIVERY_METHODS } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";

export function CheckoutForm({ onlinePayment }: { onlinePayment: boolean }) {
  const { items, hydrated, subtotal, clear } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    deliveryMethod: DELIVERY_METHODS[0].id,
    address: "",
    comment: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const delivery = DELIVERY_METHODS.find((d) => d.id === form.deliveryMethod)!;
  const deliveryCost = delivery.cost;
  const total = subtotal + (deliveryCost ?? 0);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variantName: i.variantName })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось оформить заказ");
      clear();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        router.push(`/order/${encodeURIComponent(data.orderNumber)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка. Попробуйте ещё раз.");
      setLoading(false);
    }
  };

  if (!hydrated) return <div className="mt-10 h-60 animate-pulse rounded-3xl bg-card" />;

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-line p-10 text-center">
        <div className="heading text-2xl">Корзина пуста</div>
        <Link href="/catalog" className="mt-6 inline-flex h-12 items-center rounded-full bg-fg px-6 text-sm font-bold text-bg">
          В каталог →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-8 md:grid-cols-[1fr_360px] md:items-start">
      <div className="space-y-8">
        <Fieldset title="Контакты">
          <Input label="Имя" required value={form.name} onChange={set("name")} autoComplete="name" />
          <Input label="Телефон" required type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" placeholder="+7 900 000-00-00" />
          <Input label="E-mail" required type="email" value={form.email} onChange={set("email")} autoComplete="email" inputMode="email" />
        </Fieldset>

        <Fieldset title="Доставка">
          <Input label="Город" required value={form.city} onChange={set("city")} autoComplete="address-level2" />
          <div className="grid gap-2 sm:grid-cols-2">
            {DELIVERY_METHODS.map((d) => (
              <label
                key={d.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 transition-colors",
                  form.deliveryMethod === d.id ? "bg-bg2 ring-green" : "bg-bg2/40 ring-line/60 hover:ring-line"
                )}
              >
                <input
                  type="radio"
                  name="delivery"
                  value={d.id}
                  checked={form.deliveryMethod === d.id}
                  onChange={() => setForm((f) => ({ ...f, deliveryMethod: d.id }))}
                  className="mt-1 accent-[#8FCB81]"
                />
                <span className="flex-1">
                  <span className="block text-sm font-bold">{d.name}</span>
                  <span className="block text-xs text-muted">{d.description}</span>
                </span>
                <span className="text-sm font-bold">{d.cost === null ? "—" : d.cost === 0 ? "0 ₽" : formatPrice(d.cost)}</span>
              </label>
            ))}
          </div>
          {delivery.needsAddress && (
            <Input label={delivery.addressLabel} required value={form.address} onChange={set("address")} autoComplete="street-address" />
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Комментарий</span>
            <textarea
              value={form.comment}
              onChange={set("comment")}
              rows={2}
              className="w-full rounded-2xl bg-bg2 px-4 py-3 text-base outline-none ring-1 ring-line/60 focus:ring-green"
            />
          </label>
        </Fieldset>
      </div>

      <aside className="rounded-3xl bg-card p-5 ring-1 ring-line/60 sm:p-6 md:sticky md:top-24">
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={`${it.productId}-${it.variantName ?? "default"}`} className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-bg2">
                {it.imageUrl && <Image src={it.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{it.name}</div>
                {it.variantName && <div className="text-xs text-muted">Цвет: {it.variantName}</div>}
                <div className="text-xs text-muted">{it.quantity} × {formatPrice(it.price)}</div>
              </div>
              <div className="text-sm font-bold">{formatPrice(it.price * it.quantity)}</div>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
          <Row label="Товары" value={formatPrice(subtotal)} />
          <Row label="Доставка" value={deliveryCost === null ? "рассчитаем" : deliveryCost === 0 ? "0 ₽" : formatPrice(deliveryCost)} />
          <div className="flex items-baseline justify-between pt-2">
            <span className="text-base font-bold">Итого</span>
            <span className="text-2xl font-extrabold tracking-tight">{formatPrice(total)}</span>
          </div>
        </div>

        {error && <div className="mt-4 rounded-2xl bg-pink/10 px-4 py-3 text-sm text-pink">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-green text-sm font-bold uppercase tracking-wider text-bg transition-transform disabled:opacity-60 md:hover:scale-[1.02]"
        >
          {loading ? "Оформляем…" : "Оплатить заказ"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          {onlinePayment
            ? "После нажатия вы перейдёте на защищённую страницу оплаты ЮKassa."
            : "Онлайн-оплата пока подключается. Заказ будет принят, и мы свяжемся с вами для оплаты."}
        </p>
      </aside>
    </form>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-3xl bg-card p-5 ring-1 ring-line/60 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="heading mb-4 text-2xl">{title}</div>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
        {props.required && <span className="text-green"> *</span>}
      </span>
      <input
        {...props}
        className="h-13 min-h-12 w-full rounded-2xl bg-bg2 px-4 text-base outline-none ring-1 ring-line/60 focus:ring-green"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  );
}
