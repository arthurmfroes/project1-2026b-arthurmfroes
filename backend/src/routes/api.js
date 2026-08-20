const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to safely parse SQLite / ISO timestamp to epoch ms
function parseDbTimestamp(ts) {
  if (!ts) return Date.now();
  if (typeof ts === 'number' || !isNaN(Number(ts))) return Number(ts);
  let str = String(ts).trim();
  if (str.includes('Z') || str.includes('+')) return new Date(str).getTime();
  // SQLite "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SSZ"
  const isoUtc = str.replace(' ', 'T') + 'Z';
  return new Date(isoUtc).getTime();
}

// Helper to format config object
function getConfigObject() {
  const rows = db.prepare('SELECT key, value FROM config').all();
  const config = {
    course_name: 'Desafio do Dia',
    timezone: 'America/Sao_Paulo',
    allow_manual_name: true,
    frontend_version: '1.2.0',
    challenge_selection_mode: 'date'
  };

  rows.forEach(r => {
    if (r.key === 'allow_manual_name') {
      config[r.key] = r.value === 'true' || r.value === '1';
    } else {
      config[r.key] = r.value;
    }
  });

  return config;
}

// Helper to get active challenge for today + next challenge date
function getTodayChallengeInfo() {
  const today = new Date().toISOString().split('T')[0];

  const matchRow = db.prepare(`
    SELECT * FROM challenges 
    WHERE active = 1 AND date = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(today);

  let currentChallenge = null;
  if (matchRow) {
    try {
      const parsed = JSON.parse(matchRow.challenge_json);
      currentChallenge = parsed.challenge ? parsed.challenge : parsed;
      currentChallenge.category = matchRow.category || currentChallenge.category || 'Geral';
      currentChallenge.date = matchRow.date || currentChallenge.date || today;
      currentChallenge.time_limit_seconds = matchRow.time_limit_seconds !== undefined ? matchRow.time_limit_seconds : (currentChallenge.time_limit_seconds || 0);
    } catch (e) {
      console.error('Malformed challenge_json for ID:', matchRow.id);
    }
  }

  let nextChallengeDate = null;
  if (!currentChallenge) {
    const nextRow = db.prepare(`
      SELECT date FROM challenges 
      WHERE active = 1 AND date > ?
      ORDER BY date ASC LIMIT 1
    `).get(today);

    if (nextRow && nextRow.date) {
      nextChallengeDate = nextRow.date;
    }
  }

  return {
    challenge: currentChallenge,
    today,
    next_challenge_date: nextChallengeDate
  };
}

// GET /api/config
router.get('/config', (req, res) => {
  res.json({ success: true, app: getConfigObject() });
});

// GET /api/students
router.get('/students', (req, res) => {
  const students = db.prepare('SELECT student_id, display_name, active FROM students WHERE active = 1').all();
  res.json({ success: true, students });
});

// GET /api/challenges/today
router.get('/challenges/today', (req, res) => {
  const info = getTodayChallengeInfo();
  res.json({
    success: true,
    current_challenge: info.challenge,
    next_challenge_date: info.next_challenge_date,
    message: info.challenge ? 'Desafio de hoje encontrado.' : 'Nenhum desafio ativo para hoje.'
  });
});

// GET /api/bootstrap
router.get('/bootstrap', (req, res) => {
  const appConfig = getConfigObject();
  const students = db.prepare('SELECT student_id, display_name, active FROM students WHERE active = 1').all();
  const info = getTodayChallengeInfo();

  res.json({
    success: true,
    app: appConfig,
    students,
    current_challenge: info.challenge,
    current_challenge_key: info.challenge ? info.challenge.challenge_id || info.challenge.id : '',
    next_challenge_date: info.next_challenge_date,
    message: info.challenge ? 'Dados iniciais carregados.' : 'Nenhum desafio ativo para hoje.'
  });
});

// POST /api/challenges/start (Inicia ou recupera o cronômetro seguro no backend anti-F5)
router.post('/challenges/start', (req, res) => {
  const { student_identifier, challenge_id } = req.body;
  if (!student_identifier || !challenge_id) {
    return res.status(400).json({ success: false, error: 'Identificador do aluno e do desafio são obrigatórios.' });
  }

  const challengeRow = db.prepare('SELECT * FROM challenges WHERE id = ? OR key = ?').get(challenge_id, challenge_id);
  if (!challengeRow) {
    return res.status(404).json({ success: false, error: 'Desafio não encontrado.' });
  }

  const timeLimit = challengeRow.time_limit_seconds !== undefined ? challengeRow.time_limit_seconds : 300;

  if (timeLimit === 0) {
    return res.json({
      success: true,
      has_timer: false,
      started_at: null,
      elapsed_seconds: 0,
      remaining_seconds: 0,
      is_expired: false,
      time_limit_seconds: 0
    });
  }

  // Insert or get existing start time
  let startRow = db.prepare(`
    SELECT * FROM challenge_starts 
    WHERE student_identifier = ? AND challenge_id = ?
  `).get(student_identifier, challenge_id);

  if (!startRow) {
    const isoNow = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO challenge_starts (student_identifier, challenge_id, started_at)
        VALUES (?, ?, ?)
      `).run(student_identifier, challenge_id, isoNow);

      startRow = db.prepare(`
        SELECT * FROM challenge_starts 
        WHERE student_identifier = ? AND challenge_id = ?
      `).get(student_identifier, challenge_id);
    } catch (err) {
      console.error('Erro ao registrar início do desafio:', err);
    }
  }

  // Calculate elapsed time strictly in UTC ms
  const startTime = parseDbTimestamp(startRow.started_at);
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
  const remainingSeconds = Math.max(0, timeLimit - elapsedSeconds);
  const isExpired = elapsedSeconds >= timeLimit;

  res.json({
    success: true,
    has_timer: true,
    started_at: startRow.started_at,
    elapsed_seconds: elapsedSeconds,
    remaining_seconds: remainingSeconds,
    is_expired: isExpired,
    time_limit_seconds: timeLimit
  });
});

// GET /api/challenges/status (Verifica status do cronômetro E se já respondeu no backend)
router.get('/challenges/status', (req, res) => {
  const { student_identifier, challenge_id } = req.query;
  if (!student_identifier || !challenge_id) {
    return res.json({ success: true, started: false, already_submitted: false, has_timer: true });
  }

  const challengeRow = db.prepare('SELECT * FROM challenges WHERE id = ? OR key = ?').get(challenge_id, challenge_id);
  if (!challengeRow) {
    return res.json({ success: true, started: false, already_submitted: false, has_timer: true });
  }

  // Checa se o estudante já enviou uma resposta para este desafio previamente
  const existingResponse = db.prepare(`
    SELECT * FROM responses 
    WHERE (student_id = ? OR student_display_name = ?) 
      AND (challenge_id = ? OR challenge_key = ?)
  `).get(student_identifier, student_identifier, challenge_id, challenge_id);

  if (existingResponse) {
    let feedback = {};
    let userResponses = {};
    try { feedback = JSON.parse(existingResponse.feedback_json || '{}'); } catch (e) {}
    try { userResponses = JSON.parse(existingResponse.response_json || '{}'); } catch (e) {}

    return res.json({
      success: true,
      already_submitted: true,
      started: true,
      has_timer: false,
      submission: {
        submission_id: existingResponse.id,
        is_correct: existingResponse.is_correct === 1,
        elapsed_seconds: existingResponse.elapsed_seconds,
        submitted_at: existingResponse.submitted_at,
        user_responses: userResponses,
        feedback
      }
    });
  }

  const timeLimit = challengeRow.time_limit_seconds !== undefined ? challengeRow.time_limit_seconds : 300;

  if (timeLimit === 0) {
    return res.json({
      success: true,
      already_submitted: false,
      has_timer: false,
      started: true,
      is_expired: false,
      time_limit_seconds: 0
    });
  }

  const startRow = db.prepare(`
    SELECT * FROM challenge_starts 
    WHERE student_identifier = ? AND challenge_id = ?
  `).get(student_identifier, challenge_id);

  if (!startRow) {
    return res.json({ success: true, already_submitted: false, started: false, has_timer: true });
  }

  const startTime = parseDbTimestamp(startRow.started_at);
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
  const remainingSeconds = Math.max(0, timeLimit - elapsedSeconds);
  const isExpired = elapsedSeconds >= timeLimit;

  res.json({
    success: true,
    already_submitted: false,
    has_timer: true,
    started: true,
    started_at: startRow.started_at,
    elapsed_seconds: elapsedSeconds,
    remaining_seconds: remainingSeconds,
    is_expired: isExpired,
    time_limit_seconds: timeLimit
  });
});

// GET /api/challenges (Demanda 2 - Filtrar por categoria / data)
router.get('/challenges', (req, res) => {
  const { category, date } = req.query;
  let query = 'SELECT id, key, title, category, date, difficulty, time_limit_seconds, active FROM challenges WHERE active = 1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (date) {
    query += ' AND date = ?';
    params.push(date);
  }

  query += ' ORDER BY date DESC, created_at DESC';

  const challenges = db.prepare(query).all(params);
  res.json({ success: true, challenges });
});

// GET /api/students/:identifier/stats (Demanda 4 - Dashboard de Desempenho)
router.get('/students/:identifier/stats', (req, res) => {
  const identifier = req.params.identifier;
  
  const responses = db.prepare(`
    SELECT r.*, c.title as challenge_title, c.category as challenge_category, c.challenge_json
    FROM responses r
    LEFT JOIN challenges c ON r.challenge_id = c.id
    WHERE r.student_id = ? OR r.student_display_name = ?
    ORDER BY r.submitted_at DESC
  `).all(identifier, identifier);

  const totalSubmitted = responses.length;
  let correctCount = 0;
  let incorrectCount = 0;

  const history = responses.map(r => {
    if (r.is_correct === 1) correctCount++;
    else if (r.is_correct === 0) incorrectCount++;

    return {
      submission_id: r.id,
      challenge_id: r.challenge_id,
      challenge_title: r.challenge_title || r.challenge_id,
      category: r.challenge_category || 'Geral',
      submitted_at: r.submitted_at,
      is_correct: r.is_correct,
      elapsed_seconds: r.elapsed_seconds,
      response_json: r.response_json,
      feedback_json: r.feedback_json,
      challenge_json: r.challenge_json
    };
  });

  const evaluatedCount = correctCount + incorrectCount;
  const accuracyPercentage = evaluatedCount > 0 
    ? Number(((correctCount / evaluatedCount) * 100).toFixed(1)) 
    : 0;

  res.json({
    success: true,
    student_identifier: identifier,
    student_name: responses.length > 0 ? responses[0].student_display_name : identifier,
    stats: {
      total_submitted: totalSubmitted,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      accuracy_percentage: accuracyPercentage,
      history
    }
  });
});

// POST /api/responses (Submeter Resposta & Validação Única Rigorosa no Backend)
router.post('/responses', (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, error: 'Payload deve ser um objeto JSON.' });
    }

    const {
      challenge_id,
      challenge_version,
      challenge_key,
      student_id,
      student_display_name,
      student_source,
      response_json,
      frontend_version
    } = body;

    if (!challenge_id || !student_display_name || !student_source || !response_json) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes na submissão.' });
    }

    const studentIdentifier = student_id || student_display_name;

    const challengeRow = db.prepare('SELECT * FROM challenges WHERE id = ? OR key = ?').get(challenge_id, challenge_key || challenge_id);
    if (!challengeRow) {
      return res.status(404).json({ success: false, error: 'Desafio não encontrado.' });
    }

    // REGRA DE NEGÓCIO RIGOROSA: APENAS 1 SUBMISSÃO POR ESTUDANTE POR DESAFIO
    const existingResponse = db.prepare(`
      SELECT * FROM responses 
      WHERE (student_id = ? OR student_display_name = ?) 
        AND (challenge_id = ? OR challenge_key = ?)
    `).get(studentIdentifier, student_display_name, challenge_id, challenge_key || challenge_id);

    if (existingResponse) {
      let feedback = {};
      try { feedback = JSON.parse(existingResponse.feedback_json || '{}'); } catch(e) {}
      
      return res.status(400).json({
        success: false,
        already_submitted: true,
        error: 'Você já enviou uma resposta para este desafio! Não é permitido alterar a resposta enviada.',
        submission_id: existingResponse.id,
        is_correct: existingResponse.is_correct === 1,
        elapsed_seconds: existingResponse.elapsed_seconds,
        feedback
      });
    }

    const timeLimit = challengeRow.time_limit_seconds !== undefined ? challengeRow.time_limit_seconds : 300;
    let actualElapsedSeconds = body.elapsed_seconds || 0;

    // Se houver limite de tempo (> 0), faz checagem rigorosa
    if (timeLimit > 0) {
      const startRow = db.prepare(`
        SELECT * FROM challenge_starts 
        WHERE student_identifier = ? AND challenge_id = ?
      `).get(studentIdentifier, challenge_id);

      if (startRow) {
        const startTime = parseDbTimestamp(startRow.started_at);
        actualElapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      }

      const exceededTime = actualElapsedSeconds > timeLimit;
      if (exceededTime) {
        return res.status(400).json({
          success: false,
          error: '⏱️ Tempo esgotado! O envio de respostas foi bloqueado pelo servidor pois o tempo limite expirou.'
        });
      }
    }

    // Evaluate submission
    let isCorrect = null;
    let feedbackJson = {};

    try {
      const parsed = JSON.parse(challengeRow.challenge_json);
      const challengeObj = parsed.challenge || parsed;
      const responseModel = challengeObj.response;

      if (responseModel && responseModel.type === 'mixed' && Array.isArray(responseModel.fields)) {
        const choiceField = responseModel.fields.find(f => f.type === 'single_choice' && f.correct_option_id);
        if (choiceField) {
          const userChoice = response_json[choiceField.id];
          isCorrect = (String(userChoice) === String(choiceField.correct_option_id)) ? 1 : 0;
          feedbackJson = parsed.feedback || {
            messages: [isCorrect ? 'Resposta correta!' : 'Resposta incorreta. Tente novamente!']
          };
        }
      }
    } catch (e) {
      console.error('Erro ao avaliar resposta:', e);
    }

    // Insert response into DB
    const stmt = db.prepare(`
      INSERT INTO responses (
        challenge_id, challenge_key, student_id, student_display_name,
        student_source, response_json, feedback_json, is_correct,
        elapsed_seconds, frontend_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      challenge_id,
      challenge_key || challenge_id,
      student_id || null,
      student_display_name,
      student_source,
      JSON.stringify(response_json),
      JSON.stringify(feedbackJson),
      isCorrect,
      actualElapsedSeconds,
      frontend_version || '1.2.0'
    );

    res.json({
      success: true,
      submission_id: result.lastInsertRowid,
      is_correct: isCorrect === 1,
      exceeded_time: false,
      elapsed_seconds: actualElapsedSeconds,
      feedback: feedbackJson
    });
  } catch (err) {
    console.error('Erro no POST /api/responses:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
