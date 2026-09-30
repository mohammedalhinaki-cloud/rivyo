# Rivyo

**رد على تقييمات Google Maps تلقائيًا بالذكاء الاصطناعي.**

مشروع SaaS مستقل تمامًا يعمل على النطاق الفرعي `reviews.maaoun.com` (نطاق MAAOUN **كـ subdomain فقط** — لا نطاق جديد، ولا أي تعديل على مشاريع منصة MAAOUN).

---

## حالة المشروع — بصراحة كاملة

هذا المستودع في **المرحلة الأولى**: بنية اختبار التكامل الحقيقي مع Google Business Profile API.

**المبني والجاهز:**
- تسجيل دخول Google OAuth 2.0 حقيقي (Authorization Code + PKCE) — server-side بالكامل
- تخزين رموز Google مشفرة (AES-256-GCM) في Supabase مستقل + تجديد تلقائي للرموز
- قراءة الحسابات → المواقع → التقييمات الحقيقية عبر Google APIs الرسمية
- إرسال رد حقيقي على تقييم (PUT `…/reviews/{id}/reply`) + تحديثه + حذفه + استعادة الأصلي
- صفحة الاختبار `/admin/google-test` التي تعرض PASS/FAIL لكل خطوة مع رسالة الخطأ الأصلية من Google
- صفحة هبوط عربية RTL + اختيار النشاط التجاري + عرض التقييمات الحقيقية

**غير المبني بعد (مقصود — يُبنى بعد نجاح الاختبار الفعلي):**
- توليد الردود عبر Gemini (متغيرا `GEMINI_API_KEY` و`GEMINI_MODEL` جاهزان في `.env.example`)
- لوحة تحكم كاملة، الإعدادات، الرد التلقائي، التحليلات، الاشتراكات

> **لا توجد أي بيانات تجريبية (Mock Data) في هذا المشروع.** كل ما يظهر في الواجهة يأتي من نداءات حقيقية إلى Google، أو يظهر كرسالة خطأ أصلية.

---

## الاستقلالية عن منصة MAAOUN

| العنصر | الحالة |
|---|---|
| Repository | مستقل: `mohammedalhinaki-cloud/rivyo` |
| Supabase Project | مستقل (يجب إنشاء مشروع جديد خاص بـ Rivyo) |
| Google Cloud Project | مستقل (يجب إنشاء مشروع جديد خاص بـ Rivyo) |
| مفاتيح API ومتغيرات البيئة | مستقلة بالكامل |
| قاعدة البيانات | مستقلة (`supabase/schema.sql`) |
| Deployment | مستقل (Vercel project منفصل) |
| النطاق | `reviews.maaoun.com` — subdomain من نطاق MAAOUN الحالي فقط |

**ممنوع:** استخدام أي مفاتيح أو مشروع أو Repository يخص منصة MAAOUN.

---

## متطلبات Google — اقرأ هذا قبل أي شيء

استخدام Google Business Profile APIs يتطلب أكثر من مجرد تفعيل API. وفق [الوثائق الرسمية](https://developers.google.com/my-business/content/prereqs):

1. **حساب Google** تملك/تدير به نشاطًا تجاريًا موثّقًا (verified) و**نشط منذ 60+ يومًا**.
2. **موقع إلكتروني** للنشاط التجاري مدرج على الملف التجاري.
3. **مشروع Google Cloud جديد** خاص بـ Rivyo.
4. **تقديم طلب وصول رسمي** عبر [نموذج Google](https://support.google.com/business/contact/api_default) واختيار "Application for Basic API Access" — المراجعة تستغرق **حتى 14 يومًا**.
5. طريقة التحقق من القبول: من Cloud Console → IAM & Admin → Quotas: إذا كانت حصة Business Profile APIs تساوي **0 QPM فلم يُقبَل بعد**، وإذا صارت **300 QPM فقد قُبل الطلب**.

**بدون الموافقة، نداءات Business Profile APIs ستفشل** — وسيظهر لك الخطأ الأصلي من Google في `/admin/google-test` (هذا مقصود: نريد الحقيقة لا الوهم).

ملاحظات رسمية إضافية:
- قراءة التقييمات والرد عليها تعمل **فقط للمواقع الموثّقة (verified)**.
- الرد على التقييم: `PUT …/reviews/{id}/reply` ينشئ الرد إن لم يوجد ويحدّثه إن وُجد، والحذف عبر `DELETE …/reviews/{id}/reply` — [المرجع الرسمي](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews).
- الصلاحية المطلوبة: `https://www.googleapis.com/auth/business.manage`.
- لأصحاب Google Workspace: يجب أن يكون Business Profile مفعّلًا لحسابك وإلا ظهر خطأ 403.

---

## خطوات الإعداد

### ١) Google Cloud Project (مستقل)

1. أنشئ مشروعًا جديدًا في [Google Cloud Console](https://console.cloud.google.com/) باسم مثل `rivyo`.
2. فعّل APIs السبعة من [API Library](https://console.cloud.google.com/apis/library):
   - Google My Business API
   - My Business Account Management API
   - My Business Lodging API
   - My Business Place Actions API
   - My Business Notifications API
   - My Business Verifications API
   - My Business Business Information API
3. [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent):
   - User type: External
   - App name مثل `Rivyo`، بريد دعم، ونطاق `maaoun.com` في Authorized domains
   - أضف نفسك (و أي حساب تجريبي) في **Test users** — ضروري قبل نشر التطبيق للإنتاج
   - الصلاحية `.../auth/business.manage` تُطلب تلقائيًا عند تسجيل الدخول
   - للإنتاج لاحقًا: يحتاج التطبيق تمرير **verification** من Google لأنها صلاحية حساسة
4. [Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID**:
   - Type: **Web application**
   - **Authorized redirect URIs** — أضف القيمة الدقيقة التي تعرضها صفحة `/admin/google-test` (مثل `http://localhost:3000/api/auth/google/callback` للتجربة المحلية، و`https://reviews.maaoun.com/api/auth/google/callback` للإنتاج)
5. احتفظ بـ Client ID و Client Secret (server-side فقط).

### ٢) Supabase Project (مستقل)

1. أنشئ [مشروع Supabase جديدًا](https://supabase.com/dashboard) خاصًا بـ Rivyo — **وليس مشروع MAAOUN**.
2. افتح SQL Editor ونفّذ كامل ملف `supabase/schema.sql`.
3. من Settings → API خذ: `Project URL` و`service_role` key.

### ٣) متغيرات البيئة

```bash
cp .env.example .env.local
npm run keys   # يولّد SESSION_SECRET و ENCRYPTION_KEY
```

ثم عبّئ في `.env.local`:
```
GOOGLE_CLIENT_ID=…            # من خطوة Google Cloud
GOOGLE_CLIENT_SECRET=…
SUPABASE_URL=…                # من مشروع Supabase المستقل
SUPABASE_SERVICE_ROLE_KEY=…
SESSION_SECRET=…              # من npm run keys
ENCRYPTION_KEY=…              # من npm run keys
ADMIN_EMAILS=you@example.com  # بريدك — للوصول إلى /admin/google-test
# NEXT_PUBLIC_APP_URL=https://reviews.maaoun.com   # في الإنتاج فقط
```

### ٤) التشغيل

```bash
npm install
npm run dev
```

افتح `http://localhost:3000`.

### ٥) إجراء الاختبار الحقيقي

1. افتح `/admin/google-test`.
2. تحقق من القسم ١ (حالة البيئة) — كل شيء يجب أن يكون PASS.
3. سجّل الدخول عبر Google (القسم ٢) بحساب يملك نشاطًا تجاريًا.
4. اضغط **تشغيل الفحوصات (قراءة فقط)** — راجع نتائج PASS/FAIL الخمس.
5. إذا نجحت القراءة: نفّذ **اختبار الرد الحقيقي** (القسم ٤): إنشاء → تحديث → حذف/استعادة، مع التحقق بعد كل خطوة.
6. أي فشل يظهر برسالة Google الأصلية كاملة — لا شيء مخفي.

**معيار النجاح:** الخطوات الثمانية كلها PASS مع تأكيد ظهور الرد فعلًا في Google (وأفضل تأكيد: افتح صفحة نشاطك على Google وسترى الرد).

---

## الأمان

- **لا scraping ولا Selenium** — Google APIs الرسمية فقط.
- **لا طلب كلمة مرور Google إطلاقًا** — OAuth الرسمي فقط.
- `GOOGLE_CLIENT_SECRET` و`GEMINI_API_KEY` و`SUPABASE_SERVICE_ROLE_KEY` لا تُستخدم إلا في كود السيرفر (Route Handlers / Server Components) ولا تُرسل للمتصفح أبدًا.
- رموز Google تُخزن مشفرة AES-256-GCM (`ENCRYPTION_KEY`).
- جلسة المستخدم: كوكي HttpOnly موقّع HMAC-SHA256.
- حماية CSRF في OAuth عبر `state` + PKCE (S256).
- RLS مفعّل على كل جداول Supabase ولا وصول للـ anon/authenticated.

## هيكل المشروع

```
src/
  app/
    page.tsx                       # صفحة الهبوط
    auth/error/                    # عرض أخطاء OAuth الأصلية
    choose-business/               # اختيار النشاط التجاري (حقيقي من Google)
    reviews/                       # التقييمات الحقيقية
    admin/google-test/             # صفحة اختبار التكامل (PASS/FAIL)
    api/
      auth/google/start|callback   # OAuth 2.0 + PKCE
      auth/logout
      business/select              # حفظ النشاط المختار
      admin/google-test/run        # فحوصات القراءة الخمس
      admin/google-test/reply      # إنشاء/تحديث/حذف/استعادة الرد
  lib/
    config.ts                      # فحص متغيرات البيئة (بلا إخفاء)
    env-crypto.ts                  # AES-256-GCM للرموز
    session.ts                     # جلسة موقعة
    db.ts                          # Supabase service role (سيرفر فقط)
    auth.ts                        # المستخدم الحالي + صلاحية الأدمن
    sync.ts                        # مزامنة التقييمات الحقيقية
    google/
      oauth.ts                     # Google OAuth 2.0 + PKCE
      business-profile.ts          # الحسابات/المواقع/التقييمات/الردود
      connection.ts                # تجديد الرموز تلقائيًا
      http.ts                      # إظهار أخطاء Google كما هي
supabase/schema.sql                # مخطط قاعدة البيانات المستقلة
DEPLOYMENT.md                      # النشر على reviews.maaoun.com
```

## النشر

راجع [DEPLOYMENT.md](./DEPLOYMENT.md) — إعداد Vercel + سجل DNS واحد في Cloudflare، منفصل تمامًا عن مشاريع MAAOUN الأخرى.
