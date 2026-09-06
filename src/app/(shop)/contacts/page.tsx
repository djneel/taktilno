import type { Metadata } from "next";
import { getSettings } from "@/lib/data";
import { SETTING_KEYS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Связаться с ТАКТИЛЬНО: Telegram, VK, e-mail.",
  alternates: { canonical: "/contacts" },
};

export default async function ContactsPage() {
  const s = await getSettings();
  const items = [
    { label: "Telegram", value: s[SETTING_KEYS.contactTelegram], href: s[SETTING_KEYS.contactTelegram] },
    { label: "VK", value: s[SETTING_KEYS.contactVk], href: s[SETTING_KEYS.contactVk] },
    { label: "E-mail", value: s[SETTING_KEYS.contactEmail], href: s[SETTING_KEYS.contactEmail] ? `mailto:${s[SETTING_KEYS.contactEmail]}` : "" },
    { label: "Телефон", value: s[SETTING_KEYS.contactPhone], href: s[SETTING_KEYS.contactPhone] ? `tel:${s[SETTING_KEYS.contactPhone]}` : "" },
  ].filter((i) => i.value);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 md:pt-14 lg:px-8">
      <h1 className="heading text-5xl sm:text-6xl lg:text-7xl">
        Напиши нам<span className="text-pink">.</span>
      </h1>
      <p className="mt-3 max-w-md text-muted">Вопросы по заказу, индивидуальные фигурки, сотрудничество — отвечаем быстро.</p>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.label}>
            <a href={i.href} target={i.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="group block rounded-3xl bg-card p-6 ring-1 ring-line/60 transition-colors md:hover:ring-green">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{i.label}</div>
              <div className="mt-2 break-all text-lg font-bold group-hover:text-green">{i.value.replace(/^https?:\/\//, "")}</div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
