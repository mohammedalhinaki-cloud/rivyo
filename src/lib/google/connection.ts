/**
 * إدارة رموز Google لمستخدم: قراءة من قاعدة البيانات (مشفرة) + تجديد تلقائي عند انتهاء الصلاحية.
 * الـ refresh_token لا يُخزن إلا مشفرًا (AES-256-GCM) ولا يغادر السيرفر أبدًا.
 */
import { getDb } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/env-crypto";
import { errorToPayload } from "./http";
import { refreshGoogleAccessToken, BUSINESS_MANAGE_SCOPE } from "./oauth";

export type TokenResult =
  | { ok: true; accessToken: string; scope: string; hasBusinessManageScope: boolean }
  | { ok: false; error: string; errorPayload?: ReturnType<typeof errorToPayload> };

export async function getValidGoogleAccessToken(userId: string): Promise<TokenResult> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Supabase غير مهيأ (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ناقصة)" };
  }

  const { data: conn, error } = await db
    .from("google_connections")
    .select("id, refresh_token_enc, access_token_enc, access_token_expires_at, scope")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: `خطأ من قاعدة البيانات عند قراءة الاتصال: ${error.message}` };
  }
  if (!conn) {
    return { ok: false, error: "لا يوجد اتصال Google مسجّل لهذا المستخدم — ابدأ بتسجيل الدخول عبر Google." };
  }

  // 1) جرّب الـ access token المخزّن إن كان لا يزال صالحًا (بهامش أمان 60 ثانية)
  if (conn.access_token_enc && conn.access_token_expires_at) {
    try {
      const expiresAt = new Date(conn.access_token_expires_at).getTime();
      if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000) {
        const accessToken = decryptSecret(conn.access_token_enc);
        return {
          ok: true,
          accessToken,
          scope: conn.scope ?? "",
          hasBusinessManageScope: (conn.scope ?? "").includes(BUSINESS_MANAGE_SCOPE),
        };
      }
    } catch {
      // فشل فك التشفير → ننزل لتجديد الرمز
    }
  }

  // 2) جدّد الـ access token باستخدام refresh_token
  if (!conn.refresh_token_enc) {
    return { ok: false, error: "لا يوجد refresh_token مخزّن — سجّل الدخول عبر Google من جديد." };
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(conn.refresh_token_enc);
  } catch {
    return {
      ok: false,
      error:
        "فشل فك تشفير refresh_token (هل تغيّر ENCRYPTION_KEY؟) — سجّل الدخول عبر Google من جديد لإعادة الربط.",
    };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    return { ok: false, error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET غير مضبوطين" };
  }

  try {
    const tokens = await refreshGoogleAccessToken({ refreshToken, clientId, clientSecret });
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    const now = new Date().toISOString();
    await db
      .from("google_connections")
      .update({
        access_token_enc: encryptSecret(tokens.access_token),
        access_token_expires_at: expiresAt,
        scope: tokens.scope ?? conn.scope ?? "",
        updated_at: now,
      })
      .eq("id", conn.id);
    return {
      ok: true,
      accessToken: tokens.access_token,
      scope: tokens.scope ?? conn.scope ?? "",
      hasBusinessManageScope: (tokens.scope ?? conn.scope ?? "").includes(BUSINESS_MANAGE_SCOPE),
    };
  } catch (err) {
    return {
      ok: false,
      error: `فشل تجديد رمز الوصول من Google: ${err instanceof Error ? err.message : String(err)}`,
      errorPayload: errorToPayload(err),
    };
  }
}
