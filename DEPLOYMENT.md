# النشر على reviews.maaoun.com

الهدف: نشر Rivyo على النطاق الفرعي `reviews.maaoun.com` **دون شراء نطاق جديد، ودون لمس أي مشروع أو إعداد يخص منصة MAAOUN**.

> الاستقلال هنا على مستوى الكود والبيانات والبنية. النطاق subdomain فقط من maaoun.com — وهذا متوافق مع نمط MAAOUN نفسه (مثل rahaf.maaoun.com وoud.maaoun.com).

---

## ١) Vercel (موصى به)

1. أنشئ **مشروع Vercel جديدًا منفصلًا** باسم `rivyo` واربطه بمستودع `mohammedalhinaki-cloud/rivyo`.
   - لا تستورد أي مشروع Vercel يخص MAAOUN.
2. Framework: Next.js (يُكتشف تلقائيًا). لا حاجة لأي إعداد Build إضافي.
3. أضف متغيرات البيئة (Production):

   | المتغير | القيمة |
   |---|---|
   | `NEXT_PUBLIC_APP_URL` | `https://reviews.maaoun.com` |
   | `GOOGLE_CLIENT_ID` | من Google Cloud الخاص بـ Rivyo |
   | `GOOGLE_CLIENT_SECRET` | من Google Cloud الخاص بـ Rivyo |
   | `SUPABASE_URL` | من مشروع Supabase المستقل |
   | `SUPABASE_SERVICE_ROLE_KEY` | من مشروع Supabase المستقل |
   | `SESSION_SECRET` | من `npm run keys` |
   | `ENCRYPTION_KEY` | من `npm run keys` |
   | `ADMIN_EMAILS` | بريدك |
   | `GEMINI_API_KEY` | (المرحلة الثانية) |
   | `GEMINI_MODEL` | `gemini-flash-latest` |

4. Deploy.

## ٢) النطاق الفرعي في Cloudflare (سجل واحد فقط)

**تنبيه: لا تعدّل أي سجل DNS موجود يخص مشاريع MAAOUN. تضيف سجلًا جديدًا واحدًا فقط.**

في Cloudflare → DNS لمنطقة `maaoun.com`:

| Type | Name | Content | Proxy |
|---|---|---|---|
| `CNAME` | `reviews` | `cname.vercel-dns.com` | مبدئيًا **DNS only (رمادي)** — أو Proxied إن رغبت، مع التأكد من عمل Vercel خلف Cloudflare |

خطوات ربط النطاق في Vercel:
1. في مشروع Rivyo على Vercel: Settings → Domains → Add → `reviews.maaoun.com`.
2. اتبع تعليمات سجل CNAME أعلاه.
3. انتظر انتشار DNS ثم تأكد من: `https://reviews.maaoun.com` يفتح صفحة Rivyo.

> بديل إن كنت تفضل استضافة MAAOUN الحالية كوكيل: يمكن توجيه subdomain عبر Worker/Proxy موجود، لكن الأبسط والأنظف للعزل هو سجل CNAME مستقل إلى Vercel كما هو موضح أعلاه — وهذا لا يمس بقية السجلات إطلاقًا.

## ٣) تحديث Google OAuth للإنتاج

في Google Cloud Console → Credentials → OAuth client الخاص بـ Rivyo:

- أضف إلى **Authorized redirect URIs**:
  ```
  https://reviews.maaoun.com/api/auth/google/callback
  ```
  (يجب أن يطابق حرفيًا — صفحة `/admin/google-test` تعرض دائمًا الـ Redirect URI المستخدم حاليًا.)
- في **OAuth consent screen**:
  - Authorized domain: `maaoun.com`
  - للانطلاق العام لاحقًا: اضغط Publish وابدأ عملية verification (الصلاحية `business.manage` حساسة وتتطلب تمرير مراجعة Google). قبل ذلك يمكن العمل بوضع Testing مع Test users.

## ٤) قبل تسليم الإنتاج

- [ ] `/admin/google-test` يعطي PASS على كل الخطوات على نطاق الإنتاج.
- [ ] `SESSION_SECRET` و`ENCRYPTION_KEY` قيمتان جديدتان (لا تعيد استخدام قيم التطوير).
- [ ] RLS مفعل على جداول Supabase (مضمون من `schema.sql`).
- [ ] لا توجد أي قيم أسرار في الكود أو Git (تحقق: `git ls-files | xargs grep -l "SERVICE_ROLE\|CLIENT_SECRET" || echo نظيف`).

## ٥) الفصل عن مشاريع MAAOUN الأخرى — قائمة تحقق

- Repository مستقل ✓ (`mohammedalhinaki-cloud/rivyo`)
- Vercel project منفصل ✓
- Supabase project منفصل ✓
- Google Cloud project منفصل ✓
- سجل DNS واحد خاص بالنطاق الفرعي فقط ✓ (لا تعدّلات على أي سجل آخر)
- متغيرات بيئة مستقلة بالكامل ✓
