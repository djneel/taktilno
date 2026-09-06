"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/admin-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="mt-6 space-y-3">
      <input
        type="password"
        name="password"
        required
        autoFocus
        placeholder="Пароль"
        className="h-13 min-h-12 w-full rounded-2xl bg-bg2 px-4 text-base outline-none ring-1 ring-line/60 focus:ring-green"
      />
      {state?.error && <div className="text-sm text-pink">{state.error}</div>}
      <button type="submit" disabled={pending} className="h-12 w-full rounded-full bg-fg text-sm font-bold text-bg disabled:opacity-60">
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
