# 🔥 دليل استخدام وربط Google Firebase (قاعدة بيانات حية مجانية)
## مشروع حُرّاس المياه – ابتكري الحل

---

## 🎯 لماذا Google Firebase؟
- **مجاني 100%:** خدمة رسمية من Google عبر Cloud Firestore.
- **قاعدة بيانات حية (Realtime):** أي طالبة تدخل من أي جهاز في العالم ترسل فكرتها فوراً وتظهر لجميع المستخدمين وللمشرفين في نفس اللحظة.
- **بدون خادم معقد (Serverless):** يعمل مباشرة مع GitHub Pages أو Firebase Hosting.

---

## 🚀 طريقة التفعيل في 3 دقائق فقط

### 1. إنشاء المشروع في Google Firebase
1. افتح الرابط: [https://console.firebase.google.com](https://console.firebase.google.com)
2. انقر **Add project** (إضافة مشروع) باسم: `Water-Guardians`
3. من القائمة الجانبية: **Build → Firestore Database**
4. انقر **Create database** واختَر: **Start in test mode** ثم اختر المنطقة (مثال: `eur3` أو `nam5`).

### 2. نسخ مفاتيح المشروع (firebaseConfig)
1. من أعلى القائمة الجانبية انقر على علامة الترس ⚙️ (**Project settings**).
2. في الأسفل في قسم **Your apps** انقر على أيقونة الويب `</>`.
3. اكتب اسم التطبيق: `Water Guardians Web` واضغط تسجيل.
4. ستظهر لك شاشة فيها كود مثل هذا:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD-xxxxxxxxxxxxxx",
  authDomain: "water-guardians-xxxx.firebaseapp.com",
  projectId: "water-guardians-xxxx",
  storageBucket: "water-guardians-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxxxxxxxxx"
};
```

### 3. التفعيل الفوري في تطبيقك
لديك خياران سهلان للغاية:

* **الخيار الأول (من لوحة الإدارة بضغطة زر):**
  1. افتح التطبيق وادخل لوحة الإدارة (`admin` / `admin123`).
  2. افتح تبويب **🔥 Google Firebase**.
  3. الصق كود الـ JSON واضغط **«حفظ وتفعيل إعدادات Firebase»**.
  4. مبروك! التطبيق متصل بقاعدة بيانات جوجل الحية فوراً!

* **الخيار الثاني (تعديل ملف `public/firebase-config.js`):**
  - الصق القيم داخل كائن `FIREBASE_DEFAULT_CONFIG` وسيعمل تلقائياً مع الجميع على GitHub.

---

## 🌐 نشر الموقع مجاناً على Google Firebase Hosting

إذا أردت استضافة الموقع على رابط مجاني فائق السرعة من جوجل (`.web.app`):
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```
الملفات جاهزة ومضبوطة مسبقاً في `firebase.json` و `firestore.rules`.
