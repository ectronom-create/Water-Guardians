/**
 * supabase-client.js
 * عميل Supabase المباشر للواجهة الأمامية
 * يتيح الاتصال المباشر بقاعدة بيانات Supabase الحية بدون الحاجة لأي سيرفر وسيط!
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

  // تسجيل طالبة جديدة
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

  // استرجاع قائمة الطالبات
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

  // حفظ ابتكار جديد
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

  // استرجاع الابتكارات
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

  // تحديث ابتكار
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

  // حذف ابتكار
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

  // تحديث طالبة
  async updateParticipant(id, fields) {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('participants')
        .update(fields)
        .eq('id', id);
      return !error;
    } catch (e) {
      return false;
    }
  },

  // حذف طالبة
  async deleteParticipant(id) {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('participants')
        .delete()
        .eq('id', id);
      return !error;
    } catch (e) {
      return false;
    }
  }
};
