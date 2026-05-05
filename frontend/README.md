# QForge Frontend

Aplicação web do QForge (SvelteKit + Vite).

Para instruções completas (backend + frontend), consulta o README na raiz do repositório.

## Setup (local)

1. Criar env local:
	- copia `frontend/.env.example` para `frontend/.env.local`
	- ajusta `VITE_API_URL` (ex.: `http://localhost:4000`)
2. Instalar deps e arrancar:
	- `npm install`
	- `npm run dev`

## Build

- `npm run build`
- `npm run preview`

Nota: este projeto usa `@sveltejs/adapter-auto`. Dependendo do destino de deploy, pode ser necessário escolher um adapter específico.
