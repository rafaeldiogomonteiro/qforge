# QForge

Monorepo com:
- **backend/**: API (Node.js + Express + MongoDB)
- **frontend/**: app web (SvelteKit + Vite)

## Arranque rápido (local)

### 1) Backend (API)

1. Ir para a pasta do backend:
   - `cd backend`
2. Criar o ficheiro de ambiente:
   - copia `backend/.env.example` para `backend/.env`
   - preenche pelo menos `MONGODB_URI` e `JWT_SECRET`
   - para geração por IA, define `GROQ_API_KEY` **ou** `OPENROUTER_API_KEY`
3. Instalar dependências e arrancar:
   - `npm install`
   - `npm run dev`

Endpoints úteis:
- Health: `GET http://localhost:4000/health`
- Swagger UI: `GET http://localhost:4000/docs`

### 2) Frontend (SvelteKit)

1. Ir para a pasta do frontend:
   - `cd frontend`
2. Configurar URL do backend:
   - copia `frontend/.env.example` para `frontend/.env.local`
   - ajusta `VITE_API_URL` (ex.: `http://localhost:4000`)
3. Instalar dependências e arrancar:
   - `npm install`
   - `npm run dev`

## Variáveis de ambiente

### Backend (backend/.env)

Obrigatórias para o core:
- `MONGODB_URI` — ligação ao MongoDB
- `JWT_SECRET` — assinatura/verificação de tokens

Recomendadas:
- `PORT` — porta do servidor (default: 4000)
- `ALLOWED_ORIGINS` — CORS (lista separada por vírgulas)

IA (opcional, mas necessária para `/ai/generate-questions`):
- `GROQ_API_KEY` **ou** `OPENROUTER_API_KEY`
- (opcional) `OPENROUTER_MODEL`, `OPENROUTER_FAST_MODEL`, `OPENROUTER_FALLBACK_MODELS`, `OPENROUTER_SITE`, `OPENROUTER_TITLE`
- (opcional) `AI_*` para timeouts/retries

### Frontend (frontend/.env.local)

- `VITE_API_URL` — URL base do backend (ex.: `http://localhost:4000`)

## Notas de funcionamento

- As rotas de IA exigem autenticação (token JWT). Fluxo típico:
  1) `POST /auth/register` ou `POST /auth/login`
  2) usar o token em `Authorization: Bearer <token>`
  3) `POST /ai/generate-questions`

- CORS: se o frontend não estiver em `http://localhost:5173`, adiciona a origem em `ALLOWED_ORIGINS`.

## Build

### Backend
- `npm start`

### Frontend
- `npm run build`
- `npm run preview`

Este frontend usa `@sveltejs/adapter-auto`. Para deploy “a sério”, pode ser necessário escolher um adapter específico consoante o servidor/hosting.

## Deploy

Guia geral e checklist em [DEPLOYMENT.md](DEPLOYMENT.md).
