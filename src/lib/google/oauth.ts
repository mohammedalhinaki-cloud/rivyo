/**
 * Google OAuth 2.0 — Authorization Code Flow مع PKCE (S256) — كله server-side.
 *
 * Endpoints الرسمية (متحقق منها):
 * - Authorization: https://accounts.google.com/o/oauth2/v2/auth
 * - Token:         https://oauth2.googleapis.com/token
 * - Userinfo:      https://openid.googleapis.com/v1/userinfo
 * - الصلاحية المطلوبة لإدارة التقييمات: https://www.googleapis.com/auth/business.manage
 *
 * ممنوع منعًا باتًا وضع أي من هذه القيم أو الرموز في الواجهة (Frontend).
 */
import crypto from "node:crypto";
import { googleFetchJson } from "./http";

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT = "https://openid.googleapis.com/v1/userinfo";

export const BUSINESS_MANAGE_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const GOOGLE_SCOPES = ["openid", "email", "profile", BUSINESS_MANAGE_SCOPE];

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
  locale?: string;
}

export function generateCodeVerifier(): string {
  // 64 محرفًا من الأبجدية الآمنة للـ URL — ضمن الحدود المسموحة (43–128)
  return crypto.randomBytes(48).toString("base64url");
}

export function codeChallengeS256(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function buildGoogleAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // offline + consent لضمان الحصول على refresh_token
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  if (opts.loginHint) params.set("login_hint", opts.loginHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(opts: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
    code_verifier: opts.codeVerifier,
  });
  return googleFetchJson<GoogleTokenResponse>(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
}

export async function refreshGoogleAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: "refresh_token",
  });
  return googleFetchJson<GoogleTokenResponse>(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  return googleFetchJson<GoogleUserInfo>(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
}
