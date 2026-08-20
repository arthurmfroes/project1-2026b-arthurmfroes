// Componente Genérico de Modal Reutilizável
function genericModal(initialOpen = false) {
  return {
    isOpen: initialOpen,
    title: '',
    data: null,
    open(title = '', data = null) {
      this.title = title;
      this.data = data;
      this.isOpen = true;
    },
    close() {
      this.isOpen = false;
      this.data = null;
    }
  };
}

// Componente Genérico e Reutilizável de Seletor de Categoria (Enum + Custom em Estética Neo-Brutalista)
function categorySelector(initialValue = 'Desenvolvimento Web', availableCategories = []) {
  return {
    value: initialValue || 'Desenvolvimento Web',
    query: initialValue || 'Desenvolvimento Web',
    isOpen: false,
    
    // Categorias padrão do Enum
    presetCategories: [
      "Desenvolvimento Web",
      "JavaScript",
      "HTML & CSS",
      "Engenharia de Software",
      "Bancos de Dados",
      "Arquitetura de Software",
      "Geral"
    ],
    
    get allCategories() {
      const merged = new Set([...this.presetCategories, ...(availableCategories || [])]);
      return Array.from(merged);
    },

    get filteredCategories() {
      if (!this.query || this.query.trim() === '') return this.allCategories;
      const q = this.query.toLowerCase().trim();
      return this.allCategories.filter(c => c.toLowerCase().includes(q));
    },

    selectCategory(cat) {
      this.value = cat;
      this.query = cat;
      this.isOpen = false;
    },

    onInput() {
      this.value = this.query;
      this.isOpen = true;
    }
  };
}

function adminApp() {
  return {
    token: localStorage.getItem('admin_token') || null,
    username: '',
    mustChangePassword: false,
    isLoggedIn: false,
    loading: false,

    // Navigation Tabs
    activeTab: 'challenges', // 'challenges' | 'responses' | 'students'

    // Login Form
    loginUsername: '',
    loginPassword: '',
    loginError: '',

    // Modais Genéricos Reutilizáveis
    challengeModal: genericModal(),
    responseModal: genericModal(),
    passwordModal: genericModal(),
    studentModal: genericModal(),

    // Modo de Edição de Desafios ('visual' | 'json')
    editorMode: 'visual',

    // State do Formulário Principal de Desafio
    editingChallengeId: null,
    chTitle: '',
    chCategory: 'Desenvolvimento Web',
    chDate: new Date().toISOString().split('T')[0],
    chTime: 180,
    chDifficulty: 'Médio',
    chJson: '',
    chMsg: '',
    chMsgType: 'error',
    savingChallenge: false,

    // State do Construtor Visual de Questões (Visual Form Builder)
    builderIntroText: '',
    builderCodeSnippet: '',
    builderCodeLang: 'html',
    builderQuestionPrompt: '',
    builderOptions: [
      { id: 'a', label: '' },
      { id: 'b', label: '' },
      { id: 'c', label: '' },
      { id: 'd', label: '' }
    ],
    builderCorrectOptionId: 'a',
    builderFeedbackText: '',

    // State do Formulário de Alunos (Student Management)
    editingStudentId: '',
    stDisplayName: '',
    stActive: true,
    stMsg: '',
    stMsgType: 'error',
    savingStudent: false,

    // State do Formulário de Senha
    passCurrent: '',
    passNew: '',
    passMsg: '',
    passMsgType: 'error',

    // Lists
    challenges: [],
    responses: [],
    students: [],

    // Filters for responses
    selectedChallengeFilter: '',
    studentSearchFilter: '',

    get existingCategories() {
      const defaults = ["Desenvolvimento Web", "JavaScript", "HTML & CSS", "Engenharia de Software", "Bancos de Dados", "Geral"];
      const fromChallenges = this.challenges.map(c => c.category).filter(Boolean);
      return Array.from(new Set([...defaults, ...fromChallenges]));
    },

    get filteredResponses() {
      return this.responses.filter(r => {
        const matchesChallenge = !this.selectedChallengeFilter || String(r.challenge_id) === String(this.selectedChallengeFilter);
        const matchesStudent = !this.studentSearchFilter || 
          r.student_display_name.toLowerCase().includes(this.studentSearchFilter.toLowerCase().trim());
        return matchesChallenge && matchesStudent;
      });
    },

    init() {
      this.resetChallengeForm();

      if (this.token) {
        this.verifyAndSetUser();
      }
    },

    verifyAndSetUser() {
      try {
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        this.username = payload.username || 'Admin';
        this.mustChangePassword = Boolean(payload.must_change_password);
        this.isLoggedIn = true;
        this.loadChallenges();
        this.loadResponses();
        this.loadStudents();
      } catch (e) {
        this.logout();
      }
    },

    getHeaders() {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      };
    },

    async login() {
      this.loginError = '';
      this.loading = true;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.loginUsername.trim(),
            password: this.loginPassword.trim()
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Usuário ou senha incorretos.');
        }

        this.token = data.token;
        localStorage.setItem('admin_token', data.token);
        this.verifyAndSetUser();
      } catch (err) {
        this.loginError = err.message;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.token = null;
      this.isLoggedIn = false;
      this.username = '';
      this.mustChangePassword = false;
      localStorage.removeItem('admin_token');
    },

    async loadChallenges() {
      try {
        const res = await fetch('/api/admin/challenges', { headers: this.getHeaders() });
        if (res.status === 401) {
          this.logout();
          return;
        }
        const data = await res.json();
        if (data.success) {
          this.challenges = data.challenges || [];
        }
      } catch (err) {
        console.error('Erro ao carregar desafios:', err);
      }
    },

    async loadResponses() {
      try {
        const res = await fetch('/api/admin/responses', { headers: this.getHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          this.responses = data.responses || [];
        }
      } catch (err) {
        console.error('Erro ao carregar respostas:', err);
      }
    },

    async loadStudents() {
      try {
        const res = await fetch('/api/admin/students', { headers: this.getHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          this.students = data.students || [];
        }
      } catch (err) {
        console.error('Erro ao carregar alunos:', err);
      }
    },

    resetChallengeForm() {
      this.editingChallengeId = null;
      this.editorMode = 'visual';
      this.chTitle = '';
      this.chCategory = 'Desenvolvimento Web';
      this.chDate = new Date().toISOString().split('T')[0];
      this.chTime = 180;
      this.chDifficulty = 'Iniciante';
      this.chMsg = '';

      this.builderIntroText = 'Uma aplicação web distribui seu funcionamento entre o cliente e o servidor.';
      this.builderCodeSnippet = '<button id="load">Carregar</button>';
      this.builderCodeLang = 'html';
      this.builderQuestionPrompt = 'Qual opção descreve o comportamento correto?';
      this.builderOptions = [
        { id: 'a', label: 'O código é executado no navegador.' },
        { id: 'b', label: 'O código é executado no banco de dados.' },
        { id: 'c', label: 'A página recarrega inteira.' },
        { id: 'd', label: 'Nenhuma das anteriores.' }
      ];
      this.builderCorrectOptionId = 'a';
      this.builderFeedbackText = 'Resposta correta: A.';

      this.syncVisualToJson();
    },

    addBuilderOption() {
      const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const nextLetter = letters[this.builderOptions.length] || `opt_${this.builderOptions.length + 1}`;
      this.builderOptions.push({ id: nextLetter, label: '' });
    },

    removeBuilderOption(index) {
      if (this.builderOptions.length <= 2) {
        alert('O desafio deve conter pelo menos 2 alternativas.');
        return;
      }
      const removed = this.builderOptions.splice(index, 1)[0];
      if (removed && removed.id === this.builderCorrectOptionId && this.builderOptions.length > 0) {
        this.builderCorrectOptionId = this.builderOptions[0].id;
      }
    },

    syncVisualToJson() {
      const chId = this.editingChallengeId || 'ch_' + Date.now();
      
      const introBlocks = [];
      if (this.builderIntroText.trim()) {
        introBlocks.push({ type: 'markdown', content: this.builderIntroText.trim() });
      }

      const promptBlocks = [];
      if (this.builderCodeSnippet.trim()) {
        promptBlocks.push({
          type: 'code',
          language: this.builderCodeLang || 'html',
          content: this.builderCodeSnippet.trim()
        });
      }
      if (this.builderQuestionPrompt.trim()) {
        promptBlocks.push({
          type: 'question',
          content: this.builderQuestionPrompt.trim()
        });
      }

      const validOptions = this.builderOptions
        .filter(o => o.label.trim().length > 0)
        .map(o => ({ id: o.id, label: o.label.trim() }));

      const challengeObj = {
        id: chId,
        label: this.chTitle || 'Desafio',
        challenge: {
          challenge_id: chId,
          version: 1,
          title: this.chTitle || 'Novo Desafio',
          category: this.chCategory || 'Geral',
          date: this.chDate,
          difficulty: this.chDifficulty || 'Médio',
          time_limit_seconds: Number(this.chTime),
          intro: introBlocks,
          prompt: promptBlocks,
          response: {
            type: 'mixed',
            fields: [
              {
                id: 'choice',
                type: 'single_choice',
                label: 'Escolha a resposta correta',
                required: true,
                correct_option_id: this.builderCorrectOptionId,
                options: validOptions
              },
              {
                id: 'explanation',
                type: 'open_text',
                label: 'Como você pensou sobre a resposta?',
                required: false,
                placeholder: 'Explique seu raciocínio...'
              }
            ]
          }
        },
        feedback: {
          messages: this.builderFeedbackText.trim() ? [this.builderFeedbackText.trim()] : ['Resposta gravada com sucesso!']
        }
      };

      this.chJson = JSON.stringify(challengeObj, null, 2);
    },

    syncJsonToVisual() {
      try {
        const parsed = JSON.parse(this.chJson);
        const ch = parsed.challenge || parsed;

        if (ch.title) this.chTitle = ch.title;
        if (ch.category) this.chCategory = ch.category;
        if (ch.difficulty) this.chDifficulty = ch.difficulty;
        if (ch.time_limit_seconds !== undefined) this.chTime = ch.time_limit_seconds;

        const markdownIntro = (ch.intro || []).find(i => i.type === 'markdown');
        if (markdownIntro) this.builderIntroText = markdownIntro.content || '';

        const codePrompt = (ch.prompt || []).find(p => p.type === 'code');
        if (codePrompt) {
          this.builderCodeSnippet = codePrompt.content || '';
          this.builderCodeLang = codePrompt.language || 'html';
        } else {
          this.builderCodeSnippet = '';
        }

        const questionPrompt = (ch.prompt || []).find(p => p.type === 'question');
        if (questionPrompt) this.builderQuestionPrompt = questionPrompt.content || '';

        if (ch.response && ch.response.fields) {
          const choiceField = ch.response.fields.find(f => f.type === 'single_choice');
          if (choiceField) {
            this.builderOptions = (choiceField.options || []).map(o => ({ id: o.id, label: o.label }));
            this.builderCorrectOptionId = choiceField.correct_option_id || (choiceField.options && choiceField.options[0] ? choiceField.options[0].id : 'a');
          }
        }

        if (parsed.feedback && Array.isArray(parsed.feedback.messages)) {
          this.builderFeedbackText = parsed.feedback.messages.join('\n');
        }
      } catch (e) {
        console.error('JSON malformatado para modo visual:', e);
      }
    },

    openNewChallengeModal() {
      this.resetChallengeForm();
      this.challengeModal.open('➕ Cadastrar Novo Desafio');
    },

    editChallenge(ch) {
      this.editingChallengeId = ch.id;
      this.chTitle = ch.title;
      this.chCategory = ch.category || 'Geral';
      this.chDate = ch.date || new Date().toISOString().split('T')[0];
      this.chTime = ch.time_limit_seconds !== undefined ? ch.time_limit_seconds : 180;
      this.chDifficulty = ch.difficulty || 'Médio';
      this.chMsg = '';

      try {
        const parsed = JSON.parse(ch.challenge_json);
        this.chJson = JSON.stringify(parsed, null, 2);
        this.syncJsonToVisual();
      } catch (e) {
        this.chJson = ch.challenge_json;
        this.editorMode = 'json';
      }

      this.challengeModal.open(`✏️ Editar Desafio: ${ch.title}`);
    },

    async saveChallenge() {
      this.chMsg = '';

      if (this.editorMode === 'visual') {
        if (!this.chTitle.trim()) {
          this.chMsg = 'Informe o título do desafio!';
          this.chMsgType = 'error';
          return;
        }
        if (!this.builderQuestionPrompt.trim()) {
          this.chMsg = 'Informe a pergunta do desafio!';
          this.chMsgType = 'error';
          return;
        }
        this.syncVisualToJson();
      }

      let parsed;
      try {
        parsed = JSON.parse(this.chJson);
      } catch (e) {
        this.chMsg = 'O conteúdo do desafio deve ser um JSON válido!';
        this.chMsgType = 'error';
        return;
      }

      this.savingChallenge = true;
      const payload = {
        id: this.editingChallengeId || parsed.id || 'ch_' + Date.now(),
        key: this.editingChallengeId || parsed.id || 'ch_' + Date.now(),
        title: this.chTitle.trim(),
        category: this.chCategory.trim(),
        date: this.chDate,
        time_limit_seconds: Number(this.chTime),
        challenge_json: parsed
      };

      try {
        const res = await fetch('/api/admin/challenges', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao salvar desafio.');
        }

        this.chMsg = this.editingChallengeId ? 'Desafio atualizado com sucesso!' : 'Desafio publicado com sucesso!';
        this.chMsgType = 'success';
        
        setTimeout(() => {
          this.challengeModal.close();
          this.resetChallengeForm();
          this.loadChallenges();
        }, 1200);
      } catch (err) {
        this.chMsg = err.message;
        this.chMsgType = 'error';
      } finally {
        this.savingChallenge = false;
      }
    },

    async deleteChallenge(id) {
      if (!confirm('Deseja realmente remover este desafio?')) return;
      try {
        await fetch(`/api/admin/challenges/${id}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        this.loadChallenges();
      } catch (err) {
        console.error('Erro ao deletar desafio:', err);
      }
    },

    // --- STUDENT MANAGEMENT (CRUD DE ALUNOS) ---
    openNewStudentModal() {
      this.editingStudentId = '';
      this.stDisplayName = '';
      this.stActive = true;
      this.stMsg = '';
      this.studentModal.open('➕ Cadastrar Novo Estudante');
    },

    editStudent(st) {
      this.editingStudentId = st.student_id;
      this.stDisplayName = st.display_name;
      this.stActive = st.active === 1 || st.active === true;
      this.stMsg = '';
      this.studentModal.open(`✏️ Editar Estudante: ${st.display_name}`);
    },

    async saveStudent() {
      if (!this.stDisplayName.trim()) {
        this.stMsg = 'O nome de exibição é obrigatório!';
        this.stMsgType = 'error';
        return;
      }

      this.savingStudent = true;
      this.stMsg = '';

      try {
        const res = await fetch('/api/admin/students', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            student_id: this.editingStudentId || undefined,
            display_name: this.stDisplayName.trim(),
            active: this.stActive
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao salvar estudante.');
        }

        this.stMsg = this.editingStudentId ? 'Estudante atualizado com sucesso!' : 'Estudante cadastrado com sucesso!';
        this.stMsgType = 'success';

        setTimeout(() => {
          this.studentModal.close();
          this.loadStudents();
        }, 1000);
      } catch (err) {
        this.stMsg = err.message;
        this.stMsgType = 'error';
      } finally {
        this.savingStudent = false;
      }
    },

    async deleteStudent(id) {
      if (!confirm(`Deseja realmente remover o estudante ID "${id}"?`)) return;
      try {
        const res = await fetch(`/api/admin/students/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao remover estudante.');
        }
        this.loadStudents();
      } catch (err) {
        alert(err.message);
      }
    },

    viewResponsesForChallenge(chId) {
      this.selectedChallengeFilter = chId;
      this.activeTab = 'responses';
    },

    openResponseDetails(r) {
      const responseData = { ...r };
      
      const targetChallenge = this.challenges.find(ch => String(ch.id) === String(r.challenge_id) || String(ch.key) === String(r.challenge_key));
      
      let challengeObj = null;
      if (targetChallenge) {
        try {
          const parsed = JSON.parse(targetChallenge.challenge_json);
          challengeObj = parsed.challenge || parsed;
        } catch (e) {
          console.error('Erro ao parsear JSON do desafio:', e);
        }
      }

      let parsedUserResponses = {};
      let parsedFeedback = {};
      try {
        parsedUserResponses = JSON.parse(r.response_json || '{}');
        parsedFeedback = JSON.parse(r.feedback_json || '{}');
      } catch (e) {
        console.error('Erro ao parsear resposta:', e);
      }

      const formattedFields = [];
      if (challengeObj && challengeObj.response && Array.isArray(challengeObj.response.fields)) {
        challengeObj.response.fields.forEach(field => {
          const userVal = parsedUserResponses[field.id];
          
          if (field.type === 'single_choice') {
            const selectedOpt = (field.options || []).find(o => String(o.id) === String(userVal));
            const correctOpt = (field.options || []).find(o => String(o.id) === String(field.correct_option_id));
            
            formattedFields.push({
              id: field.id,
              type: 'single_choice',
              label: field.label || 'Opção Escolhida',
              user_val_id: userVal,
              user_val_label: selectedOpt ? `${selectedOpt.id}) ${selectedOpt.label}` : (userVal || 'Nenhuma'),
              is_correct: String(userVal) === String(field.correct_option_id),
              correct_val_label: correctOpt ? `${correctOpt.id}) ${correctOpt.label}` : ''
            });
          } else {
            formattedFields.push({
              id: field.id,
              type: field.type,
              label: field.label || 'Texto / Raciocínio',
              user_val_text: userVal || '(Não preenchido)'
            });
          }
        });
      } else {
        Object.keys(parsedUserResponses).forEach(k => {
          formattedFields.push({
            id: k,
            type: 'open_text',
            label: k,
            user_val_text: String(parsedUserResponses[k])
          });
        });
      }

      responseData.challengeObj = challengeObj;
      responseData.formattedFields = formattedFields;
      responseData.feedbackMessages = parsedFeedback.messages || [];

      this.responseModal.open('🔍 Detalhes da Submissão', responseData);
    },

    async changePassword() {
      this.passMsg = '';
      try {
        const res = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            currentPassword: this.passCurrent,
            newPassword: this.passNew
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao alterar a senha.');
        }

        this.token = data.token;
        localStorage.setItem('admin_token', data.token);
        this.mustChangePassword = false;
        this.passMsg = 'Senha alterada com sucesso!';
        this.passMsgType = 'success';

        setTimeout(() => {
          this.passwordModal.close();
          this.passCurrent = '';
          this.passNew = '';
          this.passMsg = '';
        }, 1500);
      } catch (err) {
        this.passMsg = err.message;
        this.passMsgType = 'error';
      }
    }
  };
}

if (window.Alpine) {
  window.Alpine.data('genericModal', genericModal);
  window.Alpine.data('categorySelector', categorySelector);
  window.Alpine.data('adminApp', adminApp);
} else {
  document.addEventListener('alpine:init', () => {
    window.Alpine.data('genericModal', genericModal);
    window.Alpine.data('categorySelector', categorySelector);
    window.Alpine.data('adminApp', adminApp);
  });
}
window.genericModal = genericModal;
window.categorySelector = categorySelector;
window.adminApp = adminApp;
