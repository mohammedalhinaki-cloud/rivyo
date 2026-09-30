/**
 * بدء تسجيل الدخول عبر Google OAuth 2.0 (Authorization Code + PKCE).
 * كل شيء server-side: الـ client_secret لا يظهر في الواجهة أبدًا.
 */
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { baseUrlFromRequest } from "@/lib/urls";
import { OAUTH_STATE_COOKIE } from "@/lib/session";
import { buildGoogleAuthUrl, codeChallengeS256, generateCodeVerifier } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cfg = getAppConfig();
  const baseUrl = baseUrlFromRequest(req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (cfg.missingCore.length > 0) {
    const url = new URL("/auth/error", baseUrl);
    url.searchParams.set("code", "missing_env");
    return NextResponse.redirect(url);
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const verifier = generateCodeVerifier();

  // وجهة العودة بعد النجاح (مسار داخلي فقط — منع open redirect)
  const nextParam = req.nextUrl.searchParams.get("next") ?? "";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/choose-business";

  const authUrl = buildGoogleAuthUrl({
    clientId: cfg.googleClientId,
    redirectUri,
    state,
    codeChallenge: codeChallengeS256(verifier),
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 دقائق تكفي لإكمال الموافقة
  });
  return res;
}
