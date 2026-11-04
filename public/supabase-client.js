/**
 * supabase-client.js
 * عميل Supabase السحابي المباشر للواجهة الأمامية
 * يعمل كقاعدة بيانات لايف مشتركة لجميع المستخدمين في العالم
 */

const SUPABASE_URL = 'https://naomjwwihpcuwfjlkzgz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Tcs1kNaBTXClVbs-quaK8g_k9EfU_Vt';

window.WG_Supabase = {
  client: null,
  isLive: false,

  init() {
    try {
      if (typeof supabase !== 'undefined' && supabase.createClient) {
        this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        this.isLive = true;
        console.log('⚡ تم الاتصال المباشر بقاعدة بيانات Supabase السحابية بنجاح!');
        return true;
      }
    } catch (e) {
      console.warn('⚠️ تنبيه Supabase:', e.message);
      this.isLive = false;
    }
    return false;
  },

  // 1. جلب الأسئلة المفعلة للطالبات مباشرة من Supabase السحابي
  async getActiveQuestions(stage = 1) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('questions')
        .select('*')
        .eq('stage', stage)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Supabase getActiveQuestions error:', e);
      return null;
    }
  },

  // 2. جلب كل الأسئلة للوحة الإدارة
  async getAllQuestions() {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('questions')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Supabase getAllQuestions error:', e);
      return null;
    }
  },

  // 3. إضافة وتعديل سؤال
  async upsertQuestion(q) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('questions')
        .upsert(q)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Supabase upsertQuestion error:', e);
      return null;
    }
  },

  // 4. تغيير تفعيل السؤال
  async toggleQuestionActive(id, newStatus) {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('questions')
        .update({ is_active: Boolean(newStatus) })
        .eq('id', id);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // 5. حذف سؤال
  async deleteQuestion(id) {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('questions')
        .delete()
        .eq('id', id);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // 6. تسجيل طالبة جديدة
  async saveParticipant(data) {
    if (!this.client) return null;
    try {
      const { data: res, error } = await this.client
        .from('participants')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return res;
    } catch (e) {
      console.error('Supabase saveParticipant error:', e);
      return null;
    }
  },

  // 7. استرجاع قائمة الطالبات
  async getParticipants() {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('participants')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  },

  // 8. حفظ ابتكار جديد
  async saveInnovation(data) {
    if (!this.client) return null;
    try {
      const { data: res, error } = await this.client
        .from('innovations')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return res;
    } catch (e) {
      console.error('Supabase saveInnovation error:', e);
      return null;
    }
  },

  // 9. استرجاع الابتكارات
  async getInnovations() {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('innovations')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  },

  // 10. جلب كتالوج الابتكارات
  async getCatalog() {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('innovations_catalog')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  },

  // 11. تحديث ابتكار
  async updateInnovation(id, fields) {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('innovations')
        .update(fields)
        .eq('id', id);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // 12. حذف ابتكار
  async deleteInnovation(id) {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('innovations')
        .delete()
        .eq('id', id);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // 13. فحص صحة الداتابيز
  async checkHealth() {
    if (!this.client) return null;
    try {
      const { count: qCount, error: qErr } = await this.client
        .from('questions')
        .select('*', { count: 'exact', head: true });
      const { count: pCount } = await this.client
        .from('participants')
        .select('*', { count: 'exact', head: true });
      const { count: iCount } = await this.client
        .from('innovations')
        .select('*', { count: 'exact', head: true });
      
      if (qErr) throw qErr;
      return {
        status: 'healthy',
        database: 'Supabase Cloud (PostgreSQL Live)',
        operational: true,
        counts: {
          questions: qCount,
          participants: pCount,
          innovations: iCount
        }
      };
    } catch (e) {
      return { status: 'error', error: e.message };
    }
  }
};
