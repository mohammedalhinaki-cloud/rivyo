/**
 * تشغيل فحوصات تكامل Google Business Profile API — فحوصات قراءة فقط (لا تنشر شيئًا).
 * كل خطوة تُرجع نتيجتها مع الاستجابة الخام من Google كما هي، دون أي إخفاء.
 *
 * خط سير الفحص:
 *  1) OAuth 2.0             — جلسة صالحة + token يعمل + صلاحية business.manage
 *  2) Google Account Access — GET /v1/accounts (Account Management API)
 *  3) Business Profile      — GET /v4/accounts/{id}/locations ينجح لحساب واحد على الأقل
 *  4) Locations             — عدد المواقع ≥ 1
 *  5) Reviews Read          — GET …/reviews يعيد التقييمات الحقيقية
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { getValidGoogleAccessToken } from "@/lib/google/connection";
import { fetchGoogleUserInfo } from "@/lib/google/oauth";
import {
  type GbpAccount,
  type GbpLocation,
  isValidResourceName,
  listGoogleAccounts,
  listGoogleLocations,
  listGoogleReviews,
  locationAddressLine,
  starRatingToNumber,
} from "@/lib/google/business-profile";
import { errorToPayload } from "@/lib/google/http";
import type { RunResponse, TestStep } from "@/lib/test-types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error, reason: admin.reason }, { status: admin.status });
  }

  const body = (await req.json().catch(() => ({}))) as { locationName?: string };
  const chosenLocation =
    body.locationName && isValidResourceName(body.locationName, "location") ? body.locationName : null;

  const steps: TestStep[] = [];
  const token = await getValidGoogleAccessToken(admin.user.id);

  // ---------------- الخطوة 1: OAuth ----------------
  if (!token.ok) {
    steps.push({
      id: "oauth",
      title: "تسجيل الدخول عبر Google OAuth 2.0",
      status: "fail",
      summary: token.error,
      raw: token.errorPayload ?? null,
      docs: "https://developers.google.com/identity/protocols/oauth2",
    });
    const early: RunResponse = { ok: false, steps, replyTarget: null };
    return NextResponse.json(early);
  }

  let oauthPassed = false;
  try {
    const info = await fetchGoogleUserInfo(token.accessToken);
    const scopeOk = token.hasBusinessManageScope;
    steps.push({
      id: "oauth",
      title: "تسجيل الدخول عبر Google OAuth 2.0",
      status: scopeOk ? "pass" : "fail",
      summary: scopeOk
        ? `متصل بحساب Google حقيقي: ${info.email ?? info.sub}${info.name ? ` (${info.name})` : ""} — الصلاحيات تشمل business.manage`
        : `متصل كـ ${info.email ?? info.sub} لكن الصلاحيات الممنوحة لا تشمل business.manage — أعد تسجيل الدخول ووافق على الصلاحيات.`,
      raw: { userinfo: info, granted_scope: token.scope },
    });
    oauthPassed = scopeOk;
  } catch (err) {
    steps.push({
      id: "oauth",
      title: "تسجيل الدخول عبر Google OAuth 2.0",
      status: "fail",
      summary: "فشل التحقق من رمز الوصول عبر Google userinfo (قد يكون الرمز منتهيًا أو مرفوضًا).",
      raw: errorToPayload(err),
    });
  }

  if (!oauthPassed) {
    const early: RunResponse = {
      ok: false,
      steps,
      replyTarget: null,
    };
    return NextResponse.json(early);
  }

  // ---------------- الخطوة 2: حسابات المستخدم ----------------
  let accounts: GbpAccount[] = [];
  let accountsOk = false;
  try {
    accounts = await listGoogleAccounts(token.accessToken);
    accountsOk = true;
    steps.push({
      id: "account-access",
      title: "الحصول على حسابات المستخدم (Account Management API)",
      status: "pass",
      summary:
        accounts.length > 0
          ? `تم جلب ${accounts.length} حساب: ${accounts.map((a) => `${a.accountName ?? a.name} [${a.type ?? "غير معروف"}]`).join("، ")}`
          : "النداء نجح لكن لم يُرجع أي حسابات (هل تملك نشاطًا تجاريًا على Google؟)",
      raw: accounts,
      docs: "https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list",
    });
  } catch (err) {
    steps.push({
      id: "account-access",
      title: "الحصول على حسابات المستخدم (Account Management API)",
      status: "fail",
      summary: "فشل جلب الحسابات — انظر رسالة Google الأصلية بالأسفل.",
      raw: errorToPayload(err),
      docs: "https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list",
    });
  }

  // ---------------- الخطوتان 3 و4: الوصول للنشاط التجاري + المواقع ----------------
  let locations: GbpLocation[] = [];
  if (!accountsOk) {
    steps.push({ id: "business-profile", title: "الوصول إلى بيانات النشاط التجاري", status: "skip", summary: "لم يُشغَّل لأن جلب الحسابات لم ينجح." });
    steps.push({ id: "locations", title: "قراءة المواقع / Locations", status: "skip", summary: "لم يُشغَّل لأن جلب الحسابات لم ينجح." });
  } else if (accounts.length === 0) {
    steps.push({ id: "business-profile", title: "الوصول إلى بيانات النشاط التجاري", status: "skip", summary: "لا توجد حسابات لفحصها." });
    steps.push({
      id: "locations",
      title: "قراءة المواقع / Locations",
      status: "fail",
      summary: "الحسابات موجودة لكنها فارغة — لا يوجد نشاط تجاري مرتبط بحساب Google هذا.",
    });
  } else {
    let firstLocationsError: unknown = null;
    let anyLocationsCallSucceeded = false;
    for (const account of accounts.slice(0, 10)) {
      try {
        const locs = await listGoogleLocations(token.accessToken, account.name);
        anyLocationsCallSucceeded = true;
        locations.push(...locs);
      } catch (err) {
        if (!firstLocationsError) firstLocationsError = err;
      }
    }
    if (anyLocationsCallSucceeded) {
      steps.push({
        id: "business-profile",
        title: "الوصول إلى بيانات النشاط التجاري (Business Profile)",
        status: "pass",
        summary: "نداء المواقع نجح — التطبيق مخوّل لقراءة بيانات النشاط التجاري (صلاحية business.manage تعمل).",
        docs: "https://developers.google.com/my-business/reference/rest/v4/accounts.locations/list",
      });
      steps.push({
        id: "locations",
        title: "قراءة المواقع / Locations",
        status: locations.length > 0 ? "pass" : "fail",
        summary:
          locations.length > 0
            ? `تم جلب ${locations.length} موقع: ${locations.slice(0, 5).map((l) => l.locationName ?? l.name).join("، ")}${locations.length > 5 ? " وغيرها" : ""}`
            : "النداء نجح لكن لا توجد مواقع في أي حساب — أنشئ/اربط نشاطًا تجاريًا في Google Business Profile أولًا.",
        raw: locations.slice(0, 10),
      });
    } else {
      steps.push({
        id: "business-profile",
        title: "الوصول إلى بيانات النشاط التجاري (Business Profile)",
        status: "fail",
        summary:
          "فشل الوصول إلى بيانات النشاط التجاري. الأسباب الشائعة: لم تُفعَّل My Business APIs في مشروع Google Cloud، أو لم يُمنح مشروعك وصولًا إلى Business Profile APIs (نموذج الطلب)، أو الحساب ليس مالكًا/مديرًا للنشاط.",
        raw: errorToPayload(firstLocationsError),
        docs: "https://developers.google.com/my-business/content/prereqs",
      });
      steps.push({ id: "locations", title: "قراءة المواقع / Locations", status: "skip", summary: "لم يُشغَّل لأن الوصول للنشاط التجاري فشل." });
    }
  }

  // ---------------- الخطوة 5: قراءة التقييمات ----------------
  let reviewsList: Awaited<ReturnType<typeof listGoogleReviews>> | null = null;
  let reviewsLocation: GbpLocation | null = null;

  if (steps[3].status !== "pass") {
    steps.push({ id: "reviews-read", title: "قراءة التقييمات الحقيقية", status: "skip", summary: "لم يُشغَّل لأن قراءة المواقع لم تُنجز." });
  } else {
    const target = chosenLocation
      ? (locations.find((l) => l.name === chosenLocation) ?? null)
      : (locations[0] ?? null);
    if (!target) {
      steps.push({ id: "reviews-read", title: "قراءة التقييمات الحقيقية", status: "fail", summary: "الموقع المختار غير موجود ضمن مواقعك." });
    } else {
      let reviewsError: unknown = null;
      try {
        reviewsList = await listGoogleReviews(token.accessToken, target.name);
        reviewsLocation = target;
      } catch (err) {
        reviewsError = err;
      }
      if (reviewsList) {
        const count = reviewsList.totalReviewCount ?? reviewsList.reviews?.length ?? 0;
        steps.push({
          id: "reviews-read",
          title: "قراءة التقييمات الحقيقية",
          status: "pass",
          summary:
            count > 0
              ? `نجحت القراءة: ${count} تقييم إجمالًا في «${target.locationName ?? target.name}» — المتوسط ${reviewsList.averageRating ?? "?"} من 5. (هذه بيانات حقيقية من Google وليست تجريبية)`
              : `نجح النداء لكن لا توجد تقييمات في «${target.locationName ?? target.name}» بعد. اختبار الرد يحتاج تقييمًا واحدًا على الأقل.`,
          raw: {
            location: target.name,
            totalReviewCount: reviewsList.totalReviewCount ?? null,
            averageRating: reviewsList.averageRating ?? null,
            عينة_من_التقييمات: (reviewsList.reviews ?? []).slice(0, 2),
          },
          docs: "https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list",
        });
      } else {
        steps.push({
          id: "reviews-read",
          title: "قراءة التقييمات الحقيقية",
          status: "fail",
          summary:
            "فشلت قراءة التقييمات. السبب الأشيع: الموقع غير موثّق (verified) — قراءة التقييمات لا تعمل إلا للمواقع الموثّقة. انظر رسالة Google الأصلية بالأسفل.",
          raw: errorToPayload(reviewsError),
          docs: "https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list",
        });
      }
    }
  }

  // ---------------- هدف اختبار الرد ----------------
  const replyTarget: RunResponse["replyTarget"] = {
    accounts: accounts.map((a) => ({ name: a.name, accountName: a.accountName ?? null, type: a.type ?? null })),
    locations: locations.map((l) => ({
      name: l.name,
      title: l.locationName ?? l.name,
      address: locationAddressLine(l),
    })),
    chosenLocation: reviewsLocation?.name ?? chosenLocation,
    reviews:
      reviewsList?.reviews?.map((r) => ({
        name: r.name,
        reviewer: r.reviewer?.displayName ?? "",
        isAnonymous: Boolean(r.reviewer?.isAnonymous),
        rating: starRatingToNumber(r.starRating),
        comment: r.comment ?? null,
        createTime: r.createTime,
        hasReply: Boolean(r.reviewReply?.comment),
        replyComment: r.reviewReply?.comment ?? null,
      })) ?? [],
  };

  const response: RunResponse = {
    ok: steps.every((s) => s.status !== "fail"),
    steps,
    replyTarget,
  };
  return NextResponse.json(response);
}
