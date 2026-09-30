"use client";

import { useMemo, useState } from "react";
import type { EnvCheckRow } from "@/lib/config";
import type {
  ReplyActionResponse,
  ReplyTargetReview,
  RunResponse,
  TestStepStatus,
} from "@/lib/test-types";
import type { TestStepId } from "@/lib/test-types";
import { StatusBadge } from "@/components/status-badge";
import { RawJson } from "@/components/ui";
import { Stars } from "@/components/stars";

const STEPS: { id: TestStepId; title: string }[] = [
  { id: "oauth", title: "OAuth — تسجيل الدخول بحساب Google حقيقي" },
  { id: "account-access", title: "Google Account Access — الحصول على الحسابات" },
  { id: "business-profile", title: "Business Profile Access — الوصول إلى النشاط التجاري" },
  { id: "locations", title: "Locations — قراءة المواقع" },
  { id: "reviews-read", title: "Reviews Read — قراءة التقييمات الحقيقية" },
  { id: "review-reply", title: "Review Reply — إنشاء رد حقيقي وإرساله إلى Google" },
  { id: "reply-update", title: "Reply Update — تحديث الرد" },
  { id: "reply-delete", title: "Reply Delete — حذف الرد" },
];

const READ_STEP_IDS = STEPS.slice(0, 5).map((s) => s.id);

interface StepState {
  status: TestStepStatus;
  summary?: string;
  raw?: unknown;
  docs?: string;
}

type StepsMap = Record<TestStepId, StepState>;

interface LogEntry {
  key: number;
  label: string;
  at: string;
  res: ReplyActionResponse;
}

export function TestClient(props: {
  envRows: EnvCheckRow[];
  redirectUri: string;
  loggedIn: boolean;
  userEmail: string | null;
  isAdmin: boolean;
  configOk: boolean;
}) {
  const [steps, setSteps] = useState<StepsMap>(() =>
    Object.fromEntries(STEPS.map((s) => [s.id, { status: "idle" } as StepState])) as StepsMap,
  );
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [locations, setLocations] = useState<{ name: string; title: string; address: string }[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [reviews, setReviews] = useState<ReplyTargetReview[]>([]);
  const [selectedReview, setSelectedReview] = useState("");
  const [replyText, setReplyText] = useState("شكرًا لك على تقييمك، نسعد بخدمتك دائمًا.");
  const [previousReply, setPreviousReply] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const review = useMemo(
    () => reviews.find((r) => r.name === selectedReview) ?? null,
    [reviews, selectedReview],
  );

  const readOk = READ_STEP_IDS.every((id) => steps[id].status === "pass");
  const replyOk = steps["review-reply"].status === "pass";
  const envCoreOk = props.envRows.filter((r) => r.phase === "core").every((r) => r.ok);

  function setStep(id: TestStepId, patch: StepState) {
    setSteps((prev) => ({ ...prev, [id]: patch }));
  }

  async function runReadChecks(locationName?: string) {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/admin/google-test/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationName }),
      });
      const data = (await res.json()) as RunResponse & { error?: string };
      if (!res.ok) {
        setRunError(data.error ?? `فشل الطلب: HTTP ${res.status}`);
        return;
      }
      setSteps((prev) => {
        const next: StepsMap = { ...prev };
        for (const s of data.steps) {
          next[s.id] = { status: s.status, summary: s.summary, raw: s.raw, docs: s.docs };
        }
        return next;
      });
      if (data.replyTarget) {
        setLocations(data.replyTarget.locations);
        setReviews(data.replyTarget.reviews);
        const target = locationName ?? data.replyTarget.chosenLocation ?? "";
        setSelectedLocation(target);
        // اختر أول تقييم بدون رد إن وجد، وإلا أول تقييم
        const pick = data.replyTarget.reviews.find((r) => !r.hasReply) ?? data.replyTarget.reviews[0];
        if (pick) {
          setSelectedReview(pick.name);
          setPreviousReply(pick.replyComment);
        }
      }
      if (data.error) setRunError(data.error);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function runReplyAction(action: "create" | "update" | "delete" | "restore") {
    if (!selectedReview) return;
    const comment = action === "restore" ? (previousReply ?? "") : replyText.trim();
    if (action !== "delete" && !comment) {
      setRunError("اكتب نص الرد أولًا.");
      return;
    }
    setBusyAction(action);
    setRunError(null);
    try {
      const res = await fetch("/api/admin/google-test/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reviewName: selectedReview, comment }),
      });
      const data = (await res.json()) as ReplyActionResponse;
      const labels: Record<string, string> = {
        create: "إنشاء الرد — PUT /v4/…/reviews/{id}/reply",
        update: "تحديث الرد — PUT /v4/…/reviews/{id}/reply",
        delete: "حذف الرد — DELETE /v4/…/reviews/{id}/reply",
        restore: "استعادة الرد الأصلي — PUT /v4/…/reviews/{id}/reply",
      };
      setLog((l) => [
        { key: Date.now() + Math.random(), label: labels[action], at: new Date().toLocaleTimeString("ar-u-ca-gregory-nu-latn"), res: data },
        ...l,
      ]);

      const okVerified = Boolean(data.ok && data.verified);
      if (action === "create") {
        setStep("review-reply", {
          status: okVerified ? "pass" : "fail",
          summary: data.summary ?? (data.ok ? undefined : "فشل إنشاء الرد"),
          raw: data.raw ?? data.error ?? null,
          docs: "https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply",
        });
        if (data.previousReply !== undefined) setPreviousReply(data.previousReply ?? null);
      } else if (action === "update") {
        setStep("reply-update", {
          status: okVerified ? "pass" : "fail",
          summary: data.summary,
          raw: data.raw ?? data.error ?? null,
        });
      } else if (action === "delete") {
        setStep("reply-delete", {
          status: okVerified ? "pass" : "fail",
          summary: data.summary,
          raw: data.raw ?? data.error ?? null,
        });
      } else if (action === "restore") {
        setStep("reply-update", {
          status: okVerified ? "pass" : "fail",
          summary: data.summary ?? "استعادة الرد الأصلي",
          raw: data.raw ?? data.error ?? null,
        });
      }

      if (data.replyNow !== undefined) {
        setReviews((rs) =>
          rs.map((r) =>
            r.name === selectedReview ? { ...r, hasReply: Boolean(data.replyNow), replyComment: data.replyNow ?? null } : r,
          ),
        );
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* تنبيه */}
      <div className="card border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-extrabold text-amber-900">تنبيه مهم قبل البدء</p>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          قسم «اختبار الرد» في هذه الصفحة يرسل ردودٍ حقيقية إلى Google وتظهر علنًا في نشاطك التجاري.
          اختر تقييمًا مناسبًا، وبعد الانتهاء استعِد الرد الأصلي أو احذف رد الاختبار. لا يوجد في هذه الصفحة
          أي بيانات وهمية — كل نتيجة تأتي من Google مباشرة.
        </p>
      </div>

      {/* ١) بيئة التشغيل */}
      <section className="card p-5">
        <h2 className="text-lg font-extrabold">١) حالة بيئة التشغيل</h2>
        <div className="mt-3 space-y-2">
          {props.envRows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/5 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm" dir="ltr">
                  {row.key}
                </p>
                <p className="text-xs text-black/50">{row.hint}</p>
              </div>
              <StatusBadge status={row.ok ? "pass" : "fail"} />
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed">
          <p className="font-bold">الـ Redirect URI الذي يجب تسجيله في Google Cloud Console</p>
          <p className="text-black/55">
            (OAuth client → Authorized redirect URIs — يجب أن يطابق حرفيًا)
          </p>
          <code dir="ltr" className="mt-1 block break-all font-mono text-brand-800">
            {props.redirectUri}
          </code>
        </div>
      </section>

      {/* ٢) تسجيل الدخول */}
      <section className="card p-5">
        <h2 className="text-lg font-extrabold">٢) تسجيل الدخول عبر Google</h2>
        <div className="mt-3">
          {!props.loggedIn ? (
            <div className="space-y-3">
              <p className="text-sm text-black/60">
                سجّل الدخول بحساب Google حقيقي تملك فيه نشاطًا تجاريًا — سيُطلب منك تمرير صلاحية إدارة
                النشاط التجاري (business.manage).
              </p>
              <a href="/api/auth/google/start?next=/admin/google-test" className="btn-primary">
                تسجيل الدخول عبر Google
              </a>
            </div>
          ) : !props.isAdmin ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
              أنت مسجّل كـ <span dir="ltr" className="font-bold">{props.userEmail}</span> لكن هذا البريد غير
              مدرج في <span dir="ltr" className="font-mono">ADMIN_EMAILS</span>. أضفه في{" "}
              <span dir="ltr" className="font-mono">.env.local</span> ثم أعد تشغيل التطبيق.
            </div>
          ) : (
            <p className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-800">
              مسجّل الدخول كـ <span dir="ltr" className="font-bold">{props.userEmail}</span> — بصلاحية أدمن.
            </p>
          )}
        </div>
      </section>

      {/* ٣) الفحوصات */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">٣) نتائج الفحوصات</h2>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={running || !props.isAdmin || !envCoreOk}
            onClick={() => runReadChecks()}
          >
            {running ? "جارٍ الفحص…" : "تشغيل الفحوصات (قراءة فقط)"}
          </button>
        </div>
        {runError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {runError}
          </div>
        )}
        <ol className="mt-4 space-y-2">
          {STEPS.map((s, i) => {
            const st = steps[s.id];
            return (
              <li key={s.id} className="rounded-xl border border-black/10 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-black/35">{i + 1}</span>
                  <p className="min-w-0 flex-1 text-sm font-bold">{s.title}</p>
                  <StatusBadge status={st.status} />
                </div>
                {st.summary && <p className="mt-2 text-sm leading-relaxed text-black/70">{st.summary}</p>}
                {st.docs && (
                  <a
                    href={st.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-brand-700 underline"
                  >
                    الوثيقة الرسمية من Google
                  </a>
                )}
                {st.raw != null && <RawJson data={st.raw} />}
              </li>
            );
          })}
        </ol>
      </section>

      {/* ٤) اختبار الرد */}
      <section className="card p-5">
        <h2 className="text-lg font-extrabold">٤) اختبار الرد الحقيقي</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-black/55">
            شغّل الفحوصات أولًا. إذا نجحت قراءة التقييمات ووُجدت تقييمات، ستظهر هنا لاختيار أحدها.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="loc" className="block text-sm font-bold">
                الموقع
              </label>
              <select
                id="loc"
                className="input mt-1"
                value={selectedLocation}
                disabled={running}
                onChange={(e) => runReadChecks(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.title}
                    {l.address ? ` — ${l.address}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rev" className="block text-sm font-bold">
                التقييم المستهدف
              </label>
              <select
                id="rev"
                className="input mt-1"
                value={selectedReview}
                onChange={(e) => {
                  setSelectedReview(e.target.value);
                  const r = reviews.find((x) => x.name === e.target.value);
                  setPreviousReply(r?.replyComment ?? null);
                }}
              >
                {reviews.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.reviewer || "عميل مجهول"} — {r.rating} نجوم{r.hasReply ? " — لديه رد منشور" : ""}
                  </option>
                ))}
              </select>
            </div>

            {review && (
              <div className="rounded-xl border border-black/10 bg-gray-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{review.reviewer || "عميل مجهول"}</span>
                  <Stars rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm leading-relaxed text-black/70">«{review.comment}»</p>
                )}
                {review.hasReply && review.replyComment ? (
                  <div className="mt-2 rounded-lg border border-black/10 bg-white p-2 text-sm">
                    <span className="text-xs font-bold text-black/50">الرد المنشور حاليًا: </span>
                    {review.replyComment}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-700">هذا التقييم لا يملك ردًا حاليًا.</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="reply" className="block text-sm font-bold">
                نص رد الاختبار (سيُنشر فعليًا على Google)
              </label>
              <textarea
                id="reply"
                className="input mt-1 min-h-24"
                value={replyText}
                maxLength={1500}
                onChange={(e) => setReplyText(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={Boolean(busyAction) || !selectedReview || !props.isAdmin}
                onClick={() => runReplyAction("create")}
              >
                {busyAction === "create" ? "جارٍ الإرسال…" : "١) إنشاء الرد وإرساله إلى Google"}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={Boolean(busyAction) || !selectedReview || !props.isAdmin}
                onClick={() => runReplyAction("update")}
              >
                {busyAction === "update" ? "…" : "٢) تحديث الرد"}
              </button>
              <button
                type="button"
                className="btn-danger text-sm"
                disabled={Boolean(busyAction) || !selectedReview || !props.isAdmin}
                onClick={() => runReplyAction("delete")}
              >
                {busyAction === "delete" ? "…" : "٣) حذف الرد"}
              </button>
              {previousReply && (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={Boolean(busyAction) || !props.isAdmin}
                  onClick={() => runReplyAction("restore")}
                >
                  {busyAction === "restore" ? "…" : "٤) استعادة الرد الأصلي"}
                </button>
              )}
            </div>
            <p className="text-xs text-black/45">
              الحد الرسمي من Google لنص الرد: 4096 بايت. النداء الواحد (PUT …/reply) ينشئ الرد إن لم يوجد
              ويحدّثه إن وُجد، وبعد كل عملية نعيد قراءة التقييم من Google للتأكد أن الرد ظهر فعلًا.
            </p>
          </div>
        )}
      </section>

      {/* ٥) سجل العمليات */}
      {log.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-extrabold">٥) سجل عمليات الرد (الأحدث أولًا)</h2>
          <div className="mt-3 space-y-3">
            {log.map((entry) => (
              <div key={entry.key} className="rounded-xl border border-black/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs font-bold sm:text-sm" dir="ltr">
                    {entry.label}
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={entry.res.ok ? "pass" : "fail"} />
                    {entry.res.verified !== undefined && (
                      <StatusBadge status={entry.res.verified ? "verified-true" : "verified-false"} />
                    )}
                    <span className="text-xs text-black/40">{entry.at}</span>
                  </div>
                </div>
                {entry.res.summary && (
                  <p className="mt-1 text-sm leading-relaxed text-black/70">{entry.res.summary}</p>
                )}
                {entry.res.error != null && <RawJson data={entry.res.error} label="خطأ Google الأصلي" />}
                {entry.res.raw != null && <RawJson data={entry.res.raw} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* الخلاصة */}
      <section className="card p-5">
        <h2 className="text-lg font-extrabold">الخلاصة</h2>
        {readOk && replyOk ? (
          <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-relaxed text-green-900">
            <p className="font-extrabold">التكامل الحقيقي يعمل بالكامل ✓</p>
            <p className="mt-1">
              تم تسجيل الدخول بحساب Google حقيقي، وقراءة الحسابات والمواقع والتقييمات الفعلية، وإرسال رد
              حقيقي إلى Google والتأكد من ظهوره. يمكن الانتقال لبناء بقية المنتج بثقة.
            </p>
          </div>
        ) : readOk ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            <p className="font-extrabold">القراءة تعمل — لم يكتمل اختبار الرد بعد</p>
            <p className="mt-1">
              OAuth والحسابات والمواقع والتقييمات تعمل فعليًا. نفّذ «اختبار الرد الحقيقي» في القسم الرابع
              لإثبات إرسال الردود إلى Google.
            </p>
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-black/10 bg-gray-50 p-4 text-sm leading-relaxed text-black/70">
            التكامل لم يكتمل بعد — راجع الخطوات الحمراء أعلاه، فكل خطأ يعرض رسالة Google الأصلية وسببه
            الحقيقي دون إخفاء.
          </div>
        )}
      </section>
    </div>
  );
}
