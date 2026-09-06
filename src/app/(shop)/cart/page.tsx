import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Корзина",
  description: "Ваша корзина в магазине ТАКТИЛЬНО.",
  alternates: { canonical: "/cart" },
  robots: { index: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 md:pt-14 lg:px-8">
      <h1 className="heading text-5xl sm:text-6xl">
        Корзина<span className="text-green">.</span>
      </h1>
      <CartView />
    </div>
  );
}
