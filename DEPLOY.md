# 🌊 حُرّاس المياه – دليل النشر السحابي الكامل
## Water Guardians – Cloud Deployment Guide (Railway + Supabase)

---

## 🎯 الهدف
نشر التطبيق على الإنترنت بحيث يستطيع **جميع المستخدمين** استخدام نفس قاعدة البيانات المشتركة (Live Database).

---

## ⚡ الخطوات الكاملة

### الخطوة 1 – إنشاء قاعدة بيانات Supabase (مجانية)

1. اذهب إلى [https://supabase.com](https://supabase.com) وسجّل دخولاً مجانياً
2. انقر **New Project** وأدخل اسماً للمشروع (مثل: `water-guardians`)
3. اختر كلمة مرور قوية للقاعدة واحتفظ بها
4. بعد إنشاء المشروع، اذهب إلى:
   - **Settings** → **Database** → انسخ **Connection String** (URI format)
   - يبدو هكذا: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres`
5. هذا هو قيمة `DATABASE_URL` التي ستحتاجها لاحقاً

### الخطوة 2 – رفع الكود على GitHub

```bash
git add .
git commit -m "Add cloud-ready PostgreSQL server (server-pg.js)"
git push origin main
```

### الخطوة 3 – نشر على Railway (مجاني)

1. اذهب إلى [https://railway.app](https://railway.app) وسجّل دخولاً بـ GitHub
2. انقر **New Project** → **Deploy from GitHub repo**
3. اختر مستودع `Water-Guardians`
4. في إعدادات المشروع، أضف **Environment Variables**:

| المتغير | القيمة |
|---------|--------|
| `DATABASE_URL` | رابط Supabase الذي نسخته في الخطوة 1 |
| `SESSION_SECRET` | أي نص عشوائي طويل (مثل: `wg-secret-2024-oman-green-future`) |
| `NODE_ENV` | `production` |
| `PUBLIC_URL` | رابط تطبيقك على Railway (يظهر بعد النشر) |

5. تأكد أن **Start Command** هو: `node server-pg.js`
6. Railway سيبدأ النشر تلقائياً! ✅

### الخطوة 4 – التحقق من عمل التطبيق

- افتح رابط Railway المُنشأ (مثل: `https://water-guardians-production.up.railway.app`)
- اختبر التسجيل والمشاركة من جهاز آخر
- ادخل لوحة الإدارة: `username: admin` / `password: admin123`
- انقر **"🔍 فحص الداتابيز"** للتأكد من الاتصال بـ Supabase

---

## 🔧 للتشغيل المحلي (بدون Supabase)

```bash
# استخدم الملف الأصلي الذي يستخدم SQLite
node server.js
```

## 🌍 للتشغيل السحابي (مع Supabase)

```bash
# أنشئ ملف .env في مجلد المشروع
echo "DATABASE_URL=postgresql://..." > .env

# ثم شغّل
node server-pg.js
```

---

## 📁 هيكل الملفات

```
water-guardians/
├── server.js          ← للتشغيل المحلي (SQLite)
├── server-pg.js       ← للنشر السحابي (PostgreSQL) ✅
├── database.js        ← طبقة SQLite المحلية
├── database-pg.js     ← طبقة PostgreSQL السحابية ✅
├── default_data.json  ← البيانات الافتراضية (أسئلة + ابتكارات)
├── .env.example       ← مثال متغيرات البيئة
├── package.json
└── public/
    └── index.html     ← الواجهة الكاملة (All-in-One)
```

---

## 🔐 بيانات الدخول الافتراضية

| الدور | اسم المستخدم | كلمة المرور |
|-------|-------------|------------|
| مشرف | `admin` | `admin123` |

> **⚠️ تنبيه:** غيّري كلمة المرور بعد أول دخول من لوحة الإدارة في بيئة الإنتاج.

---

## 📊 مقارنة وضعي التشغيل

| الميزة | محلي (SQLite) | سحابي (PostgreSQL) |
|--------|--------------|-------------------|
| قاعدة البيانات | ملف `.db` محلي | Supabase مشترك |
| يعمل بدون إنترنت | ✅ | ❌ |
| متعدد المستخدمين | ❌ | ✅ |
| بيانات مشتركة | ❌ | ✅ |
| متاح للعموم | ❌ | ✅ |
| تكلفة | مجاني | مجاني (ضمن حدود Supabase) |

---

## 🆘 استكشاف الأخطاء

**خطأ: `ECONNREFUSED` أو `SSL SYSCALL EOF`**
→ تأكدي أن `DATABASE_URL` صحيح في متغيرات Railway

**خطأ: `relation does not exist`**
→ الجداول تُنشأ تلقائياً عند أول تشغيل، انتظري 30 ثانية وحاولي مجدداً

**الموقع يفتح لكن API لا تعمل**
→ تحققي من Logs في Railway وشاهدي رسائل الخطأ
