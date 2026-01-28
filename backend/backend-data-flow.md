# QForge Backend — Guia Simples

## O que existe aqui
- Servidor Express com MongoDB (Mongoose), autenticação por JWT, Swagger UI em `/docs`, CORS e JSON já ligados.
- Entrada em `src/index.js`: inicia o servidor, liga à base de dados, carrega rotas `/auth`, `/banks`, `/questions`, `/labels`, `/chapter-tags`, `/ai`, `/dev` e health check.
- Dados guardados em Mongo via modelos Mongoose em `src/models`.
- Segurança: `authMiddleware` lê o header `Authorization: Bearer <token>`; se for válido, guarda `req.userId` e `req.user` para acesso às rotas protegidas.

## Modelo de Permissões
**Sistema simplificado:** Todos os utilizadores autenticados têm permissões completas.
- Não há distinção de roles (admin, docente, coordenador).
- Não há estados de questões ou bancos (draft, approved, archived).
- Controlo de acesso baseado apenas em ownership (dono do banco).

## Como um pedido corre (resumo rápido)
1. O cliente chama uma rota (ex.: `POST /auth/login` ou `GET /banks`).
2. Nas rotas protegidas, o middleware de auth verifica o token JWT.
3. O controlador faz a lógica (valida dados, verifica ownership, lê/escreve Mongo) e responde em JSON.

## Pastas e ficheiros (backend)
- `src/index.js`: arranque, middlewares globais, Swagger, rotas, health check.
- `src/config/db.js`: ligação à Mongo via `MONGODB_URI`.
- `src/config/swagger.js`: descrição OpenAPI das rotas e modelos.
- `src/middlewares/authMiddleware.js`: valida JWT.
- `src/routes`
  - `authRoutes.js`: registar, login, dados do utilizador atual.
  - `bankRoutes.js`: CRUD de bancos, exportar (tudo protegido por auth).
  - `questionRoutes.js`: CRUD de questões.
  - `labelRoutes.js`: CRUD de labels.
  - `chapterTagRoutes.js`: CRUD de chapter tags.
  - `aiRoutes.js`: geração de questões com IA.
  - `devRoutes.js`: `/dev/seed` cria dados de teste.
- `src/controllers`
  - `AuthController.js`: registo, login (bcrypt), `/me`.
  - `QuestionBankController.js`: criar/listar/editar/apagar bancos, exportar em GIFT/AIKEN/Moodle XML.
  - `QuestionController.js`: criar/listar/obter/editar/apagar questões.
  - `LabelController.js`: criar/listar/editar/apagar labels.
  - `ChapterTagController.js`: criar/listar/editar/apagar chapter tags.
  - `AiController.js`: geração de questões, melhoria de questões, geração de distratores.
- `src/models`
  - `User`: nome, email único, password hash.
  - `QuestionBank`: info do banco, dono, partilhas, coordenadores, tags.
  - `Question`: pertence a um banco, tipo, enunciado, opções/respostas, dificuldade, tags, labels, chapterTags, origem, criador.
  - `Label`: nome único para categorizar questões (ex: "Época Normal").
  - `ChapterTag`: nome único para marcar capítulos/temas.
  - `AiProviderConfig`: dados do provider de IA (apenas Groq via env).
  - `AuditLog`: logs de ações (quem fez, sobre que entidade, extra metadata).
  - `ExportJob`: histórico de exportações.
  - `MoodleIntegration`: baseUrl/token para ligação a Moodle.

## O que já funciona
- Autenticação: registo com password cifrada, login com JWT (1 dia), `/auth/me` devolve o utilizador sem a hash.
- Health check: `/health` devolve `{status:"ok"}`.
- Bancos de questões:
  - Criar banco (language default pt-PT).
  - Listar bancos do dono com paginação e filtros.
  - Ver, editar metadados e apagar (só o dono).
  - Exportar banco em `gift|aiken|moodle` com download.
- Questões:
  - Criar numa rota do banco, listar por banco, ver/editar/apagar por ID se fores dono do banco ou criador.
  - Campos: `type`, `stem`, `options` (com `isCorrect`), `acceptableAnswers`, `difficulty`, `tags`, `labels`, `chapterTags`, `source`.
- Labels e Chapter Tags: CRUD completo.
- IA (Groq): Geração de questões, melhoria de questões, geração de distratores.
- Documentação: Swagger UI em `/docs`.
- Dados de teste: `/dev/seed` cria um utilizador, banco e questão de exemplo.

## Notas
- Validação é básica; não há rate limiting.
- Chave API do Groq configurada via variável de ambiente `GROQ_API_KEY`.

## Exemplos rápidos de fluxo
- Login: envia credenciais → `AuthController.login` valida → cria JWT → usar o token nas rotas protegidas.
- Criar banco: `POST /banks` com token → middleware valida → `createBank` grava no Mongo com `owner = user`.
- Adicionar questão: `POST /banks/:bankId/questions` → verifica se és dono do banco → guarda a questão ligada ao banco e ao criador.
- Exportar banco: `GET /banks/:id/export?format=gift` → verifica dono → busca perguntas → gera conteúdo → responde com download.
- Gerar questões com IA: `POST /ai/generate` → gera questões → opcionalmente guarda no banco.
