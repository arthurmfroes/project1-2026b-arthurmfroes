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

function alunoApp() {
  return {
    students: [],
    challenges: [],
    selectedStudent: null,
    confirmedStudentName: localStorage.getItem('confirmed_student_name') || '',
    isStudentConfirmed: false,
    studentQuery: '',
    showSuggestions: false,
    studentStatusHint: '',
    loadingStats: false,

    studentStats: null,
    studentStatsName: '',

    studyModal: genericModal(),
    loaded: false,

    get matchingStudents() {
      if (!this.studentQuery || this.studentQuery.trim().length === 0) return [];
      const q = this.studentQuery.toLowerCase().trim();
      return this.students.filter(s => s.display_name.toLowerCase().includes(q));
    },

    get studentIdentifier() {
      if (this.selectedStudent) return this.selectedStudent.student_id;
      return this.confirmedStudentName.trim();
    },

    get hasSelectedStudent() {
      return this.isStudentConfirmed && (this.selectedStudent !== null || this.confirmedStudentName.trim().length > 0);
    },

    async init() {
      try {
        const [stRes, chRes] = await Promise.all([
          fetch('/api/students'),
          fetch('/api/challenges')
        ]);
        
        const stData = await stRes.json();
        if (stData.success) {
          this.students = stData.students || [];
        }

        const chData = await chRes.json();
        if (chData.success) {
          this.challenges = chData.challenges || [];
        }
      } catch (err) {
        console.error('Erro ao carregar dados do aluno:', err);
      } finally {
        this.loaded = true;
      }

      // Se já houver um nome salvo no localStorage ou na URL ?student=...
      const urlParams = new URLSearchParams(window.location.search);
      const urlStudent = urlParams.get('student');
      const savedName = urlStudent || localStorage.getItem('confirmed_student_name');

      if (savedName) {
        const match = this.students.find(s => 
          s.student_id === savedName || 
          s.display_name.toLowerCase() === savedName.toLowerCase()
        );
        if (match) {
          this.selectStudent(match);
        } else {
          this.confirmedStudentName = savedName;
          this.studentQuery = savedName;
          this.isStudentConfirmed = true;
          this.fetchStats(savedName);
        }
      }
    },

    onStudentInput() {
      this.showSuggestions = true;
      this.selectedStudent = null;
      this.isStudentConfirmed = false;
      this.studentStatusHint = '';
      this.studentStats = null;
    },

    selectStudent(student) {
      this.selectedStudent = student;
      this.confirmedStudentName = student.display_name;
      this.studentQuery = student.display_name;
      this.showSuggestions = false;
      this.isStudentConfirmed = true;
      this.studentStatusHint = `Estudante selecionado: ${student.display_name}`;
      
      localStorage.setItem('confirmed_student_name', student.display_name);
      this.fetchStats(student.student_id || student.display_name);
    },

    confirmManualName() {
      const q = this.studentQuery.trim();
      if (!q) return;

      const exact = this.students.find(s => s.display_name.toLowerCase() === q.toLowerCase());
      if (exact) {
        this.selectStudent(exact);
      } else {
        this.selectedStudent = null;
        this.confirmedStudentName = q;
        this.showSuggestions = false;
        this.isStudentConfirmed = true;
        this.studentStatusHint = `Nome confirmado: ${q}`;
        localStorage.setItem('confirmed_student_name', q);
        this.fetchStats(q);
      }
    },

    clearSelection() {
      this.selectedStudent = null;
      this.confirmedStudentName = '';
      this.studentQuery = '';
      this.isStudentConfirmed = false;
      this.showSuggestions = false;
      this.studentStatusHint = '';
      this.studentStats = null;
      localStorage.removeItem('confirmed_student_name');
    },

    async fetchStats(identifier) {
      if (!identifier) return;
      this.loadingStats = true;

      try {
        const res = await fetch(`/api/students/${encodeURIComponent(identifier)}/stats`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.stats) {
          this.studentStats = data;
          this.studentStatsName = data.student_name || identifier;
        }
      } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
      } finally {
        this.loadingStats = false;
      }
    },

    openStudyModal(item) {
      const itemData = { ...item };

      let challengeObj = null;

      // 1. Tenta extrair do challenge_json vindo do banco
      if (item.challenge_json) {
        try {
          const parsed = typeof item.challenge_json === 'string' ? JSON.parse(item.challenge_json) : item.challenge_json;
          challengeObj = parsed.challenge || parsed;
        } catch (e) {
          console.error('Erro ao parsear JSON do desafio:', e);
        }
      }

      // 2. Fallback: Se não encontrou, busca na lista de desafios carregados
      if (!challengeObj && item.challenge_id) {
        const matched = this.challenges.find(c => String(c.id) === String(item.challenge_id) || String(c.key) === String(item.challenge_id));
        if (matched && matched.challenge_json) {
          try {
            const parsed = typeof matched.challenge_json === 'string' ? JSON.parse(matched.challenge_json) : matched.challenge_json;
            challengeObj = parsed.challenge || parsed;
          } catch (e) {}
        }
      }

      let parsedUserResponses = {};
      let parsedFeedback = {};
      try {
        parsedUserResponses = typeof item.response_json === 'string' ? JSON.parse(item.response_json || '{}') : (item.response_json || {});
        parsedFeedback = typeof item.feedback_json === 'string' ? JSON.parse(item.feedback_json || '{}') : (item.feedback_json || {});
      } catch (e) {
        console.error('Erro ao parsear respostas salvas:', e);
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
              label: field.label || 'Opção Escolhida pelo Estudante',
              user_val_id: userVal,
              user_val_label: selectedOpt ? `${selectedOpt.id.toUpperCase()}) ${selectedOpt.label}` : (userVal ? `Opção ${String(userVal).toUpperCase()}` : 'Nenhuma opção marcada'),
              is_correct: String(userVal) === String(field.correct_option_id),
              correct_val_label: correctOpt ? `${correctOpt.id.toUpperCase()}) ${correctOpt.label}` : ''
            });
          } else {
            formattedFields.push({
              id: field.id,
              type: field.type,
              label: field.label || 'Sua Explicação / Raciocínio Digitado',
              user_val_text: userVal || '(Não preenchido)'
            });
          }
        });
      }

      // Fallback de emergência caso formattedFields continue vazio
      if (formattedFields.length === 0 && Object.keys(parsedUserResponses).length > 0) {
        Object.keys(parsedUserResponses).forEach(k => {
          const val = parsedUserResponses[k];
          formattedFields.push({
            id: k,
            type: k === 'choice' ? 'single_choice' : 'open_text',
            label: k === 'choice' ? 'Opção Escolhida pelo Estudante' : 'Raciocínio Digitado',
            user_val_id: val,
            user_val_label: `Opção ${String(val).toUpperCase()}`,
            user_val_text: String(val),
            is_correct: Boolean(item.is_correct)
          });
        });
      }

      itemData.challengeObj = challengeObj;
      itemData.formattedFields = formattedFields;
      itemData.feedbackMessages = parsedFeedback.messages || [];

      this.studyModal.open(`📖 Revisão de Estudo: ${item.challenge_title}`, itemData);
    }
  };
}

if (window.Alpine) {
  window.Alpine.data('genericModal', genericModal);
  window.Alpine.data('alunoApp', alunoApp);
} else {
  document.addEventListener('alpine:init', () => {
    window.Alpine.data('genericModal', genericModal);
    window.Alpine.data('alunoApp', alunoApp);
  });
}
window.genericModal = genericModal;
window.alunoApp = alunoApp;
