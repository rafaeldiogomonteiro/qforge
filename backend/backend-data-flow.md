# QForge Backend — Guia Simples

## O que existe aqui
- Servidor Express com MongoDB (Mongoose), autenticação por JWT, Swagger UI em `/docs`, CORS e JSON já ligados.
- Entrada em `src/index.js`: inicia o servidor, liga à base de dados, carrega rotas `/auth`, `/banks`, `/dev` e health check.
- Dados guardados em Mongo via modelos Mongoose em `src/models`.
- Segurança: `authMiddleware` lê o header `Authorization: Bearer <token>`; se for válido, guarda `req.userId` e `req.user` para controlo de permissões.

## Como um pedido corre (resumo rápido)
1. O cliente chama uma rota (ex.: `POST /auth/login` ou `GET /banks`).
2. Nas rotas protegidas, o middleware de auth verifica o token.
3. O controlador faz a lógica (valida dados, verifica dono/role, lê/escreve Mongo) e responde em JSON.
4. Para bancos, o estado pode mudar e a versão pode subir; para exportar, gera-se um ficheiro em memória e faz download.

## Pastas e ficheiros (backend)
- `src/index.js`: arranque, middlewares globais, Swagger, rotas, health check.
- `src/config/db.js`: ligação à Mongo via `MONGODB_URI`.
- `src/config/swagger.js`: descrição OpenAPI das rotas e modelos.
- `src/middlewares/authMiddleware.js`: valida JWT e roles.
- `src/routes`
  - `authRoutes.js`: registar, login, dados do utilizador atual.
  - `bankRoutes.js`: CRUD de bancos, mudar estado, exportar (tudo protegido por auth).
  - `questionRoutes.js`: CRUD de questões (ainda não ligado no `index.js`).
  - `devRoutes.js`: `/dev/seed` cria dados de teste.
- `src/controllers`
  - `AuthController.js`: registo, login (bcrypt), `/me`.
  - `QuestionBankController.js`: criar/listar/editar/apagar bancos, mudar estado com regras por role, exportar em GIFT/AIKEN/Moodle XML.
  - `QuestionController.js`: criar/listar/obter/editar/apagar questões com checks de dono ou criador.
- `src/models`
  - `User`: nome, email único, password hash, role (`DOCENTE|COORDENADOR|ADMIN`).
  - `QuestionBank`: info do banco, dono, partilhas, coordenadores, tags, estado (`DRAFT|IN_REVIEW|OFFICIAL|ARCHIVED`), versão.
  - `Question`: pertence a um banco, tipo, enunciado, opções/respostas, dificuldade, tags, origem, estado, criador.
  - `AiGeneration`: registos de perguntas geradas por IA para um banco e provider.
  - `AiProviderConfig`: dados do provider de IA (nome, modelo, apiKey, limites).
  - `AuditLog`: logs de ações (quem fez, sobre que entidade, extra metadata).
  - `ExportJob`: histórico de exportações (formato, filtros, sucesso/erro, filePath opcional).
  - `MoodleIntegration`: baseUrl/token para ligação a Moodle.

## O que já funciona
- Autenticação: registo com password cifrada, login com JWT (1 dia), `/auth/me` devolve o utilizador sem a hash.
- Health check: `/health` devolve `{status:"ok"}`.
- Bancos de questões:
  - Criar banco (language default pt-PT, estado DRAFT).
  - Listar bancos do dono com paginação, filtros por estado/ano/tags e texto de pesquisa.
  - Ver, editar metadados e apagar (só o dono).
  - Mudar estado com regras: DRAFT → IN_REVIEW/ARCHIVED; IN_REVIEW → DRAFT/OFFICIAL/ARCHIVED; OFFICIAL → ARCHIVED; ARCHIVED não volta atrás. OFFICIAL/ARCHIVED só por COORDENADOR ou ADMIN; OFFICIAL aumenta `version`.
  - Exportar banco em `gift|aiken|moodle` e forçar download.
- Questões:
  - Criar numa rota do banco, listar por banco, ver/editar/apagar por ID se fores dono do banco ou criador.
  - Campos: `type`, `stem`, `options` (com `isCorrect`), `acceptableAnswers`, `difficulty`, `tags`, `source`, `status`.
- Documentação: Swagger UI em `/docs`.
- Dados de teste: `/dev/seed` cria um utilizador, banco e questão de exemplo.

## Notas e pontos em aberto
- `questionRoutes.js` ainda não está ligado em `src/index.js`; precisa de um `app.use` para ficar acessível.
- Modelos de IA, auditoria, export jobs e integrações Moodle ainda não têm rotas ativas (só o modelo pronto).
- Validação é básica; não há rate limiting.
- Exportação só permite o dono e não filtra por tags/status no pedido atual.

## Exemplos rápidos de fluxo
- Login: envia credenciais → `AuthController.login` valida → cria JWT → usar o token nas rotas protegidas.
- Criar banco: `POST /banks` com token → middleware valida → `createBank` grava no Mongo com `owner = user`.
- Adicionar questão: `POST /banks/:bankId/questions` → verifica se és dono do banco → guarda a questão ligada ao banco e ao criador.
- Exportar banco: `GET /banks/:id/export?format=gift` → verifica dono → busca perguntas → gera conteúdo → responde com download.
