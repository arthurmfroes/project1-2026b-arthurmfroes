const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Enforce foreign keys
db.pragma('foreign_keys = ON');

function initDb() {
  // 1. Config table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();

  // Seed default configs if empty
  const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get().count;
  if (configCount === 0) {
    const insertConfig = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)');
    insertConfig.run('course_name', 'Desafio do Dia');
    insertConfig.run('timezone', 'America/Sao_Paulo');
    insertConfig.run('allow_manual_name', 'true');
    insertConfig.run('frontend_version', '1.2.0');
    insertConfig.run('challenge_selection_mode', 'date');
  }

  // 2. Users table (Admins)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      must_change_password INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Seed default admin user if not exists
  const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, must_change_password)
      VALUES (?, ?, 1)
    `).run('admin', defaultPasswordHash);
  }

  // 3. Students table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS students (
      student_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Seed default students if empty
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  if (studentCount === 0) {
    const insertStudent = db.prepare('INSERT INTO students (student_id, display_name, active) VALUES (?, ?, 1)');
    insertStudent.run('st_01', 'Ana Silva');
    insertStudent.run('st_02', 'Bruno Oliveira');
    insertStudent.run('st_03', 'Carla Souza');
    insertStudent.run('st_04', 'Diego Santos');
  }

  // 4. Challenges table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'Geral',
      date TEXT,
      difficulty TEXT DEFAULT 'Médio',
      time_limit_seconds INTEGER DEFAULT 300,
      active INTEGER DEFAULT 1,
      challenge_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Seed sample challenge if empty
  const challengeCount = db.prepare('SELECT COUNT(*) as count FROM challenges').get().count;
  if (challengeCount === 0) {
    const today = new Date().toISOString().split('T')[0];
    
    const sampleChallengeObj = {
      id: "web-client-server-fetch",
      label: "Cliente, servidor e fetch",
      challenge: {
        challenge_id: "web-client-server-fetch",
        version: 1,
        title: "O que acontece após o clique?",
        category: "Desenvolvimento Web",
        date: today,
        topics: ["desenvolvimento web", "cliente e servidor", "HTTP", "fetch"],
        difficulty: "Iniciante",
        time_limit_seconds: 180,
        intro: [
          {
            type: "markdown",
            content: "Uma aplicação web normalmente distribui seu funcionamento entre o navegador e algum serviço acessível pela rede."
          },
          {
            type: "markdown",
            content: "O navegador executa JavaScript e quando precisa de informações externas envia requisições HTTP para um servidor."
          }
        ],
        prompt: [
          {
            type: "code",
            language: "html",
            content: `<button id="load">Carregar mensagem</button>\n<p id="result"></p>\n\n<script>\n  document.querySelector("#load").addEventListener("click", async () => {\n    const response = await fetch("/api/message");\n    const data = await response.json();\n    document.querySelector("#result").textContent = data.message;\n  });\n</script>`
          },
          {
            type: "question",
            content: "Qual alternativa descreve corretamente o que acontece depois que o usuário clica no botão?"
          }
        ],
        response: {
          type: "mixed",
          fields: [
            {
              id: "choice",
              type: "single_choice",
              label: "Escolha a melhor resposta",
              required: true,
              correct_option_id: "c",
              options: [
                { id: "a", label: "O navegador abre um arquivo /api/message e insere o conteúdo diretamente no parágrafo." },
                { id: "b", label: "O JavaScript é executado no servidor, que altera o DOM do navegador de forma remota." },
                { id: "c", label: "O JavaScript roda no navegador, faz requisição HTTP via fetch, recebe o JSON e atualiza o <p>." },
                { id: "d", label: "A página toda recarrega completamente para exibir a nova mensagem." }
              ]
            },
            {
              id: "explanation",
              type: "open_text",
              label: "Como você pensou sobre a resposta?",
              required: false,
              placeholder: "Explique seu raciocínio..."
            }
          ]
        }
      },
      feedback: {
        messages: [
          "Resposta correta: C. O evento de clique, a chamada fetch e a alteração do DOM ocorrem no navegador cliente."
        ]
      }
    };

    const insertChallenge = db.prepare(`
      INSERT INTO challenges (id, key, title, category, date, difficulty, time_limit_seconds, active, challenge_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    insertChallenge.run(
      'web-client-server-fetch',
      'web-client-server-fetch',
      'O que acontece após o clique?',
      'Desenvolvimento Web',
      today,
      'Iniciante',
      180,
      JSON.stringify(sampleChallengeObj)
    );
  }

  // 5. Responses table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      challenge_id TEXT NOT NULL,
      challenge_key TEXT NOT NULL,
      student_id TEXT,
      student_display_name TEXT NOT NULL,
      student_source TEXT NOT NULL,
      response_json TEXT NOT NULL,
      feedback_json TEXT,
      is_correct INTEGER,
      elapsed_seconds INTEGER DEFAULT 0,
      frontend_version TEXT
    )
  `).run();

  // 6. Challenge Starts table (Para controle seguro de tempo no Backend anti-F5)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS challenge_starts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_identifier TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_identifier, challenge_id)
    )
  `).run();
}

initDb();

module.exports = db;
