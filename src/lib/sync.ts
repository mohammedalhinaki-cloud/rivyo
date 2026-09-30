/**
 * مزامنة التقييمات الحقيقية القادمة من Google مع قاعدة بيانات Rivyo (Supabase).
 * البيانات وحدها حقيقية — لا يوجد أي مصدر تجريبي في المشروع إطلاقًا.
 */
import { getDb } from "@/lib/db";
import { starRatingToNumber, type GbpReview } from "@/lib/google/business-profile";

export async function syncReviewsToDb(
  userId: string,
  locationId: string,
  reviews: GbpReview[],
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: "Supabase غير مهيأ" };
  if (reviews.length === 0) return { ok: true };

  const now = new Date().toISOString();
  const rows = reviews.map((r) => ({
    user_id: userId,
    location_id: locationId,
    google_review_name: r.name,
    google_review_id: r.reviewId ?? r.name.split("/").pop() ?? r.name,
    reviewer_name: r.reviewer?.isAnonymous ? null : (r.reviewer?.displayName ?? null),
    reviewer_photo_url: r.reviewer?.profilePhotoUrl ?? null,
    star_rating: r.starRating ?? null,
    rating: starRatingToNumber(r.starRating),
    comment: r.comment ?? null,
    review_created_at: r.createTime ?? null,
    review_updated_at: r.updateTime ?? null,
    reply_comment: r.reviewReply?.comment ?? null,
    reply_updated_at: r.reviewReply?.updateTime ?? null,
    raw: r,
    synced_at: now,
    updated_at: now,
  }));

  const { error } = await db.from("reviews").upsert(rows, { onConflict: "location_id,google_review_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
