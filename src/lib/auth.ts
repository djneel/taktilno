import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Простая авторизация администратора.
 * Пароль задаётся переменной окружения ADMIN_PASSWORD (по умолчанию: taktilno),
 * секрет подписи cookie — ADMIN_SECRET.
 */
export const ADMIN_COOKIE = "taktilno_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 дней

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "taktilno";
}

export function isDefaultPassword() {
  return !process.env.ADMIN_PASSWORD;
}

function secret() {
  return process.env.ADMIN_SECRET || "taktilno-dev-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken() {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expStr, sig] = parts;
  const payload = `${role}.${expStr}`;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  return role === "admin" && Number(expStr) > Date.now();
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

export function checkPassword(input: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(getAdminPassword());
  return a.length === b.length && timingSafeEqual(a, b);
}
