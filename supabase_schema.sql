-- ======================================================================
-- مشروع حُرّاس المياه - جداول Supabase PostgreSQL (Water Guardians Schema)
-- انسخ هذا الكود بالكامل والصقه في SQL Editor في كونسول Supabase واضغط RUN
-- ======================================================================

-- 1. جدول الطالبات والمشاركات
CREATE TABLE IF NOT EXISTS public.participants (
  id BIGSERIAL PRIMARY KEY,
  participation_code TEXT UNIQUE NOT NULL,
  name TEXT,
  school TEXT,
  grade TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  quiz_score INTEGER DEFAULT 0,
  quiz_completed BOOLEAN DEFAULT FALSE,
  stage_completed INTEGER DEFAULT 0,
  badges JSONB DEFAULT '[]'::jsonb
);

-- 2. جدول إجابات الاختبار
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id BIGSERIAL PRIMARY KEY,
  participant_id BIGINT REFERENCES public.participants(id) ON DELETE CASCADE,
  question_id INTEGER,
  answer TEXT,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول الابتكارات والمشاريع الخضراء
CREATE TABLE IF NOT EXISTS public.innovations (
  id BIGSERIAL PRIMARY KEY,
  participant_id BIGINT REFERENCES public.participants(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'new',
  innovation_name TEXT,
  problem_description TEXT,
  innovation_idea TEXT,
  how_it_works TEXT,
  technology_use TEXT,
  water_saving_impact TEXT,
  expected_benefits TEXT,
  image_path TEXT,
  rating_creativity INTEGER DEFAULT 0,
  rating_environmental INTEGER DEFAULT 0,
  rating_feasibility INTEGER DEFAULT 0,
  rating_technology INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. جدول حسابات المشرفين
CREATE TABLE IF NOT EXISTS public.admin_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. جدول بنك الأسئلة
CREATE TABLE IF NOT EXISTS public.questions (
  id BIGSERIAL PRIMARY KEY,
  stage INTEGER NOT NULL DEFAULT 1,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple',
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  points INTEGER DEFAULT 15,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- 6. جدول كتالوج الابتكارات المقترحة
CREATE TABLE IF NOT EXISTS public.innovations_catalog (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  how_it_works TEXT NOT NULL,
  problem_solved TEXT NOT NULL,
  icon TEXT DEFAULT '💧',
  color TEXT DEFAULT '#2196F3',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- ======================================================================
-- إدراج حساب المشرف الافتراضي (admin / admin123)
-- ======================================================================
INSERT INTO public.admin_users (username, password_hash)
VALUES ('admin', '$2b$10$Uo2k6qGv7KzYh3W5gM6OYe9nNlI9Fj9g9g9g9g9g9g9g9g9g9g9g.')
ON CONFLICT (username) DO NOTHING;

-- ======================================================================
-- إدراج بنك الأسئلة الافتراضي المعتمد
-- ======================================================================
INSERT INTO public.questions (stage, question_text, question_type, options, correct_answer, explanation, points, is_active, sort_order)
VALUES 
(1, 'ماذا يحدث عندما نفتح عبوة المياه ولا نستهلكها بالكامل؟', 'multiple', 
 '["تُهدر المياه المتبقية وتُرمى في سلة المهملات", "تتحول المياه المتبقية تلقائياً إلى بخار مفيد", "لا يوجد أي ضرر بيئي أو هدر مالي", "تُستخدم المياه تلقائياً في ري الحدائق"]'::jsonb, 
 'تُهدر المياه المتبقية وتُرمى في سلة المهملات', 
 'عندما نفتح عبوة ولا نكملها، تضيع كميات هائلة من المياه النقية التي استهلكت طاقة وموارد في تنقيتها وتعبئتها. الحل الأمثل: احملي دائماً عبوة شخصية قابلة لإعادة التعبئة!', 15, TRUE, 1),

(1, 'موقف واقعي: شاهدتِ في فناء المدرسة صنبور مياه مفتوحاً يتدفق بقوة دون وجود أحد قربه، ما التصرف الصحيح؟', 'multiple', 
 '["أغلق الصنبور فوراً بحذر ثم أبلغ المعلمة أو الإدارة", "أتجاهله لأنه ليس مسؤوليتي المباشرة", "أنتظر حتى تأتي طالبة أخرى لتغلقه", "أصوره بهاتفي وأنصرف دون إغلاقه"]'::jsonb, 
 'أغلق الصنبور فوراً بحذر ثم أبلغ المعلمة أو الإدارة', 
 'الصنبور المفتوح يهدر ما يزيد عن 150 لتراً في الساعة الواحدة! الإغلاق الفوري هو التصرف البيئي النبيل الذي ينقذ آلاف اللترات.', 20, TRUE, 2),

(1, 'هل العبارة صحيحة أم خطأ: الصنبور الذي يقطر ببطء لا يهدر كمية تستحق الاهتمام؟', 'truefalse', 
 '["صح", "خطأ"]'::jsonb, 
 'خطأ', 
 'خطأ بالتأكيد! قطرة مياه واحدة كل ثانية تُهدر أكثر من 30 لتراً يومياً ونحو 11,000 لتر سنوياً لكل صنبور واحد في المدرسة!', 10, TRUE, 3),

(1, 'هل العبارة صحيحة أم خطأ: المياه العذبة الصالحة للشرب تمثل أقل من 1% فقط من إجمالي مياه كوكب الأرض؟', 'truefalse', 
 '["صح", "خطأ"]'::jsonb, 
 'صح', 
 'صح! معظم مياه الأرض مالحة في المحيطات أو متجمدة في القطبين، وأقل من 1% فقط متاح للشرب، لذا ترشيدها ضرورة حيوية.', 10, TRUE, 4),

(1, 'كيف يمكن تقليل هدر المياه في دورات المياه المدرسية بنسبة تصل إلى 70%؟', 'multiple', 
 '["تركيب صنابير ذكية مزودة بحساسات استشعار الحركة (IR)", "استخدام صنابير تقليدية بمقابض يدوية فقط", "إغلاق دورات المياه تماماً أثناء اليوم الدراسي", "تقليل ضغط المياه حتى يتوقف التدفق تقريباً"]'::jsonb, 
 'تركيب صنابير ذكية مزودة بحساسات استشعار الحركة (IR)', 
 'الصنابير الذكية ذات الحساسات توقف تدفق المياه فور ابتعاد اليدين، وتمنع نسيان الصنبور مفتوحاً وتوفر ما بين 50% إلى 70% من الاستهلاك!', 20, TRUE, 5),

(1, 'لماذا يُعتبر ترشيد استهلاك المياه مسؤولية الجميع؟', 'multiple', 
 '["لأن المياه ثروة ثمينة محدودة يحتاجها كل كائن حي لكوكب مستدام", "لتقليل فاتورة المياه الشهرية للمدرسة فقط", "لأن القوانين تفرض ذلك كعقوبة فقط", "لا يهم فالأمطار تعوض كل قطرة دائماً"]'::jsonb, 
 'لأن المياه ثروة ثمينة محدودة يحتاجها كل كائن حي لكوكب مستدام', 
 'المياه العذبة ثروة ثمينة وأساس الحياة، ترشيدها واجب أخلاقي ومسؤولية مشتركة لحماية الأجيال القادمة.', 15, TRUE, 6),

(1, 'كيف يمكن للتكنولوجيا والذكاء الاصطناعي (AI) المساعدة في القضاء على هدر المياه المدرسي؟', 'multiple', 
 '["تحليل أنماط التدفق وكشف التسريبات المخفية وإرسال تنبيهات فورية للمسؤولين", "منع الطلاب من شرب المياه أثناء الحصص", "استبدال المياه بالكامل بسوائل صناعية", "لا يوجد أي دور للتكنولوجيا والذكاء الاصطناعي في إدارة المياه"]'::jsonb, 
 'تحليل أنماط التدفق وكشف التسريبات المخفية وإرسال تنبيهات فورية للمسؤولين', 
 'تستطيع خوارزميات الذكاء الاصطناعي تحليل قراءات العدادات الذكية على مدار الساعة ورصد أي تدفق غير طبيعي أو تسرب غير مرئي وإشعار فريق الصيانة فوراً.', 20, TRUE, 7)
ON CONFLICT DO NOTHING;

-- ======================================================================
-- إدراج كتالوج الابتكارات الخمسة
-- ======================================================================
INSERT INTO public.innovations_catalog (title, description, how_it_works, problem_solved, icon, color, sort_order)
VALUES
('العبوات القابلة لإعادة التعبئة', 'استخدام عبوات مياه شخصية مستدامة بدلاً من فتح عبوات بلاستيكية جديدة وترك المتبقي منها.', 'تحمل الطالبة عبوتها الخاصة وتقوم بإعادة تعبئتها من محطات الشرب النقية بالمدرسة.', 'هدر عبوات المياه البلاستيكية غير المكتملة وتراكم النفايات.', '🧴', '#10B981', 1),
('الصنابير الذكية بحساسات الحركة', 'تركيب حساسات الأشعة تحت الحمراء توقف تدفق المياه تلقائياً فور إبعاد اليدين.', 'تفتح المياه فقط عند استشعار اليدين وتغلق ذاتياً خلال أجزاء من الثانية.', 'نسيان الصنابير مفتوحة أو عدم إحكام إغلاقها من الطالبات.', '🚰', '#0288D1', 2),
('نظام كشف التسرب بالموجات', 'حساسات ذكية مثبتة على الأنابيب تكتشف التسرب المخفي وترسل تنبيهاً فورياً للمسؤولين.', 'ترصد التغير في الضغط والاهتزازات الصوتية داخل الأنابيب وترسل إشعاراً للصيانة.', 'التسريبات غير المرئية داخل الجدران والأرضيات التي تهدر آلاف اللترات.', '📡', '#8B5CF6', 3),
('نظام مراقبة الاستهلاك بالذكاء الاصطناعي', 'خوارزميات AI تراقب عدادات المياه على مدار الساعة وتكتشف الهدر غير الطبيعي.', 'تحلل نمط الاستهلاك اليومي وتصدر تقارير تنبؤية وتكشف أي تدفق غير معتاد.', 'عدم معرفة كميات المياه المستهلكة بدقة وتأخر رصد الأعطال الكبرى.', '🤖', '#F59E0B', 4),
('حملة التوعية والمنافسة الرقمية', 'لوحة شرف ومسابقات وتحديات تفاعلية لتشجيع الطالبات على التنافس الإيجابي في الترشيد.', 'منصة تعرض تقدم الصفوف المدرسية في ترشيد المياه وتكافئ الصف الأكثر توفيراً.', 'ضعف الوعي الفردي وغياب الحافز والمنافسة الإيجابية لحماية المياه.', '🏆', '#EC4899', 5)
ON CONFLICT DO NOTHING;

-- ======================================================================
-- تمكين سياسات الوصول العام المباشر (Row Level Security - RLS)
-- ======================================================================
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovations_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- سماح بالقراءة والكتابة للجميع (المسابقة التعليمية العامة)
CREATE POLICY "Allow public read participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update participants" ON public.participants FOR UPDATE USING (true);
CREATE POLICY "Allow public delete participants" ON public.participants FOR DELETE USING (true);

CREATE POLICY "Allow public read quiz_answers" ON public.quiz_answers FOR SELECT USING (true);
CREATE POLICY "Allow public insert quiz_answers" ON public.quiz_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete quiz_answers" ON public.quiz_answers FOR DELETE USING (true);

CREATE POLICY "Allow public read innovations" ON public.innovations FOR SELECT USING (true);
CREATE POLICY "Allow public insert innovations" ON public.innovations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update innovations" ON public.innovations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete innovations" ON public.innovations FOR DELETE USING (true);

CREATE POLICY "Allow public read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Allow public insert questions" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update questions" ON public.questions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete questions" ON public.questions FOR DELETE USING (true);

CREATE POLICY "Allow public read catalog" ON public.innovations_catalog FOR SELECT USING (true);
CREATE POLICY "Allow public manage catalog" ON public.innovations_catalog FOR ALL USING (true);

CREATE POLICY "Allow admin access" ON public.admin_users FOR ALL USING (true);
