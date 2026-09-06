import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, isDefaultPassword } from "@/lib/auth";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Вход в админ-панель", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 ring-1 ring-line/60">
        <div className="heading text-2xl">
          ТАКТИЛЬНО<span className="text-green">.</span> <span className="text-muted">admin</span>
        </div>
        <p className="mt-2 text-sm text-muted">Введите пароль администратора.</p>
        <LoginForm />
        {isDefaultPassword() && (
          <p className="mt-6 rounded-2xl bg-bg2 p-3 text-xs text-muted">
            Пароль по умолчанию: <b className="text-fg">taktilno</b>. Задайте свой через переменную окружения{" "}
            <code className="text-green">ADMIN_PASSWORD</code>.
          </p>
        )}
      </div>
    </div>
  );
}
