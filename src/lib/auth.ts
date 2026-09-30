/**
 * المستخدم الحالي + حماية صفحات الأدمن.
 */
import { getDb } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export interface SessionUser {
  id: string;
  google_sub: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const db = getDb();
  if (!db) return null;
  const { data, error } = await db
    .from("users")
    .select("id, google_sub, email, name, avatar_url")
    .eq("id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return data as SessionUser;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export type AdminCheck =
  | { ok: true; user: SessionUser }
  | { ok: false; status: number; error: string; reason: "no_session" | "not_admin" | "db_down" };

export async function requireAdminUser(): Promise<AdminCheck> {
  const user = await getCurrentUser();
  if (!user) {
    const db = getDb();
    return {
      ok: false,
      status: db ? 401 : 503,
      reason: db ? "no_session" : "db_down",
      error: db
        ? "يجب تسجيل الدخول عبر Google أولًا لاستخدام صفحة الاختبار."
        : "قاعدة البيانات (Supabase) غير مهيأة — اضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.",
    };
  }
  if (!isAdminEmail(user.email)) {
    return {
      ok: false,
      status: 403,
      reason: "not_admin",
      error: `البريد ${user.email ?? "(غير معروف)"} غير مدرج في ADMIN_EMAILS — أضفه في .env.local للوصول إلى صفحة الاختبار.`,
    };
  }
  return { ok: true, user };
}
