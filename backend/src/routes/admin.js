const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword, comparePassword, generateToken, authMiddleware } = require('../auth');

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
  }

  const token = generateToken(user);
  res.json({
    success: true,
    token,
    user: {
      username: user.username,
      must_change_password: Boolean(user.must_change_password)
    }
  });
});

// POST /api/admin/change-password (Protected)
router.post('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Senha atual e nova senha são obrigatórias.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !comparePassword(currentPassword, user.password_hash)) {
    return res.status(400).json({ success: false, error: 'Senha atual incorreta.' });
  }

  const newHash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, req.user.id);

  // Return new token with updated status
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const token = generateToken(updatedUser);

  res.json({
    success: true,
    token,
    message: 'Senha alterada com sucesso! O aviso de segurança foi desativado.'
  });
});

// GET /api/admin/challenges (Protected)
router.get('/challenges', authMiddleware, (req, res) => {
  const challenges = db.prepare('SELECT * FROM challenges ORDER BY created_at DESC').all();
  res.json({ success: true, challenges });
});

// POST /api/admin/challenges (Protected - Create / Update)
router.post('/challenges', authMiddleware, (req, res) => {
  const { id, key, title, category, date, difficulty, time_limit_seconds, active, challenge_json } = req.body;

  if (!title || !challenge_json) {
    return res.status(400).json({ success: false, error: 'Título e conteúdo do desafio (JSON) são obrigatórios.' });
  }

  const challengeId = id || key || 'ch_' + Date.now();
  const challengeKey = key || challengeId;
  const jsonStr = typeof challenge_json === 'object' ? JSON.stringify(challenge_json) : challenge_json;

  const existing = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);

  const finalTimeLimit = (time_limit_seconds !== undefined && !isNaN(Number(time_limit_seconds))) ? Math.max(0, Number(time_limit_seconds)) : 300;

  if (existing) {
    db.prepare(`
      UPDATE challenges SET
        key = ?, title = ?, category = ?, date = ?, difficulty = ?,
        time_limit_seconds = ?, active = ?, challenge_json = ?
      WHERE id = ?
    `).run(
      challengeKey,
      title,
      category || 'Geral',
      date || null,
      difficulty || 'Médio',
      finalTimeLimit,
      active !== undefined ? (active ? 1 : 0) : 1,
      jsonStr,
      challengeId
    );
  } else {
    db.prepare(`
      INSERT INTO challenges (id, key, title, category, date, difficulty, time_limit_seconds, active, challenge_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      challengeId,
      challengeKey,
      title,
      category || 'Geral',
      date || null,
      difficulty || 'Médio',
      finalTimeLimit,
      active !== undefined ? (active ? 1 : 0) : 1,
      jsonStr
    );
  }

  res.json({ success: true, message: 'Desafio salvo com sucesso.', id: challengeId });
});

// DELETE /api/admin/challenges/:id (Protected)
router.delete('/challenges/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Desafio removido com sucesso.' });
});

// GET /api/admin/responses (Protected - List all student responses)
router.get('/responses', authMiddleware, (req, res) => {
  const responses = db.prepare(`
    SELECT r.*, c.title as challenge_title 
    FROM responses r 
    LEFT JOIN challenges c ON r.challenge_id = c.id
    ORDER BY r.submitted_at DESC
  `).all();
  res.json({ success: true, responses });
});

// GET /api/admin/students (Protected - List all students)
router.get('/students', authMiddleware, (req, res) => {
  const students = db.prepare('SELECT * FROM students ORDER BY student_id ASC').all();
  res.json({ success: true, students });
});

// POST /api/admin/students (Protected - Create / Update student)
router.post('/students', authMiddleware, (req, res) => {
  const { student_id, display_name, active } = req.body;
  if (!display_name || !display_name.trim()) {
    return res.status(400).json({ success: false, error: 'O nome de exibição do aluno é obrigatório.' });
  }

  let finalId = student_id ? student_id.trim() : '';
  if (!finalId) {
    // Busca todos os IDs existentes com padrão st_XX para calcular o próximo número sequencial
    const rows = db.prepare("SELECT student_id FROM students WHERE student_id LIKE 'st_%'").all();
    let maxNum = 0;
    rows.forEach(r => {
      const match = r.student_id.match(/st_(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    finalId = `st_${String(maxNum + 1).padStart(2, '0')}`;
  }

  const existing = db.prepare('SELECT * FROM students WHERE student_id = ?').get(finalId);
  const activeVal = active !== undefined ? (active ? 1 : 0) : 1;

  if (existing) {
    db.prepare('UPDATE students SET display_name = ?, active = ? WHERE student_id = ?')
      .run(display_name.trim(), activeVal, finalId);
  } else {
    db.prepare('INSERT INTO students (student_id, display_name, active) VALUES (?, ?, ?)')
      .run(finalId, display_name.trim(), activeVal);
  }

  res.json({ success: true, message: 'Estudante salvo com sucesso.', student_id: finalId });
});

// DELETE /api/admin/students/:id (Protected - Delete student)
router.delete('/students/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM students WHERE student_id = ?').run(req.params.id);
  res.json({ success: true, message: 'Estudante removido com sucesso.' });
});

// PUT /api/admin/config (Protected)
router.put('/config', authMiddleware, (req, res) => {
  const configs = req.body;
  if (!configs || typeof configs !== 'object') {
    return res.status(400).json({ success: false, error: 'Payload inválido.' });
  }

  const upsert = db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  
  Object.keys(configs).forEach(key => {
    upsert.run(key, String(configs[key]));
  });

  res.json({ success: true, message: 'Configurações salvas com sucesso.' });
});

module.exports = router;
