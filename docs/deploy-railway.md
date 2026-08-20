# Guia Didático de Deploy com Docker, GHCR e Railway

Este guia apresenta o processo de publicação da aplicação **Desafio do Dia** utilizando empacotamento full-stack em um **único container Docker**, publicado via **GitHub Container Registry (GHCR)** e implantado no **Railway**.

---

## 🎯 Filosofia e Arquitetura do Deploy

- **Container Único Full-Stack**: O Node.js serve tanto os endpoints da API (`/api/*`) quanto a interface web estática (`/`, `/aluno`, `/admin`).
- **Zero CORS e Uma Única URL**: Não é necessário configurar o GitHub Pages nem conectar dois serviços separados.
- **Porta Dinâmica ($PORT)**: O servidor Express escuta a porta definida pela variável de ambiente `$PORT` (padrão `8080`).
- **Persistência SQLite**: Os dados são mantidos em um banco de dados SQLite salvo no diretório `/app/backend/data`.

---

## 🚀 Caminho Rápido: Deploy no Railway em 4 Passos

Não é necessário clonar o código ou instalar dependências na sua máquina local para fazer o deploy inicial.

### Passo 1: Tornar o Pacote Público no GHCR (Apenas 1 vez no GitHub)

1. Acesse o seu repositório no GitHub.
2. No menu lateral direito, clique no pacote publicado em **Packages** (ou acesse `https://github.com/orgs/elc1090/packages/container/package/project1-2026b-arthurmfroes`).
3. Vá em **Package Settings** (no rodapé direito).
4. Em **Danger Zone** → **Change package visibility**, altere de *Private* para **Public**.

---

### Passo 2: Criar Projeto no Railway a partir da Imagem Docker

1. Acesse [railway.app](https://railway.app) e faça login.
2. Clique em **+ New Project** → selecione **Deploy from Docker Image**.
3. No campo da imagem, cole o endereço público do seu GHCR:
   ```text
   ghcr.io/elc1090/project1-2026b-arthurmfroes:latest
   ```
4. Clique em **Deploy**.

---

### Passo 3: Adicionar Volume Persistente para o Banco de Dados (SQLite)

Para garantir que os alunos e respostas cadastrados não sejam perdidos entre atualizações:

1. No painel do seu serviço no Railway, vá na aba **Volumes**.
2. Clique em **+ Add Volume**.
3. No campo **Mount Path**, defina exatamente:
   ```text
   /app/backend/data
   ```
4. Salve a alteração.

---

### Passo 4: Gerar o Domínio Público

1. Na aba **Settings** do serviço no Railway, navegue até a seção **Networking**.
2. Clique no botão **Generate Domain**.
3. O Railway fornecerá uma URL pública amigável (ex: `https://desafio-do-dia.up.railway.app`).
4. Acesse a aplicação no navegador:
   - Estudante: `https://sua-aplicacao.up.railway.app/`
   - Painel do Aluno: `https://sua-aplicacao.up.railway.app/aluno`
   - Painel do Professor: `https://sua-aplicacao.up.railway.app/admin`

---

## 🛠️ Reprodutibilidade Local com Docker

Para desenvolver, testar ou reproduzir o container na sua própria máquina local:

### 1. Compilar a imagem localmente:
```bash
docker build -t desafio-do-dia .
```

### 2. Executar o container com volume persistente:
```bash
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/backend/data:/app/backend/data \
  --name desafio-app \
  desafio-do-dia
```

### 3. Acessar localmente:
- Aplicação: `http://localhost:8080`
- Painel do Aluno: `http://localhost:8080/aluno`
- Painel do Professor: `http://localhost:8080/admin`

---

## 🔄 Atualizações Automáticas (CI/CD com GitHub Actions)

Sempre que um novo código for enviado para a branch `main`, a Action `.github/workflows/build-image.yml` irá automaticamente:

1. Compilar a nova versão.
2. Atualizar a tag `:latest` e criar uma tag imutável `:sha-<hash>`.
3. O Railway detectará a nova imagem `:latest` e fará o **redeploy automático** sem interromper os dados salvos no volume persistente.
