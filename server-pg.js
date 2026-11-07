/**
 * server-pg.js  –  حُرّاس المياه (نسخة السحابة - PostgreSQL)
 * يعمل على Railway / Render / أي منصة تدعم Node.js + DATABASE_URL
 * قاعدة البيانات: Supabase PostgreSQL  (أو أي PostgreSQL)
 */

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { pool, initDatabase, testDatabaseHealth } = require('./database-pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
//  مجلد رفع الملفات
// ============================================================
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ============================================================
//  مساعد: عناوين IP المحلية
// ============================================================
function getLocalNetworkIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

// ============================================================
//  البرمجيات الوسيطة
// ============================================================
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.use(session({
  secret: process.env.SESSION_SECRET || 'water-guardians-secret-key-2024-green-future',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// ============================================================
//  رفع الملفات (Multer)
// ============================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
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

// حفظ صورة Base64 على القرص
function saveBase64Image(dataString) {
  try {
    const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `drawing_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('خطأ في حفظ صورة الرسم:', err);
    return null;
  }
}

// ============================================================
//  صلاحية المشرف
// ============================================================
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.isAdmin) {
    return res.status(403).json({ error: 'غير مصرح بالدخول، يرجى تسجيل الدخول كمسؤول' });
  }
  next();
};

// ============================================================
//  مساعد: تحويل نتيجة PG إلى صف واحد أو null
// ============================================================
const one = (result) => (result && result.rows && result.rows.length > 0) ? result.rows[0] : null;
const all = (result) => (result && result.rows) ? result.rows : [];

// ============================================================
//  المسارات: معلومات الخادم والباركود
// ============================================================
app.get('/api/server-info', (req, res) => {
  const ips = getLocalNetworkIps();
  const host = process.env.PUBLIC_URL || (ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`);
  res.json({ port: PORT, localIps: ips, recommendedUrl: host });
});

app.get('/api/qrcode', async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl) {
      const ips = getLocalNetworkIps();
      targetUrl = process.env.PUBLIC_URL || (ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`);
    }
    if (req.query.format === 'png') {
      const buffer = await QRCode.toBuffer(targetUrl, { width: 300, margin: 2, color: { dark: '#0288D1', light: '#FFFFFF' } });
      res.setHeader('Content-Type', 'image/png');
      return res.send(buffer);
    }
    const dataUrl = await QRCode.toDataURL(targetUrl, { width: 300, margin: 2, color: { dark: '#0288D1', light: '#FFFFFF' } });
    res.json({ qrDataUrl: dataUrl, targetUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  المشاركون: بداية جلسة
// ============================================================
app.post(['/api/participant/start', '/api/session/start'], async (req, res) => {
  try {
    const { name, school, grade } = req.body;
    const cleanName   = (name   && name.trim())   ? name.trim()   : 'مبتكرة حُرّاس المياه';
    const cleanSchool = (school && school.trim())  ? school.trim() : 'المدرسة الخضراء';
    const cleanGrade  = (grade  && grade.trim())   ? grade.trim()  : 'المرحلة الدراسية';
    const code = 'WG-' + uuidv4().slice(0, 8).toUpperCase();

    const result = await pool.query(
      `INSERT INTO participants (participation_code, name, school, grade, quiz_score, stage_completed, badges)
       VALUES ($1,$2,$3,$4,0,0,'[]') RETURNING id`,
      [code, cleanName, cleanSchool, cleanGrade]
    );
    const participantId = result.rows[0].id;
    req.session.participantId = participantId;
    req.session.participationCode = code;

    res.json({ success: true, participantId, participationCode: code, name: cleanName, school: cleanSchool, grade: cleanGrade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// استئناف مشاركة سابقة
const handleResume = async (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'يرجى إدخال كود المشاركة' });

  const participant = one(await pool.query('SELECT * FROM participants WHERE participation_code = $1', [code]));
  if (!participant) return res.status(404).json({ error: 'لم يتم العثور على مشاركة بهذا الكود' });

  req.session.participantId = participant.id;
  req.session.participationCode = participant.participation_code;

  const innovation = one(await pool.query('SELECT * FROM innovations WHERE participant_id = $1 ORDER BY id DESC LIMIT 1', [participant.id]));
  res.json({
    success: true,
    participant: { ...participant, badges: JSON.parse(participant.badges || '[]') },
    innovation: innovation || null
  });
};
app.post('/api/participant/resume', handleResume);
app.post('/api/session/resume', handleResume);

// التحقق من الجلسة الحالية
app.get('/api/participant/me', async (req, res) => {
  if (!req.session || !req.session.participantId) {
    return res.status(401).json({ error: 'لا توجد جلسة نشطة' });
  }
  const participant = one(await pool.query('SELECT * FROM participants WHERE id = $1', [req.session.participantId]));
  if (!participant) return res.status(404).json({ error: 'المشارك غير موجود' });
  res.json({ ...participant, badges: JSON.parse(participant.badges || '[]') });
});

// ============================================================
//  الأسئلة: جلب أسئلة مرحلة معينة (للطالبات)
// ============================================================
app.get('/api/questions/:stage', async (req, res) => {
  try {
    const stage = parseInt(req.params.stage) || 1;
    const questions = all(await pool.query(
      'SELECT * FROM questions WHERE stage = $1 AND is_active = TRUE ORDER BY sort_order ASC, id ASC',
      [stage]
    ));
    res.json(questions.map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  الإجابات والنقاط
// ============================================================
app.post('/api/quiz/answer', async (req, res) => {
  try {
    const participantId = req.session ? req.session.participantId : null;
    const { questionId, answer } = req.body;

    const question = one(await pool.query('SELECT * FROM questions WHERE id = $1', [questionId]));
    if (!question) return res.status(404).json({ error: 'السؤال غير موجود' });

    const cleanUserAnswer   = (answer || '').toString().trim().toLowerCase();
    const cleanCorrectAnswer = (question.correct_answer || '').toString().trim().toLowerCase();
    const isCorrect = cleanUserAnswer === cleanCorrectAnswer;
    const pointsEarned = isCorrect ? (question.points || 10) : 0;

    if (participantId) {
      const existing = one(await pool.query(
        'SELECT id FROM quiz_answers WHERE participant_id = $1 AND question_id = $2',
        [participantId, questionId]
      ));
      if (!existing) {
        await pool.query(
          'INSERT INTO quiz_answers (participant_id, question_id, answer, is_correct, points_earned) VALUES ($1,$2,$3,$4,$5)',
          [participantId, questionId, (answer || '').toString(), isCorrect, pointsEarned]
        );
        if (isCorrect) {
          await pool.query('UPDATE participants SET quiz_score = quiz_score + $1 WHERE id = $2', [pointsEarned, participantId]);
        }
      }
    }

    let currentScore = 0;
    if (participantId) {
      const p = one(await pool.query('SELECT quiz_score FROM participants WHERE id = $1', [participantId]));
      if (p) currentScore = p.quiz_score;
    }

    res.json({ isCorrect, pointsEarned, currentTotalScore: currentScore, explanation: question.explanation, correctAnswer: question.correct_answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quiz/complete', async (req, res) => {
  try {
    const participantId = req.session ? req.session.participantId : null;
    if (!participantId) return res.status(401).json({ error: 'الجلسة غير مسجلة' });

    const participant = one(await pool.query('SELECT * FROM participants WHERE id = $1', [participantId]));
    if (!participant) return res.status(404).json({ error: 'المشاركة غير موجودة' });

    let badges = JSON.parse(participant.badges || '[]');
    if (!badges.includes('water_guardian')) badges.push('water_guardian');

    await pool.query(
      `UPDATE participants SET quiz_completed = TRUE,
        stage_completed = CASE WHEN stage_completed < 1 THEN 1 ELSE stage_completed END,
        badges = $1 WHERE id = $2`,
      [JSON.stringify(badges), participantId]
    );

    res.json({ success: true, score: participant.quiz_score, badges, badgeTitle: 'حارسة المياه 🛡️' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  كتالوج الابتكارات
// ============================================================
app.get('/api/innovations-catalog', async (req, res) => {
  try {
    const list = all(await pool.query('SELECT * FROM innovations_catalog WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC'));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  إرسال الابتكار
// ============================================================
app.post('/api/innovation/submit', upload.single('image'), async (req, res) => {
  try {
    let participantId = req.session ? req.session.participantId : null;
    let participationCode = req.session ? req.session.participationCode : null;

    if (!participantId) {
      const studentName   = req.body.student_name   || 'مبتكرة حُرّاس المياه';
      const studentSchool = req.body.student_school || 'المدرسة الخضراء';
      const studentGrade  = req.body.student_grade  || 'المرحلة الدراسية';
      participationCode = 'WG-' + uuidv4().slice(0, 8).toUpperCase();

      const created = await pool.query(
        `INSERT INTO participants (participation_code, name, school, grade, quiz_score, stage_completed, badges)
         VALUES ($1,$2,$3,$4,50,3,'["water_guardian","smart_thinker","green_innovator"]') RETURNING id`,
        [participationCode, studentName, studentSchool, studentGrade]
      );
      participantId = created.rows[0].id;
      req.session.participantId = participantId;
      req.session.participationCode = participationCode;
    }

    const { type, innovation_name, problem_description, innovation_idea, how_it_works, technology_use, water_saving_impact, expected_benefits, drawing_data } = req.body;

    let finalImagePath = null;
    if (req.file) {
      finalImagePath = `/uploads/${req.file.filename}`;
    } else if (drawing_data && drawing_data.startsWith('data:image')) {
      finalImagePath = saveBase64Image(drawing_data);
    }

    const result = await pool.query(
      `INSERT INTO innovations (participant_id, type, innovation_name, problem_description, innovation_idea, how_it_works, technology_use, water_saving_impact, expected_benefits, image_path, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING id`,
      [participantId, type || 'new', innovation_name || 'ابتكار ترشيد المياه الذكي',
       problem_description || '', innovation_idea || '', how_it_works || '',
       technology_use || '', water_saving_impact || '', expected_benefits || '', finalImagePath]
    );

    const participant = one(await pool.query('SELECT * FROM participants WHERE id = $1', [participantId]));
    let badges = JSON.parse((participant && participant.badges) || '[]');
    if (!badges.includes('water_guardian')) badges.push('water_guardian');
    if (!badges.includes('smart_thinker')) badges.push('smart_thinker');
    if (!badges.includes('green_innovator')) badges.push('green_innovator');

    await pool.query(
      'UPDATE participants SET stage_completed = 3, badges = $1 WHERE id = $2',
      [JSON.stringify(badges), participantId]
    );

    res.json({
      success: true,
      innovationId: result.rows[0].id,
      participationCode: participationCode || participant.participation_code,
      message: 'أحسنتِ! لقد أصبحتِ الآن من حُرّاس المياه. فكرتكِ قد تكون بداية تغيير حقيقي في مدرستكِ.',
      badges
    });
  } catch (err) {
    console.error('خطأ في إرسال الابتكار:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  المساعد الذكي (نفس المنطق - لا يحتاج DB)
// ============================================================
app.post('/api/ai-hint', (req, res) => {
  try {
    const { field, currentText } = req.body;
    const txt = (currentText || '').trim();
    const smartGuidance = {
      innovation_name: { title: 'تسمية الابتكار ✨', questions: ['ما الكلمة التي تعبر عن الأثر الأكبر لاختراعك؟', 'هل يمكنك دمج كلمتين تقنيتين وبيئيتين مثل: «صنبور المستقبل الذكي»؟'], tips: 'الاسم الجذاب يكون قصيراً وملهمًا ويوضح الغاية!' },
      problem_description: { title: 'تحديد المشكلة بدقة 🔍', questions: ['أين تحدث هذه المشكلة بالتحديد؟', 'كم كمية المياه التي تضيع يومياً بسبب هذا السلوك؟'], tips: 'المشكلة المعرفة بوضوح هي نصف الحل! اذكري السلوك الخاطئ ونتيجته بالأرقام.' },
      innovation_idea: { title: 'جوهر الفكرة الابتكارية 💡', questions: ['ما الذي يجعل فكرتك مختلفة عن الحلول التقليدية؟', 'كيف يشعر مستخدم هذا الابتكار؟'], tips: 'اشرحي فكرتك وكأنكِ تحكين قصة نجاح.' },
      how_it_works: { title: 'آلية العمل ⚙️', questions: ['ما هي الخطوة الأولى عند تشغيل النظام؟', 'ما الذي يحدث تلقائياً عند اكتشاف هدر مياه؟'], tips: 'قسمي الخطوات إلى: رصد → قرار → تنفيذ.' },
      technology_use: { title: 'التكنولوجيا والذكاء الاصطناعي 🤖', questions: ['هل يستخدم ابتكارك حساسات IoT أو كاميرات رؤية حاسوبية أو خوارزميات AI؟', 'هل يتصل النظام بتطبيق هاتف يرسل تنبيهات؟'], tips: 'حددي دور الذكاء الاصطناعي بدقة.' },
      water_saving_impact: { title: 'أثر توفير المياه 💧', questions: ['كم لتراً تتوقعين توفيره يومياً في مدرستك؟', 'إذا طُبق في 100 مدرسة، كم مليون لتر ينقذ سنوياً؟'], tips: 'الأرقام والنسب تمنح فكرتك قوة ومصداقية!' },
      expected_benefits: { title: 'الفوائد الشاملة 🌱', questions: ['ما الفائدة الاقتصادية والبيئية المباشرة للمدرسة؟', 'كيف يساهم في نشر ثقافة الاستدامة؟'], tips: 'تحدثي عن بيئة مدرسية خضراء وذكية.' }
    };
    const guide = smartGuidance[field] || { title: 'إرشاد ابتكاري 🌟', questions: ['كيف تجعلين هذا الجزء أكثر وضوحاً وتفصيلاً؟'], tips: 'أنتِ تبدعين!' };
    let reply = `### ${guide.title}\n\n`;
    reply += txt.length > 5 ? `👏 **تحليل أولي:** فكرة واعدة!\n\n💡 **أسئلة لتطويرها:**\n` : `👋 **دليلكِ:**\n💡 **أسئلة إرشادية:**\n`;
    guide.questions.forEach(q => { reply += `• ${q}\n`; });
    reply += `\n✨ **نصيحة:** ${guide.tips}`;
    res.json({ hint: reply, fieldTitle: guide.title });
  } catch (err) {
    res.json({ hint: 'تابعي التفكير أيتها المبتكرة! 💧' });
  }
});

// ============================================================
//  لوحة الترتيب
// ============================================================
app.get('/api/leaderboard', async (req, res) => {
  try {
    const featuredInnovations = all(await pool.query(`
      SELECT i.id, i.innovation_name, i.type, i.innovation_idea, i.image_path,
             p.name as student_name, p.school as student_school, p.grade as student_grade,
             (i.rating_creativity + i.rating_environmental + i.rating_feasibility + i.rating_technology) as total_rating
      FROM innovations i JOIN participants p ON p.id = i.participant_id
      WHERE i.is_featured = TRUE ORDER BY total_rating DESC, i.id DESC LIMIT 10
    `));
    const topParticipants = all(await pool.query(`
      SELECT name, school, grade, quiz_score, stage_completed,
             (SELECT COUNT(*) FROM innovations WHERE participant_id = participants.id) as inno_count
      FROM participants WHERE quiz_score > 0
      ORDER BY quiz_score DESC, stage_completed DESC, id ASC LIMIT 10
    `));
    res.json({ featuredInnovations, topParticipants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  الإدارة: دخول وخروج
// ============================================================
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = one(await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]));
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

// ============================================================
//  الإحصائيات
// ============================================================
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const totalParticipants = one(await pool.query('SELECT COUNT(*) as cnt FROM participants')).cnt;
    const completedCount    = one(await pool.query('SELECT COUNT(*) as cnt FROM participants WHERE stage_completed >= 3')).cnt;
    const innovationCount   = one(await pool.query('SELECT COUNT(*) as cnt FROM innovations')).cnt;
    const avgScore          = one(await pool.query('SELECT COALESCE(AVG(quiz_score),0) as avg FROM participants WHERE quiz_score > 0')).avg;
    const topStudents       = all(await pool.query('SELECT name, school, quiz_score FROM participants WHERE quiz_score > 0 ORDER BY quiz_score DESC LIMIT 5'));
    const bySchool          = all(await pool.query('SELECT school, COUNT(*) as count FROM participants GROUP BY school ORDER BY count DESC LIMIT 10'));
    const recentParticipants = all(await pool.query('SELECT participation_code, name, school, grade, created_at, quiz_score FROM participants ORDER BY created_at DESC LIMIT 10'));
    res.json({ totalParticipants, completedCount, innovationCount, avgScore: Math.round(avgScore), topStudents, bySchool, recentParticipants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  المشاركون: استعراض وتعديل وحذف
// ============================================================
app.get('/api/admin/participants', requireAdmin, async (req, res) => {
  try {
    const { school, grade, search, page = 1 } = req.query;
    const limit = 30;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (school) { where += ` AND p.school ILIKE $${pIdx++}`; params.push(`%${school}%`); }
    if (grade)  { where += ` AND p.grade = $${pIdx++}`;      params.push(grade); }
    if (search) {
      where += ` AND (p.name ILIKE $${pIdx} OR p.participation_code ILIKE $${pIdx+1})`;
      params.push(`%${search}%`, `%${search}%`); pIdx += 2;
    }

    const participants = all(await pool.query(
      `SELECT p.*, (SELECT COUNT(*) FROM innovations WHERE participant_id = p.id) as innovation_count
       FROM participants p ${where} ORDER BY p.created_at DESC LIMIT $${pIdx} OFFSET $${pIdx+1}`,
      [...params, limit, offset]
    ));
    const total = parseInt(one(await pool.query(`SELECT COUNT(*) as cnt FROM participants p ${where}`, params)).cnt);
    res.json({ participants: participants.map(p => ({ ...p, badges: JSON.parse(p.badges || '[]') })), total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/participant/:id', requireAdmin, async (req, res) => {
  try {
    const { name, school, grade, quiz_score } = req.body;
    await pool.query(
      'UPDATE participants SET name=$1, school=$2, grade=$3, quiz_score=$4 WHERE id=$5',
      [name || '', school || '', grade || '', parseInt(quiz_score) || 0, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث بيانات الطالبة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/participant/:id', requireAdmin, async (req, res) => {
  try {
    const participantId = req.params.id;
    await pool.query('DELETE FROM quiz_answers WHERE participant_id = $1', [participantId]);
    await pool.query('DELETE FROM innovations WHERE participant_id = $1', [participantId]);
    await pool.query('DELETE FROM participants WHERE id = $1', [participantId]);
    res.json({ success: true, message: 'تم حذف المشاركة وسجلاتها بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/participant/:id/answers', requireAdmin, async (req, res) => {
  try {
    const participantId = req.params.id;
    const participant = one(await pool.query('SELECT id,name,school,grade,participation_code,quiz_score FROM participants WHERE id=$1', [participantId]));
    if (!participant) return res.status(404).json({ error: 'المشاركة غير موجودة' });
    const answers = all(await pool.query(
      `SELECT qa.*, q.question_text, q.correct_answer, q.explanation, q.points as max_points, q.question_type
       FROM quiz_answers qa JOIN questions q ON q.id = qa.question_id
       WHERE qa.participant_id = $1 ORDER BY qa.id ASC`,
      [participantId]
    ));
    res.json({ participant, answers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  الابتكارات: استعراض وتعديل وتقييم وحذف
// ============================================================
app.get('/api/admin/innovations', requireAdmin, async (req, res) => {
  try {
    const { type, featured, search, school, page = 1 } = req.query;
    const limit = 30;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (type) { where += ` AND i.type = $${pIdx++}`; params.push(type); }
    if (featured === 'true' || featured === '1') { where += ' AND i.is_featured = TRUE'; }
    if (school) { where += ` AND p.school ILIKE $${pIdx++}`; params.push(`%${school}%`); }
    if (search) {
      where += ` AND (i.innovation_name ILIKE $${pIdx} OR i.innovation_idea ILIKE $${pIdx+1} OR p.name ILIKE $${pIdx+2})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`); pIdx += 3;
    }

    const innovations = all(await pool.query(
      `SELECT i.*, p.name, p.school, p.grade, p.participation_code, p.quiz_score
       FROM innovations i LEFT JOIN participants p ON p.id = i.participant_id
       ${where} ORDER BY i.is_featured DESC, i.submitted_at DESC LIMIT $${pIdx} OFFSET $${pIdx+1}`,
      [...params, limit, offset]
    ));
    const total = parseInt(one(await pool.query(`SELECT COUNT(*) as cnt FROM innovations i LEFT JOIN participants p ON p.id = i.participant_id ${where}`, params)).cnt);
    res.json({ innovations, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/innovation/:id', requireAdmin, async (req, res) => {
  try {
    const inno = one(await pool.query(
      'SELECT i.*, p.name, p.school, p.grade, p.participation_code FROM innovations i LEFT JOIN participants p ON p.id = i.participant_id WHERE i.id = $1',
      [req.params.id]
    ));
    if (!inno) return res.status(404).json({ error: 'الابتكار غير موجود' });
    res.json(inno);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/innovation/:id', requireAdmin, async (req, res) => {
  try {
    const { innovation_name, type, problem_description, innovation_idea, how_it_works, technology_use, water_saving_impact, expected_benefits, rating_creativity, rating_environmental, rating_feasibility, rating_technology, is_featured, admin_notes } = req.body;
    await pool.query(
      `UPDATE innovations SET innovation_name=$1, type=$2, problem_description=$3, innovation_idea=$4, how_it_works=$5, technology_use=$6, water_saving_impact=$7, expected_benefits=$8, rating_creativity=$9, rating_environmental=$10, rating_feasibility=$11, rating_technology=$12, is_featured=$13, admin_notes=$14 WHERE id=$15`,
      [innovation_name||'', type||'new', problem_description||'', innovation_idea||'', how_it_works||'', technology_use||'', water_saving_impact||'', expected_benefits||'', parseInt(rating_creativity)||0, parseInt(rating_environmental)||0, parseInt(rating_feasibility)||0, parseInt(rating_technology)||0, Boolean(is_featured===true||is_featured===1||is_featured==='1'), admin_notes||'', req.params.id]
    );
    res.json({ success: true, message: 'تم تعديل الابتكار بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/innovation/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM innovations WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'تم حذف الابتكار بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/innovation/:id/rate', requireAdmin, async (req, res) => {
  try {
    const { rating_creativity=0, rating_environmental=0, rating_feasibility=0, rating_technology=0, is_featured=0, admin_notes='' } = req.body;
    await pool.query(
      'UPDATE innovations SET rating_creativity=$1, rating_environmental=$2, rating_feasibility=$3, rating_technology=$4, is_featured=$5, admin_notes=$6 WHERE id=$7',
      [parseInt(rating_creativity)||0, parseInt(rating_environmental)||0, parseInt(rating_feasibility)||0, parseInt(rating_technology)||0, Boolean(is_featured===true||is_featured===1||is_featured==='1'), admin_notes||'', req.params.id]
    );
    res.json({ success: true, message: 'تم حفظ التقييم بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  تصدير CSV
// ============================================================
app.get('/api/admin/export', requireAdmin, async (req, res) => {
  try {
    const records = all(await pool.query(`
      SELECT p.participation_code as "كود_المشاركة", p.name as "اسم_الطالبة", p.school as "المدرسة",
             p.grade as "الصف", p.quiz_score as "نقاط_الاختبار", p.stage_completed as "المرحلة_المنجزة",
             p.created_at as "تاريخ_الانضمام", i.type as "نوع_الابتكار", i.innovation_name as "اسم_الابتكار",
             i.problem_description as "المشكلة_المعالجة", i.innovation_idea as "فكرة_الابتكار",
             i.how_it_works as "كيف_يعمل", i.technology_use as "استخدام_التكنولوجيا",
             i.water_saving_impact as "أثر_توفير_المياه", i.expected_benefits as "الفوائد_المتوقعة",
             i.rating_creativity as "تقييم_الإبداع", i.rating_environmental as "الأثر_البيئي",
             i.rating_feasibility as "إمكانية_التطبيق", i.rating_technology as "استخدام_التقنية",
             i.is_featured as "ابتكار_مميز", i.admin_notes as "ملاحظات_المشرف"
      FROM participants p LEFT JOIN innovations i ON i.participant_id = p.id
      ORDER BY p.created_at DESC
    `));
    if (records.length === 0) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="water_guardians_export.csv"');
      return res.send('\uFEFFلا توجد مشاركات مسجلة حتى الآن');
    }
    const headers = Object.keys(records[0]);
    const csvRows = [headers.join(','), ...records.map(row => headers.map(h => `"${(row[h] !== null && row[h] !== undefined ? row[h].toString() : '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="water_guardians_participants.csv"');
    res.send('\uFEFF' + csvRows.join('\r\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  إدارة الأسئلة
// ============================================================
app.get('/api/admin/questions', requireAdmin, async (req, res) => {
  try {
    const questions = all(await pool.query('SELECT * FROM questions ORDER BY stage ASC, sort_order ASC, id ASC'));
    res.json(questions.map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/admin/questions', '/api/admin/question'], requireAdmin, async (req, res) => {
  try {
    const { stage=1, question_text, question_type='multiple', options=[], correct_answer, explanation, points=15, image_url='', is_active=true, sort_order=0 } = req.body;
    if (!question_text) return res.status(400).json({ error: 'نص السؤال مطلوب' });
    const result = await pool.query(
      `INSERT INTO questions (stage, question_text, question_type, options, correct_answer, explanation, points, image_url, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [parseInt(stage)||1, question_text, question_type, JSON.stringify(options), correct_answer||'', explanation||'', parseInt(points)||15, image_url||'', Boolean(is_active), parseInt(sort_order)||0]
    );
    res.json({ success: true, id: result.rows[0].id, message: 'تمت إضافة السؤال بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(['/api/admin/questions/:id', '/api/admin/question/:id'], requireAdmin, async (req, res) => {
  try {
    const { stage=1, question_text, question_type='multiple', options=[], correct_answer, explanation, points=15, image_url='', is_active=true, sort_order=0 } = req.body;
    await pool.query(
      `UPDATE questions SET stage=$1, question_text=$2, question_type=$3, options=$4, correct_answer=$5, explanation=$6, points=$7, image_url=$8, is_active=$9, sort_order=$10 WHERE id=$11`,
      [parseInt(stage)||1, question_text||'', question_type||'multiple', JSON.stringify(options), correct_answer||'', explanation||'', parseInt(points)||15, image_url||'', Boolean(is_active), parseInt(sort_order)||0, req.params.id]
    );
    res.json({ success: true, message: 'تم تحديث السؤال بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch(['/api/admin/questions/:id', '/api/admin/question/:id'], requireAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;
    await pool.query('UPDATE questions SET is_active=$1 WHERE id=$2', [Boolean(is_active), req.params.id]);
    res.json({ success: true, message: 'تم تغيير حالة السؤال' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/admin/questions/:id', '/api/admin/question/:id'], requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM questions WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'تم حذف السؤال بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  كتالوج الابتكارات (إدارة)
// ============================================================
app.post('/api/admin/innovations-catalog', requireAdmin, async (req, res) => {
  try {
    const { title, description, how_it_works, problem_solved, icon='💧', color='#2196F3', sort_order=0 } = req.body;
    const result = await pool.query(
      'INSERT INTO innovations_catalog (title,description,how_it_works,problem_solved,icon,color,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [title, description, how_it_works, problem_solved, icon, color, parseInt(sort_order)||0]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/innovations-catalog/:id', requireAdmin, async (req, res) => {
  try {
    const { title, description, how_it_works, problem_solved, icon='💧', color='#2196F3', is_active=true, sort_order=0 } = req.body;
    await pool.query(
      'UPDATE innovations_catalog SET title=$1, description=$2, how_it_works=$3, problem_solved=$4, icon=$5, color=$6, is_active=$7, sort_order=$8 WHERE id=$9',
      [title, description, how_it_works, problem_solved, icon, color, Boolean(is_active), parseInt(sort_order)||0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/innovations-catalog/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM innovations_catalog WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  فحص سلامة قاعدة البيانات
// ============================================================
app.get('/api/admin/db-health', async (req, res) => {
  try {
    const health = await testDatabaseHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ============================================================
//  الصفحات الرئيسية
// ============================================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.redirect('/#admin'));

// ============================================================
//  تشغيل الخادم (بعد تهيئة DB)
// ============================================================
initDatabase().then(() => {
  const server = app.listen(PORT, () => {
    const ips = getLocalNetworkIps();
    const publicUrl = process.env.PUBLIC_URL || '';
    console.log(`\n🌊 تطبيق «حُرّاس المياه – ابتكري الحل» يعمل الآن:`);
    console.log(`🔗 الواجهة الرئيسية: http://localhost:${PORT}`);
    if (publicUrl) console.log(`🌍 الرابط العام: ${publicUrl}`);
    if (ips.length > 0) console.log(`📱 الشبكة المحلية: http://${ips[0]}:${PORT}`);
    console.log(`⚙️  لوحة الإدارة: http://localhost:${PORT}/admin`);
    console.log(`🔒 لوحة الإدارة محمية بالصلاحيات السرية\n`);
  });
  module.exports = { app, server };
}).catch(err => {
  console.error('❌ فشل تشغيل الخادم:', err.message);
  process.exit(1);
});
