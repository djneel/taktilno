import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAction } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[230px_1fr]">
      <aside className="border-b border-line bg-bg2 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:block md:px-5 md:py-6">
          <a href="/admin" className="heading text-lg">
            ТАКТИЛЬНО<span className="text-green">.</span> <span className="text-xs text-muted">admin</span>
          </a>
          <form action={logoutAction} className="md:mt-2">
            <button className="text-xs text-muted hover:text-fg">Выйти</button>
          </form>
        </div>
        <AdminNav />
      </aside>
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
    </div>
  );
}
