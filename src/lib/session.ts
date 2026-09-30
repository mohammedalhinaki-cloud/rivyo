/**
 * جلسة المستخدم: كوكي HttpOnly موقّع بـ HMAC-SHA256 (بدون أي مكتبات خارجية).
 * لا نستخدم كوكي Grid-side storage — الهوية تُقرأ من قاعدة البيانات في كل طلب.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "rivyo_session";
export const OAUTH_STATE_COOKIE = "rivyo_oauth";
export const AUTH_ERROR_COOKIE = "rivyo_auth_error";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 يومًا

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET غير مضبوط — شغّل npm run keys وضعه في .env.local");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function buildSessionValue(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_SECONDS * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseSessionValue(value: string | undefined | null): { uid: string } | null {
  if (!value) return null;
  try {
    const idx = value.lastIndexOf(".");
    if (idx <= 0) return null;
    const payload = value.slice(0, idx);
    const sig = value.slice(idx + 1);
    const expected = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data?.uid !== "string" || typeof data?.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return { uid: data.uid };
  } catch {
    // أي خلل (مثل تغيّر SESSION_SECRET) = جلسة غير صالحة، وليس خطأ 500
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return parseSessionValue(jar.get(SESSION_COOKIE)?.value)?.uid ?? null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
