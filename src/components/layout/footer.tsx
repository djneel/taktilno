import Link from "next/link";

export function Footer({ telegram, vk }: { telegram?: string; vk?: string }) {
  return (
    <footer className="border-t border-line bg-bg2">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="heading text-2xl">
              ТАКТИЛЬНО<span className="text-green">.</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted">Фигурки, которые хочется трогать.</p>
          </div>
          <FooterCol
            title="Магазин"
            links={[
              { href: "/catalog", label: "Каталог" },
              { href: "/catalog?sort=new", label: "Новинки" },
              { href: "/catalog?featured=1", label: "Хиты" },
            ]}
          />
          <FooterCol
            title="Покупателям"
            links={[
              { href: "/delivery", label: "Доставка" },
              { href: "/delivery#payment", label: "Оплата" },
              { href: "/delivery#return", label: "Возврат" },
            ]}
          />
          <FooterCol
            title="Мы в сети"
            links={[
              { href: telegram || "https://t.me/", label: "Telegram", external: true },
              { href: vk || "https://vk.com/", label: "VK", external: true },
            ]}
          />
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 ТАКТИЛЬНО</span>
          <Link href="/admin" className="transition-colors hover:text-fg">
            Вход для администратора
          </Link>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{title}</div>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-1 text-sm transition-colors hover:text-green"
              >
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="inline-block py-1 text-sm transition-colors hover:text-green">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
