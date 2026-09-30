/**
 * عميل Supabase (service role) — server-side فقط.
 * Rivyo يستخدم مشروع Supabase مستقلًا تمامًا عن منصة MAAOUN.
 * المفتاح لا يُرسل للواجهة أبدًا ولا يُستخدم في أي كود يعمل على المتصفح.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getDb(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export function requireDb(): SupabaseClient {
  const db = getDb();
  if (!db) {
    throw new Error("Supabase غير مهيأ — ضع SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env.local (مشروع Supabase مستقل خاص بـ Rivyo)");
  }
  return db;
}
