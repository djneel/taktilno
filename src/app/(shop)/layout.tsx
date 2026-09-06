import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartWidgets } from "@/components/cart/cart-widgets";
import { getSettings } from "@/lib/data";
import { SETTING_KEYS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings().catch(() => ({}) as Record<string, string>);
  return (
    <>
      <Header />
      <main className="pt-16">{children}</main>
      <Footer telegram={settings[SETTING_KEYS.contactTelegram]} vk={settings[SETTING_KEYS.contactVk]} />
      <CartWidgets />
    </>
  );
}
