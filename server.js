const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('./database');

const app = express();
const PORT = 3000;

// التأكد من وجود مجلد رفع الملفات
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// دالة لمعرفة عناوين الشبكة المحلية لجهاز الخادم
function getLocalNetworkIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// البرمجيات الوسيطة (Middlewares)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.use(session({
  secret: 'water-guardians-secret-key-2024-green-future',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// إعداد رفع الملفات عبر Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `innovation_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    if (allowed.test(file.mimetype) || allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('يُسمح فقط برفع ملفات الصور (JPG, PNG, GIF, WebP, SVG)'));
    }
  }
});

// حفظ الصور المرسلة بصيغة Base64
function saveBase64Image(dataString) {
  try {
    const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `drawing_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    const fullPath = path.join(uploadDir, filename);
    fs.writeFileSync(fullPath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('خطأ في حفظ صورة الرسم:', err);
    return null;
  }
}

// التحقق من صلاحية المشرف
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.isAdmin) {
    return res.status(403).json({ error: 'غير مصرح بالدخول، يرجى تسجيل الدخول كمسؤول' });
  }
  next();
};

// ==================== مسارات الباركود والشبكة ====================

// جلب معلومات الروابط وعناوين IP المحلية
app.get('/api/server-info', (req, res) => {
  const ips = getLocalNetworkIps();
  const defaultLocalUrl = ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`;
  res.json({
    port: PORT,
    localIps: ips,
    recommendedUrl: defaultLocalUrl
  });
});

// توليد QR Code بصيغة DataURL أو صورة
app.get('/api/qrcode', async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl) {
      const ips = getLocalNetworkIps();
      targetUrl = ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`;
    }

    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#01579B',
        light: '#FFFFFF'
      }
    });

    res.json({
      success: true,
      url: targetUrl,
      qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'تعذر إنشاء رمز الاستجابة السريعة' });
  }
});

// ==================== مسارات الطالبات (PARTICIPANT ROUTES) ====================

// بدء مشاركة جديدة
app.post(['/api/participant/start', '/api/session/start'], (req, res) => {
  try {
    const { name, school, grade } = req.body;
    const cleanName = (name && name.trim()) ? name.trim() : 'مبتكرة حُرّاس المياه';
    const cleanSchool = (school && school.trim()) ? school.trim() : 'المدرسة الخضراء';
    const cleanGrade = (grade && grade.trim()) ? grade.trim() : 'المرحلة الدراسية';

    const code = 'WG-' + uuidv4().slice(0, 8).toUpperCase();
    
    const result = db.prepare(`
      INSERT INTO participants (participation_code, name, school, grade, quiz_score, stage_completed, badges)
      VALUES (?, ?, ?, ?, 0, 0, '[]')
    `).run(code, cleanName, cleanSchool, cleanGrade);
    
    req.session.participantId = result.lastInsertRowid;
    req.session.participationCode = code;
    
    res.json({ 
      success: true, 
      participantId: result.lastInsertRowid,
      participationCode: code,
      name: cleanName,
      school: cleanSchool,
      grade: cleanGrade
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// استئناف مشاركة سابقة
const handleResume = (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: 'يرجى إدخال كود المشاركة' });
  }

  const participant = db.prepare('SELECT * FROM participants WHERE participation_code = ?').get(code);
  if (!participant) {
    return res.status(404).json({ error: 'لم يتم العثور على مشاركة بهذا الكود' });
  }
  
  req.session.participantId = participant.id;
  req.session.participationCode = participant.participation_code;

  const innovation = db.prepare('SELECT * FROM innovations WHERE participant_id = ? ORDER BY id DESC LIMIT 1').get(participant.id);

  res.json({ 
    success: true, 
    participant: {
      ...participant,
      badges: JSON.parse(participant.badges || '[]')
    },
    innovation: innovation || null
  });
};

app.post('/api/participant/resume', handleResume);
app.post('/api/session/resume', handleResume);

// التحقق من الجلسة الحالية
app.get('/api/participant/me', (req, res) => {
  if (!req.session || !req.session.participantId) {
    return res.json({ loggedIn: false });
  }
  
  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.session.participantId);
  if (!participant) {
    return res.json({ loggedIn: false });
  }

  res.json({ 
    loggedIn: true, 
    participant: {
      ...participant,
      badges: JSON.parse(participant.badges || '[]')
    }
  });
});

// ==================== مسارات الاختبار (QUIZ ROUTES) ====================

app.get('/api/questions/:stage', (req, res) => {
  try {
    const stage = parseInt(req.params.stage) || 1;
    const questions = db.prepare(`
      SELECT id, stage, question_text, question_type, options, points, image_url, sort_order 
      FROM questions 
      WHERE stage = ? AND is_active = 1 
      ORDER BY sort_order ASC, id ASC
    `).all(stage);
    
    const sanitized = questions.map(q => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : []
    }));
    
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quiz/answer', (req, res) => {
  try {
    const participantId = req.session ? req.session.participantId : null;
    const { questionId, answer } = req.body;

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
    if (!question) {
      return res.status(404).json({ error: 'السؤال غير موجود' });
    }
    
    const cleanUserAnswer = (answer || '').toString().trim().toLowerCase();
    const cleanCorrectAnswer = (question.correct_answer || '').toString().trim().toLowerCase();
    const isCorrect = cleanUserAnswer === cleanCorrectAnswer;
    const pointsEarned = isCorrect ? (question.points || 10) : 0;
    
    if (participantId) {
      const existing = db.prepare(`
        SELECT id, is_correct FROM quiz_answers WHERE participant_id = ? AND question_id = ?
      `).get(participantId, questionId);
      
      if (!existing) {
        db.prepare(`
          INSERT INTO quiz_answers (participant_id, question_id, answer, is_correct, points_earned)
          VALUES (?, ?, ?, ?, ?)
        `).run(participantId, questionId, (answer || '').toString(), isCorrect ? 1 : 0, pointsEarned);
        
        if (isCorrect) {
          db.prepare(`
            UPDATE participants SET quiz_score = quiz_score + ? WHERE id = ?
          `).run(pointsEarned, participantId);
        }
      }
    }
    
    let currentScore = 0;
    if (participantId) {
      const p = db.prepare('SELECT quiz_score FROM participants WHERE id = ?').get(participantId);
      if (p) currentScore = p.quiz_score;
    }

    res.json({
      isCorrect,
      pointsEarned,
      currentTotalScore: currentScore,
      explanation: question.explanation,
      correctAnswer: question.correct_answer
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quiz/complete', (req, res) => {
  try {
    const participantId = req.session ? req.session.participantId : null;
    if (!participantId) {
      return res.status(401).json({ error: 'الجلسة غير مسجلة' });
    }
    
    const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(participantId);
    if (!participant) {
      return res.status(404).json({ error: 'المشاركة غير موجودة' });
    }

    let badges = JSON.parse(participant.badges || '[]');
    if (!badges.includes('water_guardian')) {
      badges.push('water_guardian');
    }

    db.prepare(`
      UPDATE participants 
      SET quiz_completed = 1, 
          stage_completed = CASE WHEN stage_completed < 1 THEN 1 ELSE stage_completed END,
          badges = ? 
      WHERE id = ?
    `).run(JSON.stringify(badges), participantId);
    
    res.json({ 
      success: true, 
      score: participant.quiz_score, 
      badges,
      badgeTitle: 'حارسة المياه 🛡️'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== كتالوج الابتكارات ====================

app.get('/api/innovations-catalog', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM innovations_catalog WHERE is_active = 1 ORDER BY sort_order ASC, id ASC').all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== إرسال الابتكار ====================

app.post('/api/innovation/submit', upload.single('image'), (req, res) => {
  try {
    let participantId = req.session ? req.session.participantId : null;
    let participationCode = req.session ? req.session.participationCode : null;

    if (!participantId) {
      const studentName = req.body.student_name || 'مبتكرة حُرّاس المياه';
      const studentSchool = req.body.student_school || 'المدرسة الخضراء';
      const studentGrade = req.body.student_grade || 'المرحلة الدراسية';
      participationCode = 'WG-' + uuidv4().slice(0, 8).toUpperCase();

      const created = db.prepare(`
        INSERT INTO participants (participation_code, name, school, grade, quiz_score, stage_completed, badges)
        VALUES (?, ?, ?, ?, 50, 3, '["water_guardian","smart_thinker","green_innovator"]')
      `).run(participationCode, studentName, studentSchool, studentGrade);

      participantId = created.lastInsertRowid;
      req.session.participantId = participantId;
      req.session.participationCode = participationCode;
    }

    const {
      type,
      innovation_name,
      problem_description,
      innovation_idea,
      how_it_works,
      technology_use,
      water_saving_impact,
      expected_benefits,
      drawing_data
    } = req.body;

    let finalImagePath = null;
    if (req.file) {
      finalImagePath = `/uploads/${req.file.filename}`;
    } else if (drawing_data && drawing_data.startsWith('data:image')) {
      finalImagePath = saveBase64Image(drawing_data);
    }

    const result = db.prepare(`
      INSERT INTO innovations (
        participant_id, type, innovation_name, problem_description,
        innovation_idea, how_it_works, technology_use, water_saving_impact,
        expected_benefits, image_path, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      participantId,
      type || 'new',
      innovation_name || 'ابتكار ترشيد المياه الذكي',
      problem_description || '',
      innovation_idea || '',
      how_it_works || '',
      technology_use || '',
      water_saving_impact || '',
      expected_benefits || '',
      finalImagePath
    );

    const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(participantId);
    let badges = JSON.parse((participant && participant.badges) || '[]');
    
    if (!badges.includes('water_guardian')) badges.push('water_guardian');
    if (!badges.includes('smart_thinker')) badges.push('smart_thinker');
    if (!badges.includes('green_innovator')) badges.push('green_innovator');

    db.prepare(`
      UPDATE participants 
      SET stage_completed = 3, 
          badges = ? 
      WHERE id = ?
    `).run(JSON.stringify(badges), participantId);

    res.json({
      success: true,
      innovationId: result.lastInsertRowid,
      participationCode: participationCode || participant.participation_code,
      message: 'أحسنتِ! لقد أصبحتِ الآن من حُرّاس المياه. فكرتكِ قد تكون بداية تغيير حقيقي في مدرستكِ. شكراً لمساهمتكِ في حماية البيئة والمحافظة على المياه.',
      badges
    });
  } catch (err) {
    console.error('خطأ في إرسال الابتكار:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== المساعد الذكي ====================

app.post('/api/ai-hint', (req, res) => {
  try {
    const { field, currentText } = req.body;
    const txt = (currentText || '').trim();

    const smartGuidance = {
      innovation_name: {
        title: 'تسمية الابتكار ✨',
        questions: [
          'ما الكلمة التي تعبر عن الأثر الأكبر لاختراعك؟ (مثل: قطرة، نبض، حارس، واحة)',
          'هل يمكنك دمج كلمتين تقنيتين وبيئيتين مثل: "صنبور المستقبل الذكي" أو "راصد المياه بالذكاء الاصطناعي"؟'
        ],
        tips: 'الاسم الجذاب يكون قصيراً، ملهمًا، ويوضح الغاية بوضوح!'
      },
      problem_description: {
        title: 'تحديد المشكلة بدقة 🔍',
        questions: [
          'أين تحدث هذه المشكلة بالتحديد؟ في دورات المياه، برادات الشرب، أم شبكة الري المدرسية؟',
          'كم كمية المياه التي تتوقعين ضياعها يومياً بسبب هذا السلوك أو العطل؟'
        ],
        tips: 'المشكلة المعرفة بوضوح نصف الحل! اذكري السلوك الخاطئ ونتيجته البيئية بالأرقام.'
      },
      innovation_idea: {
        title: 'جوهر الفكرة الابتكارية 💡',
        questions: [
          'ما الذي يجعل فكرتك مختلفة عن الحلول التقليدية؟',
          'كيف يشعر مستخدم هذا الابتكار؟ هل يسهل عليه ترشيد المياه دون عناء؟'
        ],
        tips: 'اشرحي فكرتك وكأنكِ تحكين قصة نجاح: "ابتكاري عبارة عن جهاز/نظام يقوم بـ..."'
      },
      how_it_works: {
        title: 'آلية العمل خطوة بخطوة ⚙️',
        questions: [
          'ما هي الخطوة الأولى عند تشغيل النظام؟ (مثلاً: رصد الحركة، أو قراءة التدفق)',
          'ما الذي يحدث تلقائياً عند اكتشاف هدر مياه؟ وكيف يتم إيقافه؟'
        ],
        tips: 'قسمي خطوات العمل إلى: 1. مرحلة الاستشعار والرصد 2. مرحلة اتخاذ القرار 3. مرحلة التنفيذ والإشعار.'
      },
      technology_use: {
        title: 'التكنولوجيا والذكاء الاصطناعي 🤖',
        questions: [
          'هل يستخدم ابتكارك حساسات (IoT)، أو كاميرات برؤية حاسوبية، أو خوارزمية ذكاء اصطناعي تتنبأ بالتسرب؟',
          'هل يتصل النظام بتطبيق هاتف يرسل تنبيهات فورية للمشرفات وفريق الصيانة؟'
        ],
        tips: 'حددي دور الذكاء الاصطناعي بدقة: مثلاً تمييز التدفق الطبيعي عن الهدر المستمر وإرسال تنبيه آلي.'
      },
      water_saving_impact: {
        title: 'أثر توفير المياه 💧',
        questions: [
          'كم لتراً من المياه تتوقعين توفيره في مدرستك يومياً أو أسبوعياً؟',
          'إذا تم تطبيق ابتكارك في 100 مدرسة في المدينة، كم مليون لتر يمكن إنقاذه سنوياً؟'
        ],
        tips: 'الأرقام والنسب المئوية (مثل: توفير 40% من المياه) تمنح فكرتك قوة ومصداقية كبرى أمام لجان التحكيم!'
      },
      expected_benefits: {
        title: 'الفوائد الشاملة للمدرسة والبيئة 🌱',
        questions: [
          'ما الفائدة الاقتصادية والبيئية المباشرة للمدرسة؟',
          'كيف يساهم هذا الابتكار في نشر ثقافة الاستدامة والوعي بين زميلاتك الطالبات؟'
        ],
        tips: 'تحدثي عن بيئة مدرسية خضراء ذكية، ونظافة دورات المياه، وغرس روح ريادة الأعمال الخضراء.'
      }
    };

    const guide = smartGuidance[field] || {
      title: 'إرشاد ابتكاري 🌟',
      questions: ['كيف يمكنك جعل هذا الجزء أكثر وضوحاً وتفصيلاً؟'],
      tips: 'أنتِ تبدعين! فكري في الأثر العملي لفكرتك على أرض الواقع.'
    };

    let reply = `### ${guide.title}\n\n`;
    if (txt.length > 5) {
      reply += `👏 **تحليل أولي لما كتبتِ:** فكرة واعدة وجميلة!\n\n`;
      reply += `💡 **أسئلة ذكية لتطوير الفكرة أكثر:**\n`;
    } else {
      reply += `👋 **دليلكِ لصياغة هذا الحقل بإبداع:**\n\n`;
      reply += `💡 **أسئلة إرشادية تدلك على الحل:**\n`;
    }

    guide.questions.forEach(q => {
      reply += `• ${q}\n`;
    });

    reply += `\n✨ **نصيحة ذهبية:** ${guide.tips}`;

    res.json({
      hint: reply,
      fieldTitle: guide.title
    });
  } catch (err) {
    res.json({ hint: 'تابعي التفكير أيتها المبتكرة، فكرتك تصنع فرقاً حقيقياً! 💧' });
  }
});

// ==================== لوحة الترتيب العامة ====================

app.get('/api/leaderboard', (req, res) => {
  try {
    const featuredInnovations = db.prepare(`
      SELECT i.id, i.innovation_name, i.type, i.innovation_idea, i.image_path,
             p.name as student_name, p.school as student_school, p.grade as student_grade,
             (i.rating_creativity + i.rating_environmental + i.rating_feasibility + i.rating_technology) as total_rating
      FROM innovations i
      JOIN participants p ON p.id = i.participant_id
      WHERE i.is_featured = 1
      ORDER BY total_rating DESC, i.id DESC
      LIMIT 10
    `).all();

    const topParticipants = db.prepare(`
      SELECT name, school, grade, quiz_score, stage_completed,
             (SELECT COUNT(*) FROM innovations WHERE participant_id = participants.id) as inno_count
      FROM participants
      WHERE quiz_score > 0
      ORDER BY quiz_score DESC, stage_completed DESC, id ASC
      LIMIT 10
    `).all();

    res.json({
      featuredInnovations,
      topParticipants
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== مسارات الإدارة والصلاحيات الموسعة ====================

// تسجيل الدخول
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  
  if (!admin || !bcrypt.compareSync(password || '', admin.password_hash)) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
  
  req.session.isAdmin = true;
  req.session.adminUsername = username;
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: Boolean(req.session && req.session.isAdmin) });
});

// الإحصائيات
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const totalParticipants = db.prepare('SELECT COUNT(*) as cnt FROM participants').get().cnt;
    const completedChallenge = db.prepare('SELECT COUNT(*) as cnt FROM participants WHERE stage_completed >= 3').get().cnt;
    const totalInnovations = db.prepare('SELECT COUNT(*) as cnt FROM innovations').get().cnt;
    const avgScore = db.prepare('SELECT AVG(quiz_score) as avg FROM participants WHERE quiz_completed = 1').get().avg || 0;
    
    const innovationsByType = db.prepare(`
      SELECT type, COUNT(*) as cnt FROM innovations GROUP BY type
    `).all();
    
    const dailyParticipants = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as cnt 
      FROM participants 
      WHERE created_at >= DATE('now', '-6 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all();

    const topSchools = db.prepare(`
      SELECT school, COUNT(*) as cnt FROM participants WHERE school IS NOT NULL AND school != '' GROUP BY school ORDER BY cnt DESC LIMIT 5
    `).all();
    
    res.json({
      totalParticipants,
      completedChallenge,
      totalInnovations,
      avgScore: Math.round(avgScore),
      innovationsByType,
      dailyParticipants,
      topSchools
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// استعراض المشاركات
app.get('/api/admin/participants', requireAdmin, (req, res) => {
  try {
    const { school, grade, search, page = 1 } = req.query;
    const limit = 30;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;
    
    let where = 'WHERE 1=1';
    const params = [];
    
    if (school) { where += ' AND p.school LIKE ?'; params.push(`%${school}%`); }
    if (grade) { where += ' AND p.grade = ?'; params.push(grade); }
    if (search) { 
      where += ' AND (p.name LIKE ? OR p.participation_code LIKE ?)'; 
      params.push(`%${search}%`, `%${search}%`); 
    }
    
    const participants = db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM innovations WHERE participant_id = p.id) as innovation_count
      FROM participants p 
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all([...params, limit, offset]);
    
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM participants p ${where}`).get(params).cnt;
    
    res.json({ 
      participants: participants.map(p => ({
        ...p,
        badges: JSON.parse(p.badges || '[]')
      })), 
      total, 
      pages: Math.ceil(total / limit) 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [صلاحية جديدة] تعديل بيانات مشاركة طالبة
app.put('/api/admin/participant/:id', requireAdmin, (req, res) => {
  try {
    const { name, school, grade, quiz_score } = req.body;
    db.prepare(`
      UPDATE participants 
      SET name = ?, school = ?, grade = ?, quiz_score = ?
      WHERE id = ?
    `).run(
      name || '',
      school || '',
      grade || '',
      parseInt(quiz_score) || 0,
      req.params.id
    );

    res.json({ success: true, message: 'تم تحديث بيانات الطالبة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [صلاحية جديدة] حذف مشاركة طالبة وسجلاتها بالكامل
app.delete('/api/admin/participant/:id', requireAdmin, (req, res) => {
  try {
    const participantId = req.params.id;

    // حذف إجابات الاختبار المرتبطة
    db.prepare('DELETE FROM quiz_answers WHERE participant_id = ?').run(participantId);

    // حذف صور الابتكارات إن وجدت من القرص الصلب
    const studentInnos = db.prepare('SELECT image_path FROM innovations WHERE participant_id = ?').all(participantId);
    studentInnos.forEach(i => {
      if (i.image_path) {
        const filePath = path.join(__dirname, 'public', i.image_path.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch(e) {}
        }
      }
    });

    // حذف الابتكارات المرتبطة
    db.prepare('DELETE FROM innovations WHERE participant_id = ?').run(participantId);

    // حذف الطالبة
    db.prepare('DELETE FROM participants WHERE id = ?').run(participantId);

    res.json({ success: true, message: 'تم حذف المشاركة وسجلاتها بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// عرض إجابات طالبة معينة
app.get('/api/admin/participant/:id/answers', requireAdmin, (req, res) => {
  try {
    const participantId = req.params.id;
    const participant = db.prepare('SELECT id, name, school, grade, participation_code, quiz_score FROM participants WHERE id = ?').get(participantId);
    if (!participant) {
      return res.status(404).json({ error: 'المشاركة غير موجودة' });
    }

    const answers = db.prepare(`
      SELECT qa.*, q.question_text, q.correct_answer, q.explanation, q.points as max_points, q.question_type
      FROM quiz_answers qa
      JOIN questions q ON q.id = qa.question_id
      WHERE qa.participant_id = ?
      ORDER BY qa.id ASC
    `).all(participantId);

    res.json({
      participant,
      answers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// استعراض الابتكارات
app.get('/api/admin/innovations', requireAdmin, (req, res) => {
  try {
    const { type, featured, search, school, page = 1 } = req.query;
    const limit = 30;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;
    
    let where = 'WHERE 1=1';
    const params = [];
    
    if (type) { where += ' AND i.type = ?'; params.push(type); }
    if (featured === 'true' || featured === '1') { where += ' AND i.is_featured = 1'; }
    if (school) { where += ' AND p.school LIKE ?'; params.push(`%${school}%`); }
    if (search) { 
      where += ' AND (i.innovation_name LIKE ? OR i.problem_description LIKE ? OR i.innovation_idea LIKE ? OR p.name LIKE ?)'; 
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); 
    }
    
    const innovations = db.prepare(`
      SELECT i.*, p.name, p.school, p.grade, p.participation_code, p.quiz_score
      FROM innovations i
      LEFT JOIN participants p ON p.id = i.participant_id
      ${where}
      ORDER BY i.is_featured DESC, i.submitted_at DESC
      LIMIT ? OFFSET ?
    `).all([...params, limit, offset]);
    
    const total = db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM innovations i 
      LEFT JOIN participants p ON p.id = i.participant_id 
      ${where}
    `).get(params).cnt;
    
    res.json({ innovations, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب تفاصيل ابتكار مفرد
app.get('/api/admin/innovation/:id', requireAdmin, (req, res) => {
  try {
    const inno = db.prepare(`
      SELECT i.*, p.name, p.school, p.grade, p.participation_code
      FROM innovations i
      LEFT JOIN participants p ON p.id = i.participant_id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!inno) return res.status(404).json({ error: 'الابتكار غير موجود' });
    res.json(inno);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [صلاحية جديدة] تعديل تفاصيل ابتكار/طلب بالكامل
app.put('/api/admin/innovation/:id', requireAdmin, (req, res) => {
  try {
    const {
      innovation_name,
      type,
      problem_description,
      innovation_idea,
      how_it_works,
      technology_use,
      water_saving_impact,
      expected_benefits,
      rating_creativity,
      rating_environmental,
      rating_feasibility,
      rating_technology,
      is_featured,
      admin_notes
    } = req.body;

    db.prepare(`
      UPDATE innovations SET
        innovation_name = ?,
        type = ?,
        problem_description = ?,
        innovation_idea = ?,
        how_it_works = ?,
        technology_use = ?,
        water_saving_impact = ?,
        expected_benefits = ?,
        rating_creativity = ?,
        rating_environmental = ?,
        rating_feasibility = ?,
        rating_technology = ?,
        is_featured = ?,
        admin_notes = ?
      WHERE id = ?
    `).run(
      innovation_name || '',
      type || 'new',
      problem_description || '',
      innovation_idea || '',
      how_it_works || '',
      technology_use || '',
      water_saving_impact || '',
      expected_benefits || '',
      parseInt(rating_creativity) || 0,
      parseInt(rating_environmental) || 0,
      parseInt(rating_feasibility) || 0,
      parseInt(rating_technology) || 0,
      (is_featured === true || is_featured === 1 || is_featured === '1') ? 1 : 0,
      admin_notes || '',
      req.params.id
    );

    res.json({ success: true, message: 'تم تعديل الابتكار بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [صلاحية جديدة] حذف ابتكار/طلب مع صورته
app.delete('/api/admin/innovation/:id', requireAdmin, (req, res) => {
  try {
    const inno = db.prepare('SELECT image_path FROM innovations WHERE id = ?').get(req.params.id);
    if (inno && inno.image_path) {
      const filePath = path.join(__dirname, 'public', inno.image_path.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch(e) {}
      }
    }

    db.prepare('DELETE FROM innovations WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'تم حذف الابتكار بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تقييم ابتكار
app.put('/api/admin/innovation/:id/rate', requireAdmin, (req, res) => {
  try {
    const {
      rating_creativity = 0,
      rating_environmental = 0,
      rating_feasibility = 0,
      rating_technology = 0,
      is_featured = 0,
      admin_notes = ''
    } = req.body;
    
    db.prepare(`
      UPDATE innovations SET
        rating_creativity = ?,
        rating_environmental = ?,
        rating_feasibility = ?,
        rating_technology = ?,
        is_featured = ?,
        admin_notes = ?
      WHERE id = ?
    `).run(
      parseInt(rating_creativity) || 0,
      parseInt(rating_environmental) || 0,
      parseInt(rating_feasibility) || 0,
      parseInt(rating_technology) || 0,
      (is_featured === true || is_featured === 1 || is_featured === '1') ? 1 : 0,
      admin_notes || '',
      req.params.id
    );
    
    res.json({ success: true, message: 'تم حفظ التقييم بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تصدير النتائج إلى Excel / CSV
app.get('/api/admin/export', requireAdmin, (req, res) => {
  try {
    const records = db.prepare(`
      SELECT 
        p.participation_code as 'كود_المشاركة',
        p.name as 'اسم_الطالبة',
        p.school as 'المدرسة',
        p.grade as 'الصف',
        p.quiz_score as 'نقاط_الاختبار',
        p.stage_completed as 'المرحلة_المنجزة',
        p.created_at as 'تاريخ_الانضمام',
        i.type as 'نوع_الابتكار',
        i.innovation_name as 'اسم_الابتكار',
        i.problem_description as 'المشكلة_المعالجة',
        i.innovation_idea as 'فكرة_الابتكار',
        i.how_it_works as 'كيف_يعمل',
        i.technology_use as 'استخدام_التكنولوجيا_والذكاء_الاصطناعي',
        i.water_saving_impact as 'أثر_توفير_المياه',
        i.expected_benefits as 'الفوائد_المتوقعة',
        i.rating_creativity as 'تقييم_الإبداع',
        i.rating_environmental as 'الأثر_البيئي',
        i.rating_feasibility as 'إمكانية_التطبيق',
        i.rating_technology as 'استخدام_التقنية',
        i.is_featured as 'ابتكار_مميز',
        i.admin_notes as 'ملاحظات_المشرف'
      FROM participants p
      LEFT JOIN innovations i ON i.participant_id = p.id
      ORDER BY p.created_at DESC
    `).all();
    
    if (records.length === 0) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="water_guardians_export.csv"');
      return res.send('\uFEFFلا توجد مشاركات مسجلة حتى الآن');
    }
    
    const headers = Object.keys(records[0]);
    const csvRows = [
      headers.join(','),
      ...records.map(row => 
        headers.map(h => `"${(row[h] !== null && row[h] !== undefined ? row[h].toString() : '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`).join(',')
      )
    ];
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="water_guardians_participants.csv"');
    res.send('\uFEFF' + csvRows.join('\r\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إدارة الأسئلة
const handleGetQuestions = (req, res) => {
  try {
    const questions = db.prepare('SELECT * FROM questions ORDER BY stage ASC, sort_order ASC, id ASC').all();
    res.json(questions.map(q => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : []
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const handleSaveQuestion = (req, res) => {
  try {
    const {
      stage = 1,
      question_text,
      question_type = 'multiple',
      options = [],
      correct_answer,
      explanation,
      points = 10,
      image_url = '',
      sort_order = 0
    } = req.body;

    const optStr = typeof options === 'string' ? options : JSON.stringify(options);

    const result = db.prepare(`
      INSERT INTO questions (stage, question_text, question_type, options, correct_answer, explanation, points, image_url, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      parseInt(stage) || 1,
      question_text,
      question_type,
      optStr,
      correct_answer,
      explanation,
      parseInt(points) || 10,
      image_url || '',
      parseInt(sort_order) || 0
    );

    res.json({ success: true, id: result.lastInsertRowid, message: 'تم إضافة السؤال بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const handleUpdateQuestion = (req, res) => {
  try {
    const {
      stage = 1,
      question_text,
      question_type = 'multiple',
      options = [],
      correct_answer,
      explanation,
      points = 10,
      image_url = '',
      is_active = 1,
      sort_order = 0
    } = req.body;

    const optStr = typeof options === 'string' ? options : JSON.stringify(options);

    db.prepare(`
      UPDATE questions SET 
        stage = ?, question_text = ?, question_type = ?, options = ?, 
        correct_answer = ?, explanation = ?, points = ?, image_url = ?, 
        is_active = ?, sort_order = ?
      WHERE id = ?
    `).run(
      parseInt(stage) || 1,
      question_text,
      question_type,
      optStr,
      correct_answer,
      explanation,
      parseInt(points) || 10,
      image_url || '',
      is_active ? 1 : 0,
      parseInt(sort_order) || 0,
      req.params.id
    );

    res.json({ success: true, message: 'تم تحديث السؤال بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const handlePatchQuestion = (req, res) => {
  try {
    const { is_active } = req.body;
    db.prepare('UPDATE questions SET is_active = ? WHERE id = ?').run(
      is_active ? 1 : 0,
      req.params.id
    );
    res.json({ success: true, message: 'تم تغيير حالة السؤال' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const handleDeleteQuestion = (req, res) => {
  try {
    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'تم حذف السؤال بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.get('/api/admin/questions', requireAdmin, handleGetQuestions);
app.post(['/api/admin/questions', '/api/admin/question'], requireAdmin, handleSaveQuestion);
app.put(['/api/admin/questions/:id', '/api/admin/question/:id'], requireAdmin, handleUpdateQuestion);
app.patch(['/api/admin/questions/:id', '/api/admin/question/:id'], requireAdmin, handlePatchQuestion);
app.delete(['/api/admin/questions/:id', '/api/admin/question/:id'], requireAdmin, handleDeleteQuestion);

// كتالوج الابتكارات
app.post('/api/admin/innovations-catalog', requireAdmin, (req, res) => {
  try {
    const { title, description, how_it_works, problem_solved, icon = '💧', color = '#2196F3', sort_order = 0 } = req.body;
    const result = db.prepare(`
      INSERT INTO innovations_catalog (title, description, how_it_works, problem_solved, icon, color, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, how_it_works, problem_solved, icon, color, parseInt(sort_order) || 0);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/innovations-catalog/:id', requireAdmin, (req, res) => {
  try {
    const { title, description, how_it_works, problem_solved, icon = '💧', color = '#2196F3', is_active = 1, sort_order = 0 } = req.body;
    db.prepare(`
      UPDATE innovations_catalog SET 
        title = ?, description = ?, how_it_works = ?, problem_solved = ?, 
        icon = ?, color = ?, is_active = ?, sort_order = ?
      WHERE id = ?
    `).run(title, description, how_it_works, problem_solved, icon, color, is_active ? 1 : 0, parseInt(sort_order) || 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/innovations-catalog/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM innovations_catalog WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// توجيه الصفحات
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use((err, req, res, next) => {
  console.error('خطأ غير معالج:', err);
  res.status(500).json({ error: err.message || 'حدث خطأ في الخادم' });
});

const server = app.listen(PORT, () => {
  const ips = getLocalNetworkIps();
  console.log(`🌊 تطبيق «حُرّاس المياه – ابتكري الحل» يعمل الآن:`);
  console.log(`🔗 الواجهة الرئيسية للطالبات: http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`📱 رابط الشبكة المحلية لمشاركة الطالبات: http://${ips[0]}:${PORT}`);
  }
  console.log(`⚙️ لوحة تحكم الإدارة: http://localhost:${PORT}/admin`);
  console.log(`🔑 بيانات المشرف: admin / admin123`);
});

module.exports = { app, server };
