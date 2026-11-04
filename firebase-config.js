/**
 * firebase-config.js
 * إعداد وتهيئة Google Firebase (Cloud Firestore & Storage)
 * يدعم كلاً من العمل المباشر السحابي عبر SDK والعمل الاحتياطي
 */

// إعدادات مشروع Firebase (يمكن تحديثها بمفاتيح مشروعك من كونسول جوجل)
window.FIREBASE_DEFAULT_CONFIG = {
  apiKey: "AIzaSyDummyKeyForWaterGuardiansOman2024",
  authDomain: "water-guardians-oman.firebaseapp.com",
  projectId: "water-guardians-oman",
  storageBucket: "water-guardians-oman.appspot.com",
  messagingSenderId: "109876543210",
  appId: "1:109876543210:web:abcdef1234567890"
};

// فحص وجود إعدادات مخصصة محفوظة في المتصفح أو بيئة العمل
function getFirebaseConfig() {
  const saved = localStorage.getItem('wg_firebase_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  return window.FIREBASE_DEFAULT_CONFIG;
}

// كائن خدمة Firebase للبرنامج
window.WG_Firebase = {
  initialized: false,
  app: null,
  db: null,

  async init(customConfig = null) {
    const config = customConfig || getFirebaseConfig();
    try {
      if (typeof firebase !== 'undefined' && firebase.initializeApp) {
        if (!firebase.apps || firebase.apps.length === 0) {
          this.app = firebase.initializeApp(config);
        } else {
          this.app = firebase.apps[0];
        }
        this.db = firebase.firestore();
        this.initialized = true;
        console.log('🔥 تم الاتصال بنجاح مع Google Firebase Firestore');
        return true;
      }
    } catch (err) {
      console.warn('⚠️ تنبيه Firebase:', err.message);
      this.initialized = false;
      return false;
    }
    return false;
  },

  // حفظ طالبة جديدة
  async saveParticipant(data) {
    if (!this.initialized) return null;
    try {
      const res = await this.db.collection('participants').add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return res.id;
    } catch (e) {
      console.error('Firebase saveParticipant error:', e);
      return null;
    }
  },

  // استرجاع كل الطالبات لحظياً (Live Realtime Sync)
  async getParticipants() {
    if (!this.initialized) return null;
    try {
      const snap = await this.db.collection('participants').orderBy('createdAt', 'desc').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      return null;
    }
  },

  // حفظ ابتكار جديد
  async saveInnovation(data) {
    if (!this.initialized) return null;
    try {
      const res = await this.db.collection('innovations').add({
        ...data,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return res.id;
    } catch (e) {
      console.error('Firebase saveInnovation error:', e);
      return null;
    }
  },

  // استرجاع الابتكارات
  async getInnovations() {
    if (!this.initialized) return null;
    try {
      const snap = await this.db.collection('innovations').orderBy('submittedAt', 'desc').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      return null;
    }
  },

  // تحديث حالة ابتكار (تقييم / تمييز)
  async updateInnovation(id, fields) {
    if (!this.initialized) return false;
    try {
      await this.db.collection('innovations').doc(id).update(fields);
      return true;
    } catch (e) {
      return false;
    }
  },

  // حذف ابتكار
  async deleteInnovation(id) {
    if (!this.initialized) return false;
    try {
      await this.db.collection('innovations').doc(id).delete();
      return true;
    } catch (e) {
      return false;
    }
  },

  // تحديث طالبة
  async updateParticipant(id, fields) {
    if (!this.initialized) return false;
    try {
      await this.db.collection('participants').doc(id).update(fields);
      return true;
    } catch (e) {
      return false;
    }
  },

  // حذف طالبة
  async deleteParticipant(id) {
    if (!this.initialized) return false;
    try {
      await this.db.collection('participants').doc(id).delete();
      return true;
    } catch (e) {
      return false;
    }
  }
};
