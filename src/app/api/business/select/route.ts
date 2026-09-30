/**
 * اختار المستخدم نشاطه التجاري (الموقع) — يُخزن في business_locations مع is_selected.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { requireDb } from "@/lib/db";
import { isValidResourceName } from "@/lib/google/business-profile";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  let body: { accountName?: string; locationName?: string; displayName?: string; address?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const accountName = String(body.accountName ?? "").trim();
  const locationName = String(body.locationName ?? "").trim();
  const displayName = String(body.displayName ?? "").trim().slice(0, 200);
  const address = String(body.address ?? "").trim().slice(0, 300);

  if (!isValidResourceName(accountName, "account")) {
    return NextResponse.json({ error: "accountName غير صالح" }, { status: 400 });
  }
  if (!isValidResourceName(locationName, "location")) {
    return NextResponse.json({ error: "locationName غير صالح" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "اسم النشاط التجاري مطلوب" }, { status: 400 });
  }

  try {
    const db = requireDb();
    const now = new Date().toISOString();
    const { data: loc, error } = await db
      .from("business_locations")
      .upsert(
        {
          user_id: uid,
          google_account_name: accountName,
          google_location_name: locationName,
          display_name: displayName,
          address: address || null,
          is_selected: true,
          updated_at: now,
        },
        { onConflict: "user_id,google_location_name" },
      )
      .select("id")
      .single();
    if (error || !loc) {
      return NextResponse.json({ error: `خطأ من قاعدة البيانات: ${error?.message ?? "غير معروف"}` }, { status: 500 });
    }
    // موقع واحد مختار في كل مرة
    await db.from("business_locations").update({ is_selected: false }).eq("user_id", uid).neq("id", loc.id as string);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
