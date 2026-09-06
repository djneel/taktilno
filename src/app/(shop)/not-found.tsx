import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <h1 className="heading text-7xl sm:text-9xl">404</h1>
      <p className="mt-4 text-muted">Такой страницы нет. Зато есть фигурки.</p>
      <Link href="/catalog" className="mt-8 inline-flex h-12 items-center rounded-full bg-fg px-6 text-sm font-bold text-bg">
        В каталог →
      </Link>
    </div>
  );
}
