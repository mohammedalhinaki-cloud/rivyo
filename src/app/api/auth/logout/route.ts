/** تسجيل الخروج: حذف كوكي الجلسة فقط (رموز Google تبقى للربط القائم إن عاد المستخدم) */
import { NextRequest, NextResponse } from "next/server";
import { baseUrlFromRequest } from "@/lib/urls";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const baseUrl = baseUrlFromRequest(req);
  const res = NextResponse.redirect(`${baseUrl}/`);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const GET = handle;
export const POST = handle;
