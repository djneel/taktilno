import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CartProvider } from "@/components/cart/cart-context";
import { SITE_URL } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ТАКТИЛЬНО — 3D-фигурки, которые хочется трогать",
    template: "%s — ТАКТИЛЬНО",
  },
  description: "Подвижные 3D-фигурки, антистрессы и необычные подарки. Магазин ТАКТИЛЬНО.",
  applicationName: "ТАКТИЛЬНО",
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: "ТАКТИЛЬНО",
    locale: "ru_RU",
    title: "ТАКТИЛЬНО — 3D-фигурки, которые хочется трогать",
    description: "Подвижные 3D-фигурки, антистрессы и необычные подарки. Магазин ТАКТИЛЬНО.",
    images: [{ url: "/images/products/kot-sfinks.jpg", width: 1024, height: 1024 }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0D0F0E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
