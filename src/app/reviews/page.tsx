import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { getValidGoogleAccessToken } from "@/lib/google/connection";
import { errorToPayload } from "@/lib/google/http";
import {
  listGoogleReviews,
  starRatingToNumber,
  type GbpReview,
  type GbpReviewsList,
} from "@/lib/google/business-profile";
import { requireDb } from "@/lib/db";
import { syncReviewsToDb } from "@/lib/sync";
import { formatDateAr, formatNumberAr } from "@/lib/format";
import { ApiErrorCard, ReconnectCard, SetupNotice } from "@/components/state-cards";
import { AvatarImg } from "@/components/ui";
import { Stars } from "@/components/stars";
import { MaaounBadge, RivyoMark } from "@/components/brand";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

interface SelectedLocation {
  id: string;
  google_location_name: string;
  display_name: string;
  address: string | null;
}

export default async function ReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const cfg = getAppConfig();

  const header = (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <RivyoMark />
        <span className="text-xl font-extrabold">Rivyo</span>
      </div>
      <div className="flex items-center gap-3">
        {isAdminEmail(user.email) && (
          <Link href="/admin/google-test" className="text-xs font-bold text-brand-700 underline">
            فحص التكامل
          </Link>
        )}
        <MaaounBadge />
      </div>
    </div>
  );

  if (cfg.missingCore.length > 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {header}
        <SetupNotice missing={cfg.missingCore} />
      </main>
    );
  }

  const token = await getValidGoogleAccessToken(user.id);
  if (!token.ok) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {header}
        <ReconnectCard message={token.error} raw={token.errorPayload} />
      </main>
    );
  }

  const db = requireDb();
  const { data: loc } = await db
    .from("business_locations")
    .select("id, google_location_name, display_name, address")
    .eq("user_id", user.id)
    .eq("is_selected", true)
    .maybeSingle();
  const selected = (loc ?? null) as SelectedLocation | null;
  if (!selected) redirect("/choose-business");

  let data: GbpReviewsList;
  try {
    data = await listGoogleReviews(token.accessToken, selected.google_location_name);
  } catch (err) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {header}
        <ApiErrorCard
          title="فشلت قراءة التقييمات من Google"
          message="رسالة Google الأصلية بالأسفل. السبب الأشيع: الموقع غير موثّق (verified) — قراءة التقييمات لا تعمل إلا للمواقع الموثّقة."
          raw={errorToPayload(err)}
          docs="https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list"
        />
      </main>
    );
  }

  const reviews: GbpReview[] = data.reviews ?? [];
  const sync = await syncReviewsToDb(user.id, selected.id, reviews);
  const unanswered = reviews.filter((r) => !r.reviewReply?.comment).length;
  const avg = data.averageRating ?? null;
  const total = data.totalReviewCount ?? reviews.length;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {header}

        {/* ملخص النشاط */}
        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold">{selected.display_name}</h1>
              {selected.address && <p className="mt-0.5 truncate text-sm text-black/50">{selected.address}</p>}
            </div>
            <RefreshButton />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-brand-50 p-3">
              <p className="text-2xl font-extrabold text-brand-800">{formatNumberAr(total, 0)}</p>
              <p className="mt-0.5 text-xs text-black/55">إجمالي التقييمات</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-2xl font-extrabold text-amber-700">
                {avg != null ? formatNumberAr(avg, 1) : "—"}
              </p>
              <p className="mt-0.5 text-xs text-black/55">متوسط التقييم</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-2xl font-extrabold text-red-700">{formatNumberAr(unanswered, 0)}</p>
              <p className="mt-0.5 text-xs text-black/55">بدون رد</p>
            </div>
          </div>
          {!sync.ok && (
            <p className="mt-3 rounded-xl bg-amber-50 p-2 text-xs text-amber-800">
              تحذير: تعذّرت مزامنة التقييمات مع قاعدة البيانات ({sync.error}) — العرض أعلاه مباشر من Google.
            </p>
          )}
        </section>

        {/* قائمة التقييمات الحقيقية */}
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-extrabold">التقييمات</h2>
          {reviews.length === 0 ? (
            <div className="card p-6 text-center text-sm text-black/55">
              لا توجد تقييمات لهذا النشاط حتى الآن. ستظهر هنا تلقائيًا فور وصول أول تقييم.
            </div>
          ) : (
            reviews.map((r) => {
              const rating = starRatingToNumber(r.starRating);
              const name = r.reviewer?.isAnonymous ? "عميل مجهول" : (r.reviewer?.displayName ?? "عميل");
              return (
                <article key={r.name} className="card p-4">
                  <div className="flex items-center gap-3">
                    <AvatarImg src={r.reviewer?.profilePhotoUrl} name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Stars rating={rating} />
                        <span className="text-xs text-black/45">{formatDateAr(r.createTime)}</span>
                      </div>
                    </div>
                    {r.reviewReply?.comment ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                        تم الرد
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                        بدون رد
                      </span>
                    )}
                  </div>
                  {r.comment && (
                    <p className="mt-3 leading-relaxed text-black/75">{r.comment}</p>
                  )}
                  {r.reviewReply?.comment && (
                    <div className="mt-3 rounded-xl border-brand-100 bg-brand-50/60 p-3">
                      <p className="text-xs font-bold text-brand-800">ردك المنشور على Google</p>
                      <p className="mt-1 text-sm text-black/75">{r.reviewReply.comment}</p>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        {/* ملاحظة مرحلة صادقة */}
        <p className="mt-8 rounded-xl border border-black/5 bg-white/60 p-4 text-center text-xs leading-relaxed text-black/50">
          هذه تقييمات حقيقية تُقرأ مباشرة من Google Business Profile API.
          <br />
          توليد الردود بالذكاء الاصطناعي (Gemini) يُبنى في المرحلة التالية — بعد تأكيد نجاح اختبار التكامل
          الفعلي عبر <Link href="/admin/google-test" className="underline">/admin/google-test</Link>.
        </p>
      </main>
    </>
  );
}
