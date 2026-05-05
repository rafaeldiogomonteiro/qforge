# Deployment (guia geral)

Este branch foi “limpo” para facilitar deploy sem alterar funcionalidades.

## Checklist rápido

- Backend:
  - Definir `MONGODB_URI` e `JWT_SECRET`
  - Definir `GROQ_API_KEY` **ou** `OPENROUTER_API_KEY` (para geração por IA)
  - Ajustar `ALLOWED_ORIGINS` para o domínio real do frontend
  - (Opcional) `PORT` para cumprir a plataforma/infra

- Frontend:
  - Definir `VITE_API_URL` para apontar para o backend

## Preparar build

### Backend

- Instalar deps: `npm install` (ou `npm ci` se tiveres lockfile compatível)
- Arrancar: `npm start`

### Frontend

- Instalar deps: `npm install` (ou `npm ci`)
- Build: `npm run build`
- Preview local do build: `npm run preview`

Nota: o frontend usa `@sveltejs/adapter-auto`. Dependendo do destino (VM, container, static hosting, etc.), pode ser necessário trocar o adapter.

## Variáveis de ambiente

- Backend: ver `backend/.env.example`
- Frontend: ver `frontend/.env.example`

## CORS / Domínios

Se o frontend estiver num domínio diferente do backend, garante que o domínio do frontend está em `ALLOWED_ORIGINS`.

## Smoke tests recomendados

- `GET /health` deve responder `{ status: "ok" ... }`
- Login:
  - `POST /auth/login`
  - usar token e chamar `GET /auth/me`
- IA:
  - com token válido, `POST /ai/generate-questions` deve responder `success: true` (requer chave de IA configurada)
