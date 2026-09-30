/**
 * عميل Google Business Profile APIs — الواجهات الرسمية الحالية فقط (تم التحقق من الوثائق):
 *
 * - Account Management API (حسابات المستخدم):
 *   GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts
 *
 * - Google My Business API v4.9 (المواقع والتقييمات والردود):
 *   GET    https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations
 *   GET    https://mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews
 *   GET    https://mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews/{r}
 *   PUT    https://mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews/{r}/reply
 *   DELETE https://mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews/{r}/reply
 *
 * - الصلاحية: https://www.googleapis.com/auth/business.manage
 * - ملاحظات رسمية مهمة:
 *   * قراءة التقييمات والرد عليها صالحة فقط للمواقع الموثّقة (verified).
 *   * PUT على مسار reply ينشئ الرد إن لم يوجد ويحدّثه إن وُجد.
 *   * لا يوجد scraping أو Selenium هنا — Google APIs الرسمية فقط.
 */
import { googleFetchJson } from "./http";

const ACCOUNT_MGMT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";
const MYBUSINESS_V4_BASE = "https://mybusiness.googleapis.com/v4";

// ---------------- أنواع البيانات ----------------

export interface GbpAccount {
  name: string; // "accounts/{accountId}"
  accountName?: string;
  type?: string; // PERSONAL | LOCATION_GROUP | ORGANIZATION | USER_GROUP
  permissionLevel?: string;
  role?: string;
}

export interface GbpLocation {
  name: string; // "accounts/{accountId}/locations/{locationId}"
  locationName?: string;
  primaryPhone?: string;
  primaryCategory?: { displayName?: string; categoryId?: string };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    country?: string;
  };
  storeCode?: string;
  languageCode?: string;
}

export interface GbpReviewReply {
  comment?: string;
  updateTime?: string;
}

export interface GbpReview {
  name: string; // "accounts/{a}/locations/{l}/reviews/{reviewId}"
  reviewId?: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: GbpReviewReply;
}

export interface GbpReviewsList {
  reviews?: GbpReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

// ---------------- نداءات API ----------------

function authHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}`, accept: "application/json" };
}

/** الحسابات التي يملكها المستخدم أو يملك عليها صلاحيات إدارة */
export async function listGoogleAccounts(accessToken: string): Promise<GbpAccount[]> {
  const out: GbpAccount[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const params = new URLSearchParams({ pageSize: "20" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleFetchJson<{ accounts?: GbpAccount[]; nextPageToken?: string }>(
      `${ACCOUNT_MGMT_BASE}/accounts?${params.toString()}`,
      { headers: authHeaders(accessToken) },
    );
    out.push(...(data.accounts ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && ++pages < 10);
  return out;
}

/** مواقع (أنشطة تجارية) حساب معين */
export async function listGoogleLocations(accessToken: string, accountName: string): Promise<GbpLocation[]> {
  const out: GbpLocation[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleFetchJson<{ locations?: GbpLocation[]; nextPageToken?: string }>(
      `${MYBUSINESS_V4_BASE}/${accountName}/locations?${params.toString()}`,
      { headers: authHeaders(accessToken) },
    );
    out.push(...(data.locations ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && ++pages < 5);
  return out;
}

/** تقييمات موقع معين (يعمل فقط للمواقع الموثّقة) */
export async function listGoogleReviews(
  accessToken: string,
  locationName: string,
  opts: { pageSize?: number; orderBy?: "rating" | "rating desc" | "updateTime desc" } = {},
): Promise<GbpReviewsList> {
  const params = new URLSearchParams({ pageSize: String(Math.min(opts.pageSize ?? 50, 50)) });
  if (opts.orderBy) params.set("orderBy", opts.orderBy);
  return googleFetchJson<GbpReviewsList>(
    `${MYBUSINESS_V4_BASE}/${locationName}/reviews?${params.toString()}`,
    { headers: authHeaders(accessToken) },
  );
}

/** تقييم واحد بالتحديد — نستخدمها للتحقق أن الرد ظهر فعلًا */
export async function getGoogleReview(accessToken: string, reviewName: string): Promise<GbpReview> {
  return googleFetchJson<GbpReview>(`${MYBUSINESS_V4_BASE}/${reviewName}`, {
    headers: authHeaders(accessToken),
  });
}

/** إنشاء/تحديث رد على تقييم — يُرسل فعليًا إلى Google */
export async function upsertGoogleReply(
  accessToken: string,
  reviewName: string,
  comment: string,
): Promise<GbpReviewReply> {
  return googleFetchJson<GbpReviewReply>(`${MYBUSINESS_V4_BASE}/${reviewName}/reply`, {
    method: "PUT",
    headers: { ...authHeaders(accessToken), "content-type": "application/json" },
    body: JSON.stringify({ comment }),
  });
}

/** حذف رد على تقييم */
export async function deleteGoogleReply(accessToken: string, reviewName: string): Promise<void> {
  await googleFetchJson<unknown>(`${MYBUSINESS_V4_BASE}/${reviewName}/reply`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

// ---------------- أدوات ----------------

export function starRatingToNumber(rating?: string): number {
  switch (rating) {
    case "ONE":
      return 1;
    case "TWO":
      return 2;
    case "THREE":
      return 3;
    case "FOUR":
      return 4;
    case "FIVE":
      return 5;
    default:
      return 0;
  }
}

export function locationAddressLine(loc: GbpLocation): string {
  const a = loc.storefrontAddress;
  if (!a) return "";
  return [a.addressLines?.join(" "), a.locality, a.administrativeArea, a.country].filter(Boolean).join("، ");
}

/** أنواع موارد Google — تُستخدم للتحقق من الصيغة (يمنع أي تلاعب بالمسارات) */
export type ResourceKind = "account" | "location" | "review";

export function isValidResourceName(name: string, kind: ResourceKind): boolean {
  const patterns: Record<ResourceKind, RegExp> = {
    account: /^accounts\/[A-Za-z0-9_-]+$/,
    location: /^accounts\/[A-Za-z0-9_-]+\/locations\/[A-Za-z0-9_-]+$/,
    review: /^accounts\/[A-Za-z0-9_-]+\/locations\/[A-Za-z0-9_-]+\/reviews\/[A-Za-z0-9_-]+$/,
  };
  return patterns[kind].test(name);
}
