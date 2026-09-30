/**
 * عودة Google بعد الموافقة: التحقق من state، تبديل الكود برموز، قراءة هوية الحساب،
 * إنشاء/تحديث المستخدم وتخزين الرموز مشفرة، ثم إنشاء جلسة.
 * عند أي خطأ يُحوَّل المستخدم إلى /auth/error مع رسالة Google الأصلية كاملة.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { baseUrlFromRequest } from "@/lib/urls";
import { AUTH_ERROR_COOKIE, OAUTH_STATE_COOKIE, SESSION_COOKIE, buildSessionValue, sessionCookieOptions } from "@/lib/session";
import { getDb } from "@/lib/db";
import { encryptSecret } from "@/lib/env-crypto";
import { errorToPayload } from "@/lib/google/http";
import { exchangeAuthorizationCode, fetchGoogleUserInfo } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

interface OAuthStateCookie {
  state: string;
  verifier: string;
  next: string;
}

export async function GET(req: NextRequest) {
  const baseUrl = baseUrlFromRequest(req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const fail = (message: string, raw?: unknown) => {
    const res = NextResponse.redirect(`${baseUrl}/auth/error`);
    res.cookies.set(
      AUTH_ERROR_COOKIE,
      JSON.stringify({ message, raw: raw ?? null, at: new Date().toISOString() }),
      { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 },
    );
    return res;
  };

  // 1) كوكي الحالة
  const oauthCookieRaw = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!oauthCookieRaw) {
    return fail("انتهت صلاحية جلسة تسجيل الدخول (كوكي state مفقود — ربما مضى أكثر من 10 دقائق). ابدأ من جديد.");
  }
  let st: OAuthStateCookie;
  try {
    st = JSON.parse(oauthCookieRaw) as OAuthStateCookie;
  } catch {
    return fail("بيانات جلسة OAuth تالفة. ابدأ من جديد.");
  }

  // 2) رفض صريح من المستخدم أو خطأ من Google
  const url = req.nextUrl;
  const googleError = url.searchParams.get("error");
  if (googleError) {
    return fail(
      `رفض Google إكمال تسجيل الدخول: ${googleError}${url.searchParams.get("error_description") ? ` — ${url.searchParams.get("error_description")}` : ""}`,
    );
  }

  // 3) الكود + التحقق من CSRF
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return fail("لم يصل رمز التفويض (code) من Google.");
  if (!state || state !== st.state) return fail("فشل التحقق الأمني: قيمة state غير مطابقة (محاولة CSRF أو جلسة قديمة).");

  // 4) تبديل الكود بالرموز
  const cfg = getAppConfig();
  if (cfg.missingCore.length > 0) {
    return fail(`متغيرات بيئة ناقصة: ${cfg.missingCore.join("، ")}`);
  }

  let tokens;
  try {
    tokens = await exchangeAuthorizationCode({
      code,
      redirectUri,
      codeVerifier: st.verifier,
      clientId: cfg.googleClientId,
      clientSecret: cfg.googleClientSecret,
    });
  } catch (err) {
    return fail("فشل تبديل رمز التفويض مع Google (token exchange). تأكد أن Redirect URI مسجل بدقة في Google Cloud Console.", errorToPayload(err));
  }

  // 5) هوية الحساب الحقيقي
  let info;
  try {
    info = await fetchGoogleUserInfo(tokens.access_token);
  } catch (err) {
    return fail("فشل قراءة بيانات حساب Google (userinfo).", errorToPayload(err));
  }
  if (!info.sub) return fail("لم نستطع قراءة معرّف حساب Google (sub).");

  // 6) حفظ المستخدم والرموز
  const db = getDb();
  if (!db) return fail("قاعدة البيانات (Supabase) غير مهيأة.");

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  let userId: string;
  const { data: existingUser } = await db.from("users").select("id").eq("google_sub", info.sub).maybeSingle();
  if (existingUser?.id) {
    const { error } = await db
      .from("users")
      .update({ email: info.email ?? null, name: info.name ?? null, avatar_url: info.picture ?? null, updated_at: now })
      .eq("id", existingUser.id);
    if (error) return fail(`خطأ من قاعدة البيانات عند تحديث المستخدم: ${error.message}`);
    userId = existingUser.id;
  } else {
    const { data: inserted, error } = await db
      .from("users")
      .insert({ google_sub: info.sub, email: info.email ?? null, name: info.name ?? null, avatar_url: info.picture ?? null })
      .select("id")
      .single();
    if (error || !inserted) return fail(`خطأ من قاعدة البيانات عند إنشاء المستخدم: ${error?.message ?? "غير معروف"}`);
    userId = inserted.id as string;
  }

  // الإعدادات الافتراضية (الرد اليدوي هو الافتراضي — لا يُنشر شيء تلقائيًا أبدًا بدون تفعيل صريح)
  await db.from("settings").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  // الرموز — مشفرة AES-256-GCM
  const connectionUpdate: Record<string, unknown> = {
    google_sub: info.sub,
    email: info.email ?? null,
    scope: tokens.scope ?? "",
    access_token_enc: encryptSecret(tokens.access_token),
    access_token_expires_at: expiresAt,
    token_obtained_at: now,
    updated_at: now,
  };

  const { data: existingConn } = await db.from("google_connections").select("id").eq("user_id", userId).maybeSingle();
  if (existingConn) {
    if (tokens.refresh_token) connectionUpdate.refresh_token_enc = encryptSecret(tokens.refresh_token);
    const { error } = await db.from("google_connections").update(connectionUpdate).eq("id", existingConn.id);
    if (error) return fail(`خطأ عند تحديث رموز Google: ${error.message}`);
  } else {
    if (!tokens.refresh_token) {
      return fail("Google لم يُرجع refresh_token. أعد تسجيل الدخول وتأكد من إكمال شاشة الموافقة كاملة.");
    }
    const { error } = await db
      .from("google_connections")
      .insert({ user_id: userId, refresh_token_enc: encryptSecret(tokens.refresh_token), ...connectionUpdate });
    if (error) return fail(`خطأ عند حفظ رموز Google: ${error.message}`);
  }

  // 7) جلسة + توجيه
  const res = NextResponse.redirect(`${baseUrl}${st.next || "/choose-business"}`);
  res.cookies.set(SESSION_COOKIE, buildSessionValue(userId), sessionCookieOptions());
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
