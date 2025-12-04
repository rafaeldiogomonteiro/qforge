# Relatório do Projeto QForge – Backend

## Visão Geral

O QForge é um backend em Node.js com Express, usando MongoDB (via Mongoose) para gestão de utilizadores, bancos de questões e integrações relacionadas com geração de questões por IA e Moodle.

O projeto está estruturado em módulos claros (config, controllers, middlewares, models, routes) e expõe uma API documentada com Swagger em `/docs`.

## Tecnologias Principais

- **Node.js** (ES Modules – `"type": "module"`)
- **Express** – framework HTTP
- **MongoDB + Mongoose** – base de dados e ODM
- **JWT (jsonwebtoken)** – autenticação
- **bcryptjs** – hashing de passwords
- **dotenv** – gestão de variáveis de ambiente
- **swagger-ui-express** – interface de documentação da API
- **cors** – controlo de CORS
- **nodemon** – desenvolvimento (hot reload)

## Arquitetura e Estrutura de Pastas

- `src/index.js`
  - Ponto de entrada da aplicação.
  - Carrega variáveis de ambiente a partir de `.env`.
  - Configura Express, CORS e JSON body parser.
  - Conecta ao MongoDB (`connectDB`).
  - Regista rotas principais:
    - `/auth` – autenticação
    - `/banks` – bancos de questões
    - `/dev` – rotas de desenvolvimento/teste
    - `/docs` – Swagger UI
    - `/health` – health check

- `src/config/db.js`
  - Responsável por `mongoose.connect(process.env.MONGODB_URI)`.
  - Lida com sucesso/erro de ligação à MongoDB Atlas.

- `src/config/swagger.js`
  - Define a especificação Swagger/OpenAPI usada pelo Swagger UI.

- `src/controllers`
  - `AuthController.js`
    - Registo e login de utilizadores.
    - Geração e devolução de JWT.
  - `BankController.js`
    - `listBanks` – lista bancos visíveis para o utilizador (owner, sharedWith, coordinators).
    - `createBank` – cria um novo banco de questões com metadados (título, descrição, linguagem, disciplina, ano académico, tags, partilhas, coordenadores).

- `src/middlewares/authMiddleware.js`
  - Lê o token JWT do header `Authorization`.
  - Valida o token e injeta `req.userId` para uso nas rotas protegidas.

- `src/models`
  - `User.js` – utilizadores do sistema (inclui credenciais e campos de perfil, presumivelmente com password hasheada).
  - `QuestionBank.js` – bancos de questões (owner, sharedWith, coordinators, tags, etc.).
  - `Question.js` – modelo das questões individuais.
  - `AiGeneration.js` – registo de gerações feitas por IA (prompt, resposta, etc.).
  - `AiProviderConfig.js` – configuração de fornecedores de IA (por exemplo, chaves de API/modelos).
  - `MoodleIntegration.js` – configurações de integração com Moodle.
  - `ExportJob.js` – jobs de exportação (por exemplo, exportar bancos/questões para outros formatos/sistemas).
  - `AuditLog.js` – registo de auditoria (ações realizadas, por quem e quando).

- `src/routes`
  - `authRoutes.js`
    - Rotas de autenticação (registo, login, talvez refresh de token).
  - `bankRoutes.js`
    - Protegidas por `authMiddleware`.
    - `GET /banks` → lista bancos do utilizador.
    - `POST /banks` → cria um novo banco.
  - `devRoutes.js`
    - Rotas auxiliares para desenvolvimento/testes (ex.: seeds, debug, etc.).

## Fluxos Principais

### 1. Autenticação
- O cliente faz `POST` para rota de login em `/auth`.
- `AuthController` valida credenciais usando `User` + `bcryptjs`.
- Em caso de sucesso, é gerado um **JWT** (com `JWT_SECRET` do `.env`).
- As requisições subsequentes às rotas protegidas devem enviar `Authorization: Bearer <token>`.

### 2. Gestão de Bancos de Questões
- Utilizador autenticado chama `GET /banks`.
  - `authMiddleware` extrai `userId` do JWT.
  - `BankController.listBanks` devolve bancos onde o utilizador é:
    - `owner`, ou
    - está em `sharedWith`, ou
    - está em `coordinators`.
- Para criar um banco, `POST /banks` com `title` obrigatório e outros campos opcionais.

### 3. Integrações (IA, Moodle, Exportações)
- Os modelos `AiGeneration`, `AiProviderConfig`, `MoodleIntegration` e `ExportJob` preparam o backend para:
  - Guardar configurações de IA (modelos, chaves, parâmetros).
  - Registar gerações feitas por IA (para auditoria e reuso).
  - Configurar integrações com Moodle (por exemplo, endpoints, tokens, cursos).
  - Gerir jobs de exportação de dados (ex.: gerar ficheiros para importar no Moodle).

### 4. Observabilidade e Documentação
- **Health check**: `GET /health` devolve JSON simples confirmando que a API está operacional.
- **Swagger UI**: disponível em `GET /docs`, permitindo testar endpoints e ver a documentação da API.

## Configuração de Ambiente

Arquivo `.env` (exemplo existente):

- `PORT=4000` – porta em que a API expõe os endpoints.
- `MONGODB_URI` – connection string para MongoDB Atlas.
- `JWT_SECRET` – chave secreta usada para assinar/verificar tokens JWT.

O `index.js` carrega explicitamente o `.env` a partir da raiz do backend, garantindo que as variáveis são lidas mesmo quando o entrypoint está em `src/`.

## Scripts npm

No `package.json` do backend:

- `start` – `node src/index.js`
  - Usado para arrancar o servidor em modo produção/simples.
- `dev` – `nodemon src/index.js`
  - Usado para desenvolvimento, com reload automático em mudanças de ficheiro.

## Endpoints Principais

- `GET /health` – health check.
- `GET /docs` – UI Swagger (documentação).
- `POST /auth/...` – operações de autenticação (login/registo, etc.).
- `GET /banks` – lista de bancos de questões para o utilizador autenticado.
- `POST /banks` – criação de um novo banco de questões.
- `GET /dev/...` – endpoints variados de desenvolvimento.

## Considerações Finais

O backend do QForge está preparado para:

- Autenticação segura via JWT.
- Gestão de utilizadores e bancos de questões multi-utilizador (com partilhas e coordenação).
- Integração futura ou já existente com serviços de IA e com o Moodle.
- Observabilidade básica (health check) e documentação acessível (Swagger UI).

Este relatório resume o estado atual do backend com base na estrutura de pastas, ficheiros presentes e configuração observada na workspace `backend/`.
