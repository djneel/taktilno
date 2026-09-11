import { db } from "@/db";
import { products } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getProcessImages, getSettings } from "@/lib/data";
import { SETTING_KEYS } from "@/lib/constants";
import { saveSettingsAction } from "@/lib/admin-actions";
import { Button, Card, Field, Input, PageTitle, Select } from "@/components/admin/ui";
import { ImageUrlField } from "@/components/admin/image-url-field";
import { PochtaTestButton } from "@/components/admin/pochta-test-button";
import { getRussianPostConfig, isOtpravkaConfigured } from "@/lib/delivery/russian-post";

const STEPS = ["01 — Идея", "02 — 3D-модель", "03 — Печать", "04 — Сборка", "05 — ТАКТИЛЬНО"];

export default async function AdminSettingsPage() {
  const [s, list] = await Promise.all([getSettings(), db.query.products.findMany({ orderBy: [asc(products.name)] })]);
  const process = getProcessImages(s);

  return (
    <>
      <PageTitle title="Настройки сайта" />
      <form action={saveSettingsAction} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-lg font-bold">Первый экран (Hero)</h2>
          <p className="mb-4 text-sm text-muted">По умолчанию показывается главное фото выбранного товара. Можно загрузить отдельное изображение.</p>
          <div className="grid gap-4">
            <Field label="Товар в Hero">
              <Select name={SETTING_KEYS.heroProductSlug} defaultValue={s[SETTING_KEYS.heroProductSlug] ?? ""}>
                <option value="">— первый из хитов —</option>
                {list.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
              </Select>
            </Field>
            <ImageUrlField name={SETTING_KEYS.heroImageUrl} label="Отдельное изображение для Hero (необязательно)" defaultValue={s[SETTING_KEYS.heroImageUrl] ?? ""} hint="Пусто — используется главное фото товара" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-bold">Блок «Рассмотри его» (360°)</h2>
          <p className="mb-4 text-sm text-muted">Используются кадры товара с типом «Кадр 360°», иначе — ракурсы спереди/сбоку/сзади.</p>
          <Field label="Товар">
            <Select name={SETTING_KEYS.viewerProductSlug} defaultValue={s[SETTING_KEYS.viewerProductSlug] ?? ""}>
              <option value="">— автоматически —</option>
              {list.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
            </Select>
          </Field>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Блок про тактильность</h2>
          <ImageUrlField name={SETTING_KEYS.tactileImageUrl} label="Макро-фото" defaultValue={s[SETTING_KEYS.tactileImageUrl] ?? ""} />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Контакты</h2>
          <div className="grid gap-3">
            <Field label="Telegram (ссылка)"><Input name={SETTING_KEYS.contactTelegram} defaultValue={s[SETTING_KEYS.contactTelegram] ?? ""} placeholder="https://t.me/…" /></Field>
            <Field label="VK (ссылка)"><Input name={SETTING_KEYS.contactVk} defaultValue={s[SETTING_KEYS.contactVk] ?? ""} placeholder="https://vk.com/…" /></Field>
            <Field label="E-mail"><Input name={SETTING_KEYS.contactEmail} defaultValue={s[SETTING_KEYS.contactEmail] ?? ""} /></Field>
            <Field label="Телефон"><Input name={SETTING_KEYS.contactPhone} defaultValue={s[SETTING_KEYS.contactPhone] ?? ""} /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-bold">Почта России</h2>
          <p className="mb-4 text-sm text-muted">
            Тариф считается по индексу получателя. Настройки — через переменные окружения на хостинге (см.
            DEPLOY.md).
          </p>
          <PochtaStatus />
          <div className="mt-4">
            <PochtaTestButton />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">«От идеи до фигурки» — фото этапов</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {STEPS.map((label, i) => (
              <ImageUrlField key={i} name={`process_${i}`} label={label} defaultValue={process[i] ?? ""} />
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" variant="green" className="h-12 px-8">Сохранить настройки</Button>
        </div>
      </form>
    </>
  );
}

function PochtaStatus() {
  const config = getRussianPostConfig();
  const otpravka = isOtpravkaConfigured();
  const rows: [string, string][] = [
    ["Индекс отправления", config.fromIndex],
    ["Объект тарификации", config.tariffObject],
    ["Вес изделия / упаковки", `${config.defaultItemWeightG} г / ${config.packagingWeightG} г`],
    ["API «Отправка»", otpravka ? "подключена (тарифы по договору)" : "не настроена (публичный тариф)"],
  ];
  return (
    <dl className="grid gap-2 rounded-2xl bg-bg2/60 p-4 text-sm ring-1 ring-line/60">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3">
          <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
          <dd className="text-right font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
