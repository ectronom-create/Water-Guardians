const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'water_guardians.db');
const db = new Database(dbPath);

// تمكين وضع WAL للأداء العالي وتعدد العمليات المتزامنة
db.pragma('journal_mode = WAL');

// إنشاء الجداول الأساسية
db.exec(`
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participation_code TEXT UNIQUE NOT NULL,
    name TEXT,
    school TEXT,
    grade TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    quiz_score INTEGER DEFAULT 0,
    quiz_completed BOOLEAN DEFAULT 0,
    stage_completed INTEGER DEFAULT 0,
    badges TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS quiz_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER,
    question_id INTEGER,
    answer TEXT,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id)
  );

  CREATE TABLE IF NOT EXISTS innovations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER,
    type TEXT NOT NULL, -- 'existing' or 'new'
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
    is_featured BOOLEAN DEFAULT 0,
    admin_notes TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'multiple', 'truefalse', 'scenario', 'image'
    options TEXT,
    correct_answer TEXT,
    explanation TEXT,
    points INTEGER DEFAULT 10,
    image_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS innovations_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    how_it_works TEXT NOT NULL,
    problem_solved TEXT NOT NULL,
    icon TEXT DEFAULT '💧',
    color TEXT DEFAULT '#2196F3',
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );
`);

// إنشاء حساب المشرف الافتراضي (admin / admin123)
const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hash);
}

// تحديث وتعيين الأسئلة التفاعلية الرسمية المتوافقة مع المتطلبات
const currentQuestions = db.prepare('SELECT COUNT(*) as cnt FROM questions').get().cnt;
if (currentQuestions < 6) {
  // تفريغ الأسئلة القديمة لإعادة بنائها بالمعايير الدقيقة
  db.prepare('DELETE FROM questions').run();

  const insertQ = db.prepare(`
    INSERT INTO questions (stage, question_text, question_type, options, correct_answer, explanation, points, image_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialQuestions = [
    [
      1,
      'ماذا يحدث عندما نفتح عبوة المياه ولا نستهلكها بالكامل؟',
      'multiple',
      JSON.stringify([
        'تُهدر المياه المتبقية وتُرمى في سلة المهملات',
        'تتحول المياه المتبقية تلقائياً إلى بخار مفيد',
        'لا يوجد أي ضرر بيئي أو هدر مالي',
        'تُستخدم المياه تلقائياً في ري الحدائق'
      ]),
      'تُهدر المياه المتبقية وتُرمى في سلة المهملات',
      'عندما نفتح عبوة مياه ولا نكملها، تضيع كميات هائلة من المياه العذبة النقية التي استهلكت طاقة وموارد في تنقيتها وتعبئتها، بالإضافة إلى ضرر التلوث البلاستيكي. الحل الأمثل: احملي دائماً عبوة شخصية قابلة لإعادة التعبئة!',
      15,
      'bottle',
      1
    ],
    [
      1,
      'موقف واقعي: شاهدتِ في فناء المدرسة صنبور مياه مفتوحاً يتدفق بقوة دون وجود أحد قربه، ما هو التصرف الصحيح والمسؤول؟',
      'scenario',
      JSON.stringify([
        'أغلق الصنبور فوراً بحذر ثم أبلغ المعلمة أو إدارة المدرسة',
        'أتجاهله لأنني لستُ مسؤولة عن الصيانة المدرسية',
        'أنتظر حتى تأتي طالبة أخرى لتغلقه',
        'أصوره بهاتفي وأنشره دون إغلاقه'
      ]),
      'أغلق الصنبور فوراً بحذر ثم أبلغ المعلمة أو إدارة المدرسة',
      'أحسنتِ! الصنبور المفتوح يهدر ما يزيد عن 150 لتراً في الساعة الواحدة. الإغلاق الفوري هو التصرف البيئي النبيل الذي ينقذ آلاف اللترات، والإبلاغ يضمن عدم تكرار الخلل.',
      20,
      'tap',
      2
    ],
    [
      1,
      'هل العبارة صحيحة أم خطأ: الصنبور الذي يقطر ببطء لا يهدر كمية تستحق الاهتمام؟',
      'truefalse',
      JSON.stringify([
        'صح',
        'خطأ'
      ]),
      'خطأ',
      'خطأ بالتأكيد! قطرة مياه واحدة كل ثانية قد تبدو بسيطة، ولكنها تُهدر أكثر من 30 لتراً يومياً ونحو 11,000 لتر سنوياً لكل صنبور واحد في المدرسة!',
      10,
      'drop',
      3
    ],
    [
      1,
      'سؤال مصور: أي من التقنيات التالية هو الأفضل لتقليل هدر المياه في دورات المياه المدرسية بنسبة تصل إلى 70%؟',
      'image',
      JSON.stringify([
        'تركيب صنابير ذكية مزودة بحساسات استشعار الحركة (IR)',
        'استخدام صنابير تقليدية بمقابض يدوية فقط',
        'إغلاق دورات المياه تماماً أثناء اليوم الدراسي',
        'تقليل ضغط المياه حتى يتوقف التدفق تقريباً'
      ]),
      'تركيب صنابير ذكية مزودة بحساسات استشعار الحركة (IR)',
      'الصنابير الذكية المزودة بحساسات حركة توقف تدفق المياه فور ابتعاد اليدين، وتمنع نسيان الصنبور مفتوحاً وتوفر ما بين 50% إلى 70% من الاستهلاك المدرسي!',
      20,
      'sensor_tap',
      4
    ],
    [
      1,
      'لماذا يُعتبر ترشيد استهلاك المياه مسؤولية الجميع وليس مسؤولية إدارة المدرسة فقط؟',
      'multiple',
      JSON.stringify([
        'لأن المياه العذبة ثروة ثمينة محدودة يحتاجها كل كائن حي لكوكب مستدام',
        'لتقليل تكلفة فاتورة المياه الشهرية للمدرسة فقط',
        'لأن القوانين المدرسية تفرض ذلك كعقوبة',
        'لا يهم، فالأمطار تعوض كل قطرة مهدرة دائماً'
      ]),
      'لأن المياه العذبة ثروة ثمينة محدودة يحتاجها كل كائن حي لكوكب مستدام',
      'المياه العذبة الصالحة للشرب تمثل أقل من 1% فقط من إجمالي مياه كوكب الأرض. ترشيد المياه واجب أخلاقي وبيئي ومسؤولية مشتركة لضمان مستقبل الأجيال القادمة.',
      15,
      'earth_water',
      5
    ],
    [
      1,
      'كيف يمكن للتكنولوجيا والذكاء الاصطناعي (AI) المساعدة في القضاء على هدر المياه المدرسي؟',
      'multiple',
      JSON.stringify([
        'تحليل أنماط التدفق وكشف التسريبات المخفية وإرسال تنبيهات فورية للمسؤولين',
        'منع الطلاب من شرب المياه أثناء الحصص',
        'استبدال المياه بالكامل بسوائل صناعية',
        'لا يوجد أي دور للتكنولوجيا والذكاء الاصطناعي في إدارة المياه'
      ]),
      'تحليل أنماط التدفق وكشف التسريبات المخفية وإرسال تنبيهات فورية للمسؤولين',
      'رائع! تستطيع خوارزميات الذكاء الاصطناعي قراءة بيانات العدادات الذكية على مدار الساعة، واكتشاف أي تدفق غير طبيعي أو تسرب غير مرئي وإشعار فريق الصيانة فوراً قبل ضياع المياه.',
      20,
      'ai_water',
      6
    ]
  ];

  for (const q of initialQuestions) {
    insertQ.run(...q);
  }
}

// تحديث كتالوج الابتكارات الخمسة المطلوبة
const catalogCount = db.prepare('SELECT COUNT(*) as cnt FROM innovations_catalog').get().cnt;
if (catalogCount < 5) {
  db.prepare('DELETE FROM innovations_catalog').run();

  const insertI = db.prepare(`
    INSERT INTO innovations_catalog (title, description, how_it_works, problem_solved, icon, color, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const initialInnovations = [
    [
      'العبوات القابلة لإعادة التعبئة',
      'استخدام عبوات مياه شخصية مستدامة بدلاً من فتح عبوات بلاستيكية جديدة ذات الاستخدام الواحد وترك المتبقي منها مهدرًا.',
      'تُوفّر المدرسة محطات مياه نقية ومفلترة في الممرات. تقوم كل طالبة بتعبئة عبوتها الخاصة متعددة الاستخدام، ويتم توفير نظام عداد إلكتروني يعرض عدد العبوات البلاستيكية التي تم توفيرها.',
      'هدر مياه العبوات البلاستيكية غير المكتملة وتراكم النفايات البلاستيكية في البيئة المدرسية.',
      '🍶',
      '#4CAF50',
      1
    ],
    [
      'الصنابير الذكية المزودة بحساسات',
      'تركيب صنابير إلكترونية تعمل بالأشعة تحت الحمراء توقف تدفق المياه تلقائياً بمجرد إبعاد اليدين مع تحديد زمن تدفق محسوب.',
      'يقوم حساس القرب باكتشاف وجود اليدين أسفل الصنبور فيفتح صمام التدفق بكمية مقننة، وحال إبعاد اليدين يُغلق الصمام فورياً دون أي تأخير، مع شاشة صغيرة تعرض كمية المياه الموفرة.',
      'نسيان الصنابير مفتوحة أو عدم إغلاقها بإحكام وهدر كميات ضخمة أثناء غسيل الأيدي.',
      '🚿',
      '#0288D1',
      2
    ],
    [
      'نظام كشف التسرب الذكي بالموجات الصوتية',
      'مستشعرات ذكية فائقة الدقة تُثبت على شبكة الأنابيب المدرسية لاكتشاف التسريبات الخفية تحت الأرض أو داخل الجدران.',
      'تقوم الحساسات بالتقاط الترددات والاهتزازات الناتجة عن أي ثقب أو تسريب في الأنابيب، ثم تُرسل إشارة لاسلكية فورية عبر شبكة IoT إلى هاتف مسؤول الصيانة مع تحديد مكان التسريب بدقة.',
      'التسريبات غير المرئية التي تستمر لأيام أو أسابيع دون أن يراها أحد وتهدر آلاف اللترات.',
      '🔍',
      '#FF9800',
      3
    ],
    [
      'نظام مراقبة استهلاك المياه بالذكاء الاصطناعي',
      'منصة سحابية متطورة تجمع قراءات العدادات الذكية وتحللها بالذكاء الاصطناعي لاكتشاف الهدر غير الطبيعي والتنبؤ بالاستهلاك.',
      'تجمع خوارزميات التعلم الآلي بيانات استهلاك المدرسة في الأيام العادية وتتعرف على أوقات الفسح والدوام. إذا تم استهلاك مياه ليلاً أو خارج أوقات الفسح بمعدل غير اعتيادي يتم إطلاق إنذار فوري وقطع الصمامات الرئيسية تلقائياً إذا لزم.',
      'غياب البيانات الدقيقة عن مصادر الهدر وصعوبة معرفة الأماكن التي تستهلك مياهاً أكثر من اللازم.',
      '🤖',
      '#7B1FA2',
      4
    ],
    [
      'حملة التوعية الرقمية والمسابقات البيئية',
      'تطبيق مدرسي تفاعلي ينظم تحديات يومية وأسبوعية بين فصول المدرسة لتشجيع السلوكيات الإيجابية وحفظ المياه.',
      'تقوم الطالبات بتوثيق ممارساتهن المائية الصحيحة والحصول على نقاط وأوسمة، وتظهر لوحة متصدرين ذكية على شاشات المدرسة تكرّم الفصل الأكثر محافظة على المياه مع مسابقات رقمية تفاعلية.',
      'نقص الوعي البيئي وغياب الحافز التشجيعي لدى الطالبات للمشاركة الفعالة في حماية المياه.',
      '📱',
      '#E91E63',
      5
    ]
  ];

  for (const item of initialInnovations) {
    insertI.run(...item);
  }
}

module.exports = db;
