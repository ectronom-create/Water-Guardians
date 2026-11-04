/**
 * database-pg.js
 * طبقة قاعدة بيانات PostgreSQL (Supabase) متوافقة مع API بسيط
 * تستبدل better-sqlite3 بشكل شفاف للنشر السحابي
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// اتصال بقاعدة البيانات من متغير البيئة
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase')
    ? { rejectUnauthorized: false }
    : false
});

// تهيئة الجداول
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        participation_code TEXT UNIQUE NOT NULL,
        name TEXT,
        school TEXT,
        grade TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        quiz_score INTEGER DEFAULT 0,
        quiz_completed BOOLEAN DEFAULT FALSE,
        stage_completed INTEGER DEFAULT 0,
        badges TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS quiz_answers (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        question_id INTEGER,
        answer TEXT,
        is_correct BOOLEAN,
        points_earned INTEGER DEFAULT 0,
        answered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS innovations (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
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
        is_featured BOOLEAN DEFAULT FALSE,
        admin_notes TEXT,
        submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        stage INTEGER NOT NULL DEFAULT 1,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL,
        options TEXT,
        correct_answer TEXT,
        explanation TEXT,
        points INTEGER DEFAULT 10,
        image_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS innovations_catalog (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        how_it_works TEXT NOT NULL,
        problem_solved TEXT NOT NULL,
        icon TEXT DEFAULT '💧',
        color TEXT DEFAULT '#2196F3',
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0
      );
    `);

    // إنشاء حساب admin الافتراضي
    const adminCheck = await client.query("SELECT id FROM admin_users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await client.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    }

    // تحميل البيانات الافتراضية إن كانت الجداول فارغة
    const defaultDataFile = path.join(__dirname, 'default_data.json');
    if (fs.existsSync(defaultDataFile)) {
      const defaultData = JSON.parse(fs.readFileSync(defaultDataFile, 'utf8'));

      const qCount = await client.query('SELECT COUNT(*) as cnt FROM questions');
      if (parseInt(qCount.rows[0].cnt) === 0 && defaultData.questions) {
        for (const q of defaultData.questions) {
          await client.query(
            `INSERT INTO questions (stage, question_text, question_type, options, correct_answer, explanation, points, image_url, is_active, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              q.stage || 1, q.question_text, q.question_type,
              JSON.stringify(q.options), q.correct_answer, q.explanation,
              q.points || 15, q.image_url || '', q.is_active !== false, q.sort_order || 0
            ]
          );
        }
      }

      const cCount = await client.query('SELECT COUNT(*) as cnt FROM innovations_catalog');
      if (parseInt(cCount.rows[0].cnt) === 0 && defaultData.innovations) {
        for (const i of defaultData.innovations) {
          await client.query(
            `INSERT INTO innovations_catalog (title, description, how_it_works, problem_solved, icon, color, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [i.title, i.description, i.how_it_works, i.problem_solved, i.icon || '💧', i.color || '#0288D1', i.id || 0]
          );
        }
      }
    }

    console.log('✅ قاعدة بيانات PostgreSQL جاهزة وتعمل بكفاءة');
  } catch (err) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// قراءة health قاعدة البيانات
async function testDatabaseHealth() {
  try {
    const client = await pool.connect();
    const pCount = await client.query('SELECT COUNT(*) as cnt FROM participants');
    const qCount = await client.query('SELECT COUNT(*) as cnt FROM questions');
    const aqCount = await client.query('SELECT COUNT(*) as cnt FROM questions WHERE is_active = TRUE');
    const iCount = await client.query('SELECT COUNT(*) as cnt FROM innovations');
    const aCount = await client.query('SELECT COUNT(*) as cnt FROM quiz_answers');
    client.release();
    return {
      status: 'healthy',
      database: 'PostgreSQL (Supabase)',
      operational: true,
      counts: {
        participants: parseInt(pCount.rows[0].cnt),
        questions: parseInt(qCount.rows[0].cnt),
        activeQuestions: parseInt(aqCount.rows[0].cnt),
        innovations: parseInt(iCount.rows[0].cnt),
        quizAnswers: parseInt(aCount.rows[0].cnt)
      },
      message: 'قاعدة البيانات السحابية متصلة وتعمل بكفاءة 100%'
    };
  } catch (err) {
    return { status: 'error', database: 'PostgreSQL', operational: false, error: err.message };
  }
}

module.exports = { pool, initDatabase, testDatabaseHealth };
