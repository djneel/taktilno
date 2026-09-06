import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { isOnlinePaymentEnabled } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Оформление заказа",
  alternates: { canonical: "/checkout" },
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 md:pt-14 lg:px-8">
      <h1 className="heading text-5xl sm:text-6xl">
        Оформление<span className="text-green">.</span>
      </h1>
      <p className="mt-3 text-muted">Без регистрации. Только то, что нужно для доставки.</p>
      <CheckoutForm onlinePayment={isOnlinePaymentEnabled()} />
    </div>
  );
}
