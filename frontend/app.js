function studentApp() {
  return {
    appConfig: {},
    students: [],
    selectedStudent: null,
    confirmedStudentName: '',
    isStudentConfirmed: false,
    studentQuery: '',
    showSuggestions: false,
    studentStatusHint: '',
    
    // Abas do Aluno
    activeTab: 'challenge', // 'challenge' | 'dashboard'
    
    currentChallenge: null,
    nextChallengeDate: null,

    // Backend-Enforced Timer & Submission State
    challengeStarted: false,
    startingChallenge: false,
    timerSeconds: 0,
    timerInterval: null,
    timerWarning: false,
    timeExpired: false,
    hasSubmitted: false,
    
    // Form values
    formValues: {},
    formMessage: '',
    formMessageType: 'error',
    submitting: false,
    submissionFeedback: null,
    submissionPayload: null,

    // Stats
    studentStats: null,
    studentStatsName: '',

    // Loaded flag
    loaded: false,

    get matchingStudents() {
      if (!this.studentQuery || this.studentQuery.trim().length === 0) return [];
      const q = this.studentQuery.toLowerCase().trim();
      return this.students.filter(s => s.display_name.toLowerCase().includes(q));
    },

    get formattedTimer() {
      if (!this.timerSeconds && this.timerSeconds !== 0) return '--:--';
      const m = Math.floor(this.timerSeconds / 60);
      const s = this.timerSeconds % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    get formattedNextDate() {
      if (!this.nextChallengeDate) return '';
      const [y, m, d] = this.nextChallengeDate.split('-');
      return `${d}/${m}/${y}`;
    },

    get challengeBlocks() {
      if (!this.currentChallenge) return [];
      const ch = this.currentChallenge;
      const blocks = [];

      // 1. Intro (Array ou String)
      if (Array.isArray(ch.intro)) {
        ch.intro.forEach(b => {
          if (typeof b === 'string') blocks.push({ type: 'markdown', content: b });
          else if (b && b.content) blocks.push(b);
        });
      } else if (typeof ch.intro === 'string' && ch.intro.trim()) {
        blocks.push({ type: 'markdown', content: ch.intro.trim() });
      }

      // 2. Description (se string)
      if (typeof ch.description === 'string' && ch.description.trim()) {
        blocks.push({ type: 'markdown', content: ch.description.trim() });
      }

      // 3. Prompt (Array ou String)
      if (Array.isArray(ch.prompt)) {
        ch.prompt.forEach(b => {
          if (typeof b === 'string') blocks.push({ type: 'question', content: b });
          else if (b && b.content) blocks.push(b);
        });
      } else if (typeof ch.prompt === 'string' && ch.prompt.trim()) {
        blocks.push({ type: 'question', content: ch.prompt.trim() });
      }

      // 4. Code Snippet
      if (typeof ch.code === 'string' && ch.code.trim()) {
        blocks.push({ type: 'code', language: ch.language || 'html', content: ch.code.trim() });
      } else if (typeof ch.code_snippet === 'string' && ch.code_snippet.trim()) {
        blocks.push({ type: 'code', language: ch.language || 'html', content: ch.code_snippet.trim() });
      }

      // 5. Question
      if (typeof ch.question === 'string' && ch.question.trim()) {
        if (!blocks.some(b => b.content === ch.question.trim())) {
          blocks.push({ type: 'question', content: ch.question.trim() });
        }
      }

      return blocks;
    },

    get currentResponseModel() {
      if (!this.currentChallenge) return null;
      const ch = this.currentChallenge;
      if (ch.response) return ch.response;

      if (Array.isArray(ch.options) && ch.options.length > 0) {
        return {
          type: 'mixed',
          fields: [
            {
              id: 'choice',
              type: 'single_choice',
              label: ch.question || 'Escolha uma opção',
              correct_option_id: ch.correct_option_id || ch.correct_option || 'a',
              options: ch.options
            }
          ]
        };
      }
      return null;
    },

    get studentIdentifier() {
      if (this.selectedStudent) return this.selectedStudent.student_id;
      return this.confirmedStudentName.trim();
    },

    get hasSelectedStudent() {
      return this.isStudentConfirmed && (this.selectedStudent !== null || this.confirmedStudentName.trim().length > 0);
    },

    get challengeHasTimer() {
      if (!this.currentChallenge) return false;
      const limit = Number(this.currentChallenge.time_limit_seconds);
      return !isNaN(limit) && limit > 0;
    },

    async init() {
      try {
        const res = await fetch('/api/bootstrap');
        const data = await res.json();
        if (data.success) {
          this.appConfig = data.app || {};
          this.students = data.students || [];
          this.currentChallenge = data.current_challenge;
          this.nextChallengeDate = data.next_challenge_date;
        }
      } catch (err) {
        console.error('Erro na inicialização:', err);
      } finally {
        this.loaded = true;
      }
    },

    onStudentInput() {
      this.showSuggestions = true;
      this.selectedStudent = null;
      this.isStudentConfirmed = false;
      this.studentStatusHint = '';
      this.studentStats = null;
      this.challengeStarted = false;
      this.hasSubmitted = false;
      this.submissionFeedback = null;
      this.formMessage = '';
    },

    selectStudent(student) {
      this.selectedStudent = student;
      this.confirmedStudentName = student.display_name;
      this.studentQuery = student.display_name;
      this.showSuggestions = false;
      this.isStudentConfirmed = true;
      this.studentStatusHint = `Estudante selecionado: ${student.display_name}`;
      this.onStudentSelected();
    },

    confirmManualName() {
      const q = this.studentQuery.trim();
      if (!q) return;

      const exact = this.students.find(s => s.display_name.toLowerCase() === q.toLowerCase());
      if (exact) {
        this.selectStudent(exact);
      } else if (this.appConfig.allow_manual_name) {
        this.selectedStudent = null;
        this.confirmedStudentName = q;
        this.showSuggestions = false;
        this.isStudentConfirmed = true;
        this.studentStatusHint = `Nome manual confirmado: ${q}`;
        this.onStudentSelected();
      } else {
        alert('Por favor, selecione um aluno válido da lista.');
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
      this.challengeStarted = false;
      this.hasSubmitted = false;
      this.submissionFeedback = null;
      this.formMessage = '';
    },

    async onStudentSelected() {
      const identifier = this.studentIdentifier || this.confirmedStudentName;
      if (!identifier) return;

      this.challengeStarted = false;
      this.hasSubmitted = false;
      this.timeExpired = false;
      this.submissionFeedback = null;
      this.formMessage = '';
      this.formValues = {};
      if (this.timerInterval) clearInterval(this.timerInterval);

      // Carrega estatísticas do estudante
      this.fetchStats(identifier);

      // Verifica status de submissão e cronômetro no servidor
      this.checkChallengeServerStatus(identifier);
    },

    async fetchStats(identifier) {
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
      }
    },

    async checkChallengeServerStatus(identifier) {
      if (!this.currentChallenge) return;
      const chId = this.currentChallenge.challenge_id || this.currentChallenge.id;

      try {
        const res = await fetch(`/api/challenges/status?student_identifier=${encodeURIComponent(identifier)}&challenge_id=${encodeURIComponent(chId)}`);
        const data = await res.json();

        // 1. SE O ALUNO JÁ SUBMETEU UMA RESPOSTA
        if (data.success && data.already_submitted) {
          this.challengeStarted = true;
          this.hasSubmitted = true;
          this.submissionFeedback = data.submission;
          this.formMessage = '';
          if (data.submission && data.submission.user_responses) {
            this.formValues = data.submission.user_responses;
          }
          return;
        }

        // 2. SE O DESAFIO NÃO TEM TIMER
        if (!this.challengeHasTimer) {
          this.challengeStarted = true;
          this.timeExpired = false;
          return;
        }

        // 3. SE O DESAFIO TEM TIMER E JÁ FOI INICIADO NO BANCO
        if (data.success && data.started) {
          this.challengeStarted = true;
          if (data.has_timer) {
            this.startCountdown(data.remaining_seconds, data.is_expired);
          }
        } else {
          this.challengeStarted = false;
        }
      } catch (err) {
        console.error('Erro ao checar status no servidor:', err);
      }
    },

    async startChallengeOnServer() {
      const identifier = this.studentIdentifier || this.confirmedStudentName;
      if (!identifier) {
        alert('Por favor, selecione ou confirme seu nome primeiro.');
        return;
      }

      if (!this.currentChallenge) return;

      if (!this.challengeHasTimer) {
        this.challengeStarted = true;
        this.timeExpired = false;
        return;
      }

      const chId = this.currentChallenge.challenge_id || this.currentChallenge.id;
      this.startingChallenge = true;

      try {
        const res = await fetch('/api/challenges/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_identifier: identifier,
            challenge_id: chId
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao iniciar cronômetro no servidor.');
        }

        this.challengeStarted = true;
        if (data.has_timer) {
          this.startCountdown(data.remaining_seconds, data.is_expired);
        } else {
          this.timeExpired = false;
        }
      } catch (err) {
        alert(err.message);
      } finally {
        this.startingChallenge = false;
      }
    },

    startCountdown(remainingSeconds, isExpired) {
      this.timerSeconds = remainingSeconds;
      this.timeExpired = isExpired;
      this.timerWarning = remainingSeconds <= 30;

      if (this.timerInterval) clearInterval(this.timerInterval);

      if (isExpired) {
        this.formMessage = '⏱️ Tempo esgotado! O tempo limite para enviar a resposta expirou no servidor.';
        this.formMessageType = 'error';
        return;
      }

      this.timerInterval = setInterval(() => {
        this.timerSeconds--;
        if (this.timerSeconds <= 30) {
          this.timerWarning = true;
        }
        if (this.timerSeconds <= 0) {
          clearInterval(this.timerInterval);
          this.timeExpired = true;
          this.formMessage = '⏱️ Tempo esgotado! O envio de respostas foi bloqueado pelo servidor.';
          this.formMessageType = 'error';
        }
      }, 1000);
    },

    async submitResponse() {
      if (this.hasSubmitted) {
        this.formMessage = 'Você já enviou sua resposta para este desafio! Não é possível alterar.';
        this.formMessageType = 'error';
        return;
      }

      if (this.challengeHasTimer && this.timeExpired) {
        this.formMessage = '⏱️ Tempo esgotado no servidor! Não é possível enviar.';
        this.formMessageType = 'error';
        return;
      }

      const name = this.confirmedStudentName || this.studentQuery.trim();
      if (!name || !this.isStudentConfirmed) {
        this.formMessage = 'Escolha ou confirme seu nome primeiro.';
        this.formMessageType = 'error';
        return;
      }

      this.formMessage = '';
      this.submitting = true;

      const chId = this.currentChallenge.challenge_id || this.currentChallenge.id;

      const payload = {
        challenge_id: chId,
        challenge_version: this.currentChallenge.version || 1,
        challenge_key: chId,
        student_id: this.selectedStudent?.student_id || '',
        student_display_name: this.selectedStudent?.display_name || name,
        student_source: this.selectedStudent ? 'listed' : 'manual',
        response_json: this.formValues,
        frontend_version: '1.2.0'
      };

      try {
        const res = await fetch('/api/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          if (data.already_submitted) {
            this.hasSubmitted = true;
            this.submissionFeedback = data;
            // Exibe a mensagem de rejeição por retry / resposta já existente
            this.formMessage = data.error || 'Você já enviou uma resposta para este desafio! Não é permitido alterar a resposta enviada.';
            this.formMessageType = 'error';
            return;
          }
          throw new Error(data.error || 'Erro ao enviar a resposta.');
        }

        if (this.timerInterval) clearInterval(this.timerInterval);

        this.hasSubmitted = true;
        this.submissionFeedback = data;
        this.submissionPayload = payload;
        this.formMessage = ''; // Limpa qualquer aviso interno no form para não poluir o card de feedback
        this.formMessageType = 'success';

        // Refresh stats
        this.fetchStats(this.studentIdentifier || name);
      } catch (err) {
        this.formMessage = err.message || 'Erro ao comunicar com o servidor.';
        this.formMessageType = 'error';
      } finally {
        this.submitting = false;
      }
    }
  };
}

if (window.Alpine) {
  window.Alpine.data('studentApp', studentApp);
} else {
  document.addEventListener('alpine:init', () => {
    window.Alpine.data('studentApp', studentApp);
  });
}
window.studentApp = studentApp;
