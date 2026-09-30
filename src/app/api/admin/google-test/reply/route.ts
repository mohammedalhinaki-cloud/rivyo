/**
 * اختبار الرد الحقيقي على تقييم فعلي — هذه النداءات تُرسل إلى Google فعلًا:
 *
 *  create  → PUT    /v4/{review}/reply   (إنشاء الرد + التحقق أنه ظهر بإعادة قراءة التقييم)
 *  update  → PUT    /v4/{review}/reply   (تحديث نص الرد + تحقق)
 *  delete  → DELETE /v4/{review}/reply   (حذف الرد + تحقق أنه اختفى)
 *  restore → PUT    /v4/{review}/reply   (إعادة الرد الأصلي الذي كان موجودًا قبل الاختبار)
 *
 * يُعاد دائمًا كائن يحتوي الاستجابات الخام من Google كما هي.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { getValidGoogleAccessToken } from "@/lib/google/connection";
import {
  deleteGoogleReply,
  getGoogleReview,
  isValidResourceName,
  upsertGoogleReply,
} from "@/lib/google/business-profile";
import { errorToPayload } from "@/lib/google/http";
import type { ReplyActionResponse } from "@/lib/test-types";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set(["create", "update", "delete", "restore"]);
const MAX_REPLY_BYTES = 4096; // الحد الرسمي من Google

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error, reason: admin.reason }, { status: admin.status });
  }

  let body: { action?: string; reviewName?: string; comment?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "طلب غير صالح" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const reviewName = String(body.reviewName ?? "").trim();
  const comment = String(body.comment ?? "").trim();

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: `action غير صالح: ${action}` }, { status: 400 });
  }
  if (!isValidResourceName(reviewName, "review")) {
    return NextResponse.json({ ok: false, error: "reviewName غير صالح" }, { status: 400 });
  }
  if (action !== "delete") {
    if (!comment) {
      return NextResponse.json({ ok: false, error: "نص الرد مطلوب" }, { status: 400 });
    }
    if (Buffer.byteLength(comment, "utf8") > MAX_REPLY_BYTES) {
      return NextResponse.json({ ok: false, error: `نص الرد يتجاوز الحد الرسمي من Google (${MAX_REPLY_BYTES} بايت)` }, { status: 400 });
    }
  }

  const token = await getValidGoogleAccessToken(admin.user.id);
  if (!token.ok) {
    return NextResponse.json({ ok: false, action, error: token.error, raw: token.errorPayload ?? null });
  }

  try {
    if (action === "delete") {
      const before = await getGoogleReview(token.accessToken, reviewName);
      await deleteGoogleReply(token.accessToken, reviewName);
      const after = await getGoogleReview(token.accessToken, reviewName);
      const verified = !after.reviewReply?.comment;
      const res: ReplyActionResponse = {
        ok: true,
        action,
        verified,
        httpStatus: 200,
        previousReply: before.reviewReply?.comment ?? null,
        replyNow: after.reviewReply?.comment ?? null,
        summary: verified
          ? "تم حذف الرد من Google واختفى فعلًا (تأكدنا بإعادة قراءة التقييم)."
          : "أُرسل طلب الحذف لكن الرد ما زال ظاهرًا عند إعادة القراءة — راجع الاستجابة الخام.",
        raw: { التقييم_قبل: before, التقييم_بعد: after },
      };
      return NextResponse.json(res);
    }

    // create / update / restore — كلها PUT .../reply
    const before = await getGoogleReview(token.accessToken, reviewName);
    const put = await upsertGoogleReply(token.accessToken, reviewName, comment);
    const after = await getGoogleReview(token.accessToken, reviewName);
    const verified = (after.reviewReply?.comment ?? "").trim() === comment.trim();

    const labels: Record<string, string> = {
      create: "إنشاء رد جديد وإرساله إلى Google",
      update: "تحديث نص الرد في Google",
      restore: "استعادة الرد الأصلي في Google",
    };

    const res: ReplyActionResponse = {
      ok: true,
      action,
      verified,
      httpStatus: 200,
      previousReply: before.reviewReply?.comment ?? null,
      replyNow: after.reviewReply?.comment ?? null,
      summary: verified
        ? `${labels[action]}: نجح — وأعدنا قراءة التقييم من Google وتأكدنا أن الرد المنشور يطابق ما أُرسل حرفيًا.`
        : `${labels[action]}: النداء نجح لكن النص المنشور لا يطابق المرسل — راجع الاستجابة الخام.`,
      raw: { التقييم_قبل: before, استجابة_الإرسال: put, التقييم_بعد: after },
    };
    return NextResponse.json(res);
  } catch (err) {
    const res: ReplyActionResponse = {
      ok: false,
      action,
      error: errorToPayload(err),
      summary: "فشل النداء — رسالة Google الأصلية بالأسفل.",
    };
    return NextResponse.json(res);
  }
}
