import type { ReactNode } from "react";

export const metadata = { title: "Админ-панель — ТАКТИЛЬНО", robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
