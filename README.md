# Desafio do Dia - Plataforma Interativa de Aprendizado

Aplicação web moderna, responsiva e de alta performance desenvolvida com estética Neo-Brutalista para a publicação de desafios curtos de programação, cronômetro anti-burlar no servidor e painéis dedicados para estudantes e professores.

---

## 🛠️ Tecnologias Utilizadas

- **Back-end**: Node.js, Express, Better-SQLite3.
- **Front-end**: HTML5, Alpine.js v3, Tailwind CSS (Neo-Brutalist Design System).
- **Banco de Dados**: SQLite3 (com suporte a fusos horários UTC rigorosos).

---

## 🚀 Estrutura de Rotas e Páginas

- **`/` (Desafio do Dia)**: Página principal do estudante para realizar o desafio ativo do dia.
  - Seleção e confirmação de nome do aluno.
  - Card com efeito Backdrop Blur antes de iniciar o desafio.
  - Cronômetro sincronizado via servidor anti-F5 / troca de aba.
  - Trava rígida de submissão única por estudante por desafio.

- **`/aluno` (Painel do Estudante & Revisão de Estudos)**:
  - Resumo de desempenho (Respondidos, Acertos, Erros, Precisão %).
  - Histórico completo de desafios respondidos.
  - **Modal de Estudo Completo**: Renderiza o enunciado original, trecho de código, resposta marcada pelo aluno vs gabarito correto, raciocínio digitado e feedback explicativo do professor.

- **`/admin` (Painel Administrativo do Professor)**:
  - **Visual Form Builder**: Editor visual interativo para criação e edição de desafios com blocos dinâmicos de texto, código, alternativas e gabarito.
  - **Seletor de Categoria/Assunto Enum**: Dropdown Neo-Brutalist reutilizável com sugestões pré-existentes e suporte a novas categorias.
  - **CRUD Completo de Alunos**: Cadastro, edição de nome, alteração de status (Ativo/Inativo) e exclusão.
  - **Inspeção de Submissões**: Visualização detalhada de respostas enviadas por cada aluno.

---

## 📦 Como Executar Localmente

1. **Instalar Dependências**:
   ```bash
   npm install
   ```

2. **Iniciar o Servidor**:
   ```bash
   npm start
   # ou: node backend/src/server.js
   ```

3. **Acessar no Navegador**:
   - Estudante: `http://localhost:8080`
   - Painel de Desempenho do Aluno: `http://localhost:8080/aluno`
   - Painel do Professor: `http://localhost:8080/admin`

---

## 📋 Atendimento às Demandas da Disciplina

1. **Cronômetro com Tempo Limite por Desafio**: Implementado no backend (UTC) com bloqueio automático ao expirar.
2. **Desafios por Data e Categoria**: Suporte a datas específicas, badges de categoria e filtro.
3. **Interface para Dias Sem Desafio**: Apresenta aviso amigável e data do próximo desafio disponível.
4. **Área de Desempenho e Revisão**: Página `/aluno` dedicada com estatísticas e revisão completa de respostas.
