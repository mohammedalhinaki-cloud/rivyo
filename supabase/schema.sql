-- ============================================================
-- Rivyo — مخطط قاعدة البيانات (PostgreSQL / Supabase)
-- ============================================================
-- مشروع Supabase مستقل تمامًا خاص بـ Rivyo.
-- ممنوع تنفيذ هذا الملف على أي مشروع Supabase يخص منصة MAAOUN.
--
-- مبادئ التصميم:
--  * لا كلمات مرور إطلاقًا — الدخول عبر Google OAuth الرسمي فقط.
--  * رموز Google (refresh/access tokens) تُخزن مشفرة (AES-256-GCM)
--    وتُقرأ/تُكتب من السيرفر فقط (service_role) — الواجهة لا تراها أبدًا.
--  * RLS مفعّل على كل الجداول ولا توجد أي سياسة للـ anon/authenticated،
--    أي أن الوصول الوحيد هو عبر service_role من كود السيرفر.
--  * التصميم مهيأ للتوسع المستقبلي (الردود الذكية، التحليل، الاشتراكات)
--    دون تعقيد الـ MVP.
-- ============================================================

create extension if not exists "pgcrypto";

-- دالة تحديث updated_at تلقائيًا
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 1) users — مستخدمو Rivyo (هويتهم من Google OAuth فقط)
-- ------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  google_sub  text not null unique,            -- معرّف حساب Google الدائم (openid sub)
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2) google_connections — رموز OAuth لمستخدم واحد (مشفرة)
-- ------------------------------------------------------------
create table if not exists public.google_connections (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique references public.users(id) on delete cascade,
  google_sub              text not null,
  email                   text,
  scope                   text not null default '',
  refresh_token_enc       text not null,                 -- AES-256-GCM — لا يُقرأ إلا من السيرفر
  access_token_enc        text,                          -- AES-256-GCM — مؤقت ويُجدَّد تلقائيًا
  access_token_expires_at timestamptz,
  token_obtained_at       timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger trg_google_connections_updated_at before update on public.google_connections
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) google_accounts — حسابات Business Profile التي يملكها المستخدم
-- ------------------------------------------------------------
create table if not exists public.google_accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  google_account_name text not null,            -- "accounts/{accountId}"
  account_name       text,                     -- الاسم المعروض
  account_type       text,                     -- PERSONAL / LOCATION_GROUP / ORGANIZATION / USER_GROUP
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, google_account_name)
);
create trigger trg_google_accounts_updated_at before update on public.google_accounts
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4) business_locations — أنشطة المستخدم التجارية (المواقع)
-- ------------------------------------------------------------
create table if not exists public.business_locations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  google_account_name  text not null,                        -- "accounts/{accountId}"
  google_location_name text not null,                        -- "accounts/{accountId}/locations/{locationId}"
  display_name         text not null,
  address              text,
  is_selected          boolean not null default false,       -- الموقع المختار حاليًا
  raw                  jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, google_location_name)
);
create index if not exists idx_business_locations_user_selected
  on public.business_locations (user_id, is_selected);
create trigger trg_business_locations_updated_at before update on public.business_locations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5) reviews — التقييمات الحقيقية المزامنة من Google
-- ------------------------------------------------------------
create table if not exists public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  location_id         uuid not null references public.business_locations(id) on delete cascade,
  google_review_name  text not null,               -- "accounts/{a}/locations/{l}/reviews/{reviewId}"
  google_review_id    text not null,
  reviewer_name       text,
  reviewer_photo_url  text,
  reviewer_is_anonymous boolean not null default false,
  star_rating         text,                        -- ONE..FIVE
  rating              integer check (rating between 0 and 5),
  comment             text,
  review_created_at   timestamptz,                 -- createTime من Google
  review_updated_at   timestamptz,                 -- updateTime من Google
  reply_comment       text,                        -- الرد المنشور حاليًا على Google
  reply_updated_at    timestamptz,
  raw                 jsonb,                       -- كائن التقييم الأصلي من Google
  synced_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (location_id, google_review_id)
);
create index if not exists idx_reviews_user_created
  on public.reviews (user_id, review_created_at desc);
create index if not exists idx_reviews_location
  on public.reviews (location_id);
create trigger trg_reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6) generated_replies — الردود المولدة/المنشورة (للمرحلة الثانية: Gemini)
-- ------------------------------------------------------------
create table if not exists public.generated_replies (
  id              uuid primary key default gen_random_uuid(),
  review_id       uuid not null references public.reviews(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  model           text,                            -- نموذج Gemini المستخدم (من GEMINI_MODEL)
  tone            text,                            -- friendly / formal / concise / warm
  source          text not null default 'ai',      -- ai / manual
  content         text not null,
  status          text not null default 'proposed' check (status in ('proposed', 'edited', 'published', 'discarded')),
  published_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_generated_replies_review
  on public.generated_replies (review_id);

-- ------------------------------------------------------------
-- 7) settings — إعدادات المستخدم (أسلوب الرد، وضع النشر)
-- ------------------------------------------------------------
-- الافتراضي: الرد اليدوي — لا يُنشر أي رد تلقائيًا إلا بتفعيل صريح من المستخدم.
create table if not exists public.settings (
  user_id               uuid primary key references public.users(id) on delete cascade,
  reply_mode            text not null default 'manual' check (reply_mode in ('manual', 'auto')),
  tone                  text not null default 'friendly' check (tone in ('friendly', 'formal', 'concise', 'warm')),
  custom_instructions   text,                      -- تعليمات خاصة بالنشاط تُمرر لـ Gemini
  auto_reply_min_rating integer not null default 4 check (auto_reply_min_rating between 1 and 5),
  language              text not null default 'ar',
  updated_at            timestamptz not null default now()
);
create trigger trg_settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 8) usage_events — قياس الاستخدام (أساس نظام الاشتراك المستقبلي)
-- ------------------------------------------------------------
create table if not exists public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  event_type    text not null,                     -- ai_generate / reply_publish / sync / ...
  model         text,
  tokens_in     integer,
  tokens_out    integer,
  tokens_total  integer,
  meta          jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_usage_events_user_created
  on public.usage_events (user_id, created_at desc);

-- ------------------------------------------------------------
-- 9) subscriptions — الاشتراكات (تصميم مستقبلي — لا يُستخدم في MVP)
--    السعر المخطط: 9 ريال شهريًا. جاهز للربط بمزود دفع لاحقًا.
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.users(id) on delete cascade,
  plan_code                text not null default 'monthly_9_sar',
  status                   text not null default 'inactive'
                           check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  provider                 text,                   -- مزود الدفع المستقبلي
  provider_customer_id     text,
  provider_subscription_id text,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_subscriptions_user
  on public.subscriptions (user_id);
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================
-- الأمان: تفعيل RLS على كل الجداول + إلغاء أي وصول للـ anon/authenticated.
-- الوصول الوحيد هو service_role من كود السيرفر (Server-side فقط).
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'google_connections', 'google_accounts', 'business_locations',
    'reviews', 'generated_replies', 'settings', 'usage_events', 'subscriptions'
  ]
  loop
    execute format('alter table if exists public.%I enable row level security;', t);
    execute format('drop policy if exists "public_access" on public.%I;', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
