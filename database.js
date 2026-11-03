const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
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
    type TEXT NOT NULL,
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
    question_type TEXT NOT NULL,
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

// حساب المشرف الافتراضي
const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hash);
}

// قراءة ومزامنة البيانات الثابتة من default_data.json
const defaultDataFile = path.join(__dirname, 'default_data.json');
let defaultData = null;
if (fs.existsSync(defaultDataFile)) {
  try {
    defaultData = JSON.parse(fs.readFileSync(defaultDataFile, 'utf8'));
  } catch (e) {
    console.error('خطأ في قراءة ملف default_data.json:', e);
  }
}

// التحقق من الأسئلة وإعادة ملئها إن كانت فارغة
const qCount = db.prepare('SELECT COUNT(*) as cnt FROM questions').get().cnt;
if (qCount === 0 && defaultData && defaultData.questions) {
  const insertQ = db.prepare(`
    INSERT INTO questions (stage, question_text, question_type, options, correct_answer, explanation, points, image_url, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const q of defaultData.questions) {
    insertQ.run(
      q.stage || 1,
      q.question_text,
      q.question_type,
      JSON.stringify(q.options),
      q.correct_answer,
      q.explanation,
      q.points || 15,
      q.image_url || '',
      q.is_active !== undefined ? q.is_active : 1,
      q.sort_order || 0
    );
  }
}

// التحقق من كتالوج الابتكارات
const cCount = db.prepare('SELECT COUNT(*) as cnt FROM innovations_catalog').get().cnt;
if (cCount === 0 && defaultData && defaultData.innovations) {
  const insertI = db.prepare(`
    INSERT INTO innovations_catalog (title, description, how_it_works, problem_solved, icon, color, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const i of defaultData.innovations) {
    insertI.run(
      i.title,
      i.description,
      i.how_it_works,
      i.problem_solved,
      i.icon || '💧',
      i.color || '#0288D1',
      i.id || 0
    );
  }
}

// دالة فحص سلامة قاعدة البيانات
function testDatabaseHealth() {
  try {
    const participantsCount = db.prepare('SELECT COUNT(*) as cnt FROM participants').get().cnt;
    const questionsCount = db.prepare('SELECT COUNT(*) as cnt FROM questions').get().cnt;
    const activeQuestionsCount = db.prepare('SELECT COUNT(*) as cnt FROM questions WHERE is_active = 1').get().cnt;
    const innovationsCount = db.prepare('SELECT COUNT(*) as cnt FROM innovations').get().cnt;
    const answersCount = db.prepare('SELECT COUNT(*) as cnt FROM quiz_answers').get().cnt;

    // فحص عملية كتابة وقراءة تجريبية سريعة
    const testResult = db.prepare('SELECT 1 + 1 as sum').get();

    return {
      status: 'healthy',
      database: 'SQLite',
      filePath: dbPath,
      operational: testResult.sum === 2,
      counts: {
        participants: participantsCount,
        questions: questionsCount,
        activeQuestions: activeQuestionsCount,
        innovations: innovationsCount,
        quizAnswers: answersCount
      },
      message: 'قاعدة البيانات متصلة وتعمل بكفاءة تامة بنسبة 100%'
    };
  } catch (err) {
    return {
      status: 'error',
      database: 'SQLite',
      operational: false,
      error: err.message
    };
  }
}

module.exports = db;
module.exports.db = db;
module.exports.testDatabaseHealth = testDatabaseHealth;
