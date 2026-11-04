/**
 * supabase-client.js
 * عميل Supabase السحابي المباشر والوحيد لمنصة حُرّاس المياه
 * يدعم القراءة والكتابة اللحظية (Realtime Cloud Sync)
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
        console.log('⚡ متصل رسمياً بقاعدة بيانات Supabase السحابية الحية (Live Cloud)!');
        return true;
      }
    } catch (e) {
      console.warn('⚠️ تنبيه الاتصال بـ Supabase:', e.message);
      this.isLive = false;
    }
    return false;
  },

  // 1. جلب الأسئلة المفعلة للطالبات
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

  // 2. جلب كل الأسئلة للإدارة
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

  // 3. إضافة أو تعديل سؤال
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

  // 4. تغيير حالة تفعيل السؤال
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

  // 6. تسجيل مشاركة طالبة جديدة
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

  // 7. استرجاع بيانات مشاركة بالكود (استئناف)
  async getParticipantByCode(code) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('participants')
        .select('*')
        .eq('participation_code', code.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  },

  // 8. تحديث بيانات طالبة (نقاط، مرحلة، أوسمة)
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

  // 9. استرجاع قائمة جميع الطالبات للإدارة
  async getParticipants(search = '', school = '') {
    if (!this.client) return null;
    try {
      let query = this.client
        .from('participants')
        .select('*')
        .order('created_at', { ascending: false });

      if (school) {
        query = query.ilike('school', `%${school}%`);
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,participation_code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Supabase getParticipants error:', e);
      return null;
    }
  },

  // 10. حذف مشاركة طالبة
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
  },

  // 11. تسجيل إجابة سؤال
  async saveAnswer(participantId, questionId, answer, isCorrect, pointsEarned) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('quiz_answers')
        .insert([{
          participant_id: participantId,
          question_id: questionId,
          answer: String(answer),
          is_correct: Boolean(isCorrect),
          points_earned: pointsEarned || 0
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  },

  // 12. استرجاع إجابات طالبة معينة
  async getParticipantAnswers(participantId) {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('quiz_answers')
        .select('*')
        .eq('participant_id', participantId)
        .order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  },

  // 13. حفظ ابتكار جديد
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

  // 14. استرجاع قائمة الابتكارات للإدارة مع التصفية
  async getInnovations(search = '', type = '') {
    if (!this.client) return null;
    try {
      let query = this.client
        .from('innovations')
        .select('*, participants(name, school, grade, participation_code)')
        .order('submitted_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }
      if (search) {
        query = query.or(`innovation_name.ilike.%${search}%,problem_description.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Supabase getInnovations error:', e);
      return null;
    }
  },

  // 15. تحديث ابتكار (تقييم / تمييز / تعديل نصوص)
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

  // 16. حذف ابتكار
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

  // 17. جلب كتالوج الابتكارات المقترحة
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

  // 18. جلب بيانات لوحة الشرف (Leaderboard)
  async getLeaderboard() {
    if (!this.client) return null;
    try {
      const { data: topStudents } = await this.client
        .from('participants')
        .select('name, school, grade, quiz_score, stage_completed')
        .gt('quiz_score', 0)
        .order('quiz_score', { ascending: false })
        .limit(10);

      const { data: featuredInnos } = await this.client
        .from('innovations')
        .select('id, innovation_name, type, innovation_idea, participants(name, school)')
        .eq('is_featured', true)
        .limit(10);

      return {
        topParticipants: topStudents || [],
        featuredInnovations: (featuredInnos || []).map(i => ({
          ...i,
          student_name: i.participants ? i.participants.name : '',
          student_school: i.participants ? i.participants.school : ''
        }))
      };
    } catch (e) {
      return null;
    }
  },

  // 19. إحصائيات لوحة الإدارة
  async getStats() {
    if (!this.client) return null;
    try {
      const { count: totalParticipants } = await this.client
        .from('participants')
        .select('*', { count: 'exact', head: true });

      const { count: completedChallenge } = await this.client
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .gte('stage_completed', 3);

      const { count: totalInnovations } = await this.client
        .from('innovations')
        .select('*', { count: 'exact', head: true });

      const { data: scoreData } = await this.client
        .from('participants')
        .select('quiz_score')
        .gt('quiz_score', 0);

      let avgScore = 0;
      if (scoreData && scoreData.length) {
        avgScore = Math.round(scoreData.reduce((acc, cur) => acc + (cur.quiz_score || 0), 0) / scoreData.length);
      }

      return {
        totalParticipants: totalParticipants || 0,
        completedChallenge: completedChallenge || 0,
        totalInnovations: totalInnovations || 0,
        avgScore: avgScore || 0,
        dailyParticipants: [{ date: 'اليوم', cnt: totalParticipants || 0 }],
        innovationsByType: [
          { type: 'new', cnt: totalInnovations || 0 }
        ]
      };
    } catch (e) {
      return null;
    }
  },

  // 20. فحص صحة واتصال الداتابيز
  async checkHealth() {
    if (!this.client) return { status: 'error', error: 'العميل غير مهيأ' };
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
        database: 'Supabase PostgreSQL Cloud (Live)',
        operational: true,
        counts: {
          questions: qCount || 0,
          participants: pCount || 0,
          innovations: iCount || 0
        }
      };
    } catch (e) {
      return { status: 'error', error: e.message };
    }
  }
};
