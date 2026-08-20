const express = require('express');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);

// Static files (Frontend with clean .html extensions support)
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath, { extensions: ['html', 'htm'] }));

// Explicit clean route for admin and aluno
app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin.html'));
});

app.get('/aluno', (req, res) => {
  res.sendFile(path.join(frontendPath, 'aluno.html'));
});

// Fallback to index.html for unknown non-API routes (SPA support)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Rota de API não encontrada.' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando com sucesso em http://0.0.0.0:${PORT}`);
});
