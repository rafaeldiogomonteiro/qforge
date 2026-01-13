# Relatório Incremental do Backend QForge – Melhorias Recentes

Este documento descreve **apenas as funcionalidades e alterações introduzidas após** o último relatório completo do backend do QForge. Foca-se em exportação de bancos, controlo de permissões por role, paginação/filtros/pesquisa, melhorias no Swagger e preparação para testes automatizados, incluindo **excertos de código**, **explicações em texto corrido** e **instruções para recolha de evidências (prints)**.

Em termos práticos, estas melhorias tornam o backend mais seguro (através de regras de acesso mais claras), mais utilizável (melhor pesquisa e organização de bancos) e mais integrável com o Moodle (via exportações em múltiplos formatos).

---

## 1. Middleware de Autenticação e Roles

### 1.1. `authMiddleware` atualizado

O `authMiddleware` é o ponto de entrada para qualquer rota protegida. A principal mudança foi deixar de apenas extrair o `userId` do token e passar a **carregar todo o utilizador a partir da base de dados**, colocando-o em `req.user`. Isto permite que as rotas e outros middlewares tenham acesso imediato ao role e a outros atributos do utilizador.

Na prática, sempre que um pedido chega a uma rota protegida, o fluxo é:

1. Ler o header `Authorization` e verificar se segue o formato `Bearer <token>`.
2. Validar o token JWT com a chave configurada em `JWT_SECRET`.
3. Usar a informação contida no token (por exemplo o `id` do utilizador) para ir buscar o registo correspondente na base de dados (`User.findById`).
4. Guardar `req.userId` e `req.user` para uso posterior.
5. Em caso de problema (token em falta, inválido ou utilizador não encontrado), devolver `401 Unauthorized` com uma mensagem adequada.

Isto garante que qualquer decisão de autorização futura (como verificar o role) é feita com base em dados reais da base de dados, e não apenas em claims do token.

Funções principais (exemplo simplificado):

```js
// src/middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2) {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;

    // Carrega o utilizador para permitir verificação de role em middlewares seguintes
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return res.status(401).json({ error: "Utilizador não encontrado" });
    }
    req.user = user;

    return next();
  } catch (err) {
    console.error("Erro ao verificar token:", err);
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

// Middleware para verificar se o utilizador tem um dos roles exigidos
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.userId || !req.user) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: "Sem permissão para esta operação" });
      }

      next();
    } catch (err) {
      console.error("Erro em requireRole:", err);
      return res.status(500).json({ error: "Erro no servidor" });
    }
  };
}
```

### 1.2. Novo middleware `requireRole`

Para além de saber **quem** é o utilizador, passou a ser necessário controlar **o que** cada perfil pode ou não fazer. Para isso, foi criado o middleware `requireRole`, que recebe uma lista de roles permitidos e impede o acesso a qualquer utilizador que não se enquadre nessa lista.

Em termos conceptuais, o `requireRole` implementa **autorização baseada em roles** (RBAC – Role-Based Access Control). Isto é crucial em cenários educativos, onde um DOCENTE, um COORDENADOR e um ADMIN têm responsabilidades e poderes diferentes:

- DOCENTE: tipicamente cria e gere os próprios bancos de questões.
- COORDENADOR: pode ter acesso mais alargado a bancos partilhados ou coordenados.
- ADMIN: pode ter acesso global, incluindo operações de administração/suporte.

Exemplo de implementação:

```js
// src/middlewares/authMiddleware.js
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.userId || !req.user) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: "Sem permissão para esta operação" });
      }

      next();
    } catch (err) {
      console.error("Erro em requireRole:", err);
      return res.status(500).json({ error: "Erro no servidor" });
    }
  };
}
```

Utilização típica na rota de bancos:

```js
// src/routes/bankRoutes.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  createBank,
  listMyBanks,
  getBankById,
  updateBank,
  deleteBank,
  updateBankStatus,
  exportBank,
} from "../controllers/QuestionBankController.js";

const router = express.Router();

// todas as rotas de bancos exigem utilizador autenticado
router.use(authMiddleware);

router.get("/", listMyBanks);
router.post("/", createBank);
router.get("/:id", getBankById);
router.put("/:id", updateBank);
router.patch("/:id/status", updateBankStatus);
router.delete("/:id", deleteBank);

// Exportação: /banks/:id/export?format=gift|aiken|moodle
router.get("/:id/export", exportBank);

export default router;
```

No `index.js` da aplicação, este router é normalmente montado em `/banks`, pelo que as rotas efetivas ficam, por exemplo, `GET /banks`, `GET /banks/:id` e `GET /banks/:id/export?format=gift|aiken|moodle`.

O resultado é que rotas críticas, como listagem de bancos, exportações ou alterações de estado, passam a estar explicitamente protegidas por regras de role, tornando o comportamento mais previsível e audível.

---

## 2. Controlador de Bancos de Questões – `QuestionBankController`

O `QuestionBankController` foi introduzido/expandido para concentrar a lógica de **gestão de bancos de questões** num único local, substituindo gradualmente o controlador anterior. Esta abordagem facilita a manutenção, porque todas as regras de negócio dos bancos (filtros, visibilidade, exportações, etc.) passam a estar num módulo coeso.

### 2.1. `listMyBanks` com paginação, filtros e pesquisa

O endpoint `GET /banks` deixou de devolver uma lista simples e passou a suportar **paginação**, **filtros** e **pesquisa textual**, tornando-se mais escalável e usável.

Agora, um docente com dezenas ou centenas de bancos pode:

- Limitar o número de resultados por página (`limit`).
- Navegar entre páginas (`page`).
- Filtrar por estado (ex.: rascunho vs publicado) usando `status`.
- Filtrar por contexto académico (`academicYear`).
- Filtrar por tags temáticas (`tags`), o que permite agrupar bancos por disciplina, exame, tema, etc.
- Procurar por palavras-chave no título ou descrição (`search`), facilitando encontrar rapidamente um banco específico.

Exemplo de lógica simplificada:

```js
// src/controllers/QuestionBankController.js
export async function listMyBanks(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      tags,
      academicYear,
      search,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

    const filter = { owner: req.userId };

    if (status) {
      filter.status = status;
    }

    if (academicYear) {
      filter.academicYear = academicYear;
    }

    if (tags) {
      const tagList = Array.isArray(tags)
        ? tags
        : String(tags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
      if (tagList.length > 0) {
        filter.tags = { $in: tagList };
      }
    }

    if (search) {
      const regex = new RegExp(String(search), "i");
      filter.$or = [{ title: regex }, { discipline: regex }];
    }

    const total = await QuestionBank.countDocuments(filter);

    const banks = await QuestionBank.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: banks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("Erro em listMyBanks:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
```

Este desenho aproxima o backend de um comportamento "pronto para produção", onde a API é capaz de suportar crescimento no número de bancos sem degradar a experiência de utilização.

### 2.2. Regras de acesso a bancos específicos

Além da listagem, a API define regras claras sobre **quem pode ver, editar, apagar ou alterar o estado de um banco em particular**. No estado atual do código, estas regras estão implementadas diretamente nas funções de controlador, sem um helper genérico `userCanAccessBank`.

Para operações de leitura simples (`GET /banks/:id`), o acesso está restrito ao **owner** do banco:

```js
// src/controllers/QuestionBankController.js
export async function getBankById(req, res) {
  try {
    const { id } = req.params;
    const bank = await QuestionBank.findById(id);

    if (!bank) {
      return res.status(404).json({ error: "Banco não encontrado" });
    }

    if (String(bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para ver este banco" });
    }

    res.json(bank);
  } catch (err) {
    console.error("Erro em getBankById:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
```

De forma semelhante, as operações de edição (`updateBank`), eliminação (`deleteBank`) e alteração de estado (`updateBankStatus`) verificam explicitamente se o `owner` do banco coincide com o `req.userId` e, no caso de alteração de estado, combinam essa verificação com o role do utilizador (via `User.findById` e as funções `canSetOfficialOrArchived`/`isValidStatusTransition`).

Isto garante que apenas o dono do banco (e, em certas transições de estado, perfis com mais privilégios) conseguem alterar dados sensíveis, evitando que utilizadores aleatórios modifiquem ou consultem bancos alheios, mesmo que conheçam o ID.

---

## 3. Exportação de Bancos de Questões

A funcionalidade de exportação responde a uma necessidade concreta: **reutilizar bancos de questões criados no QForge noutros sistemas**, em particular no Moodle. Em vez de obrigar o utilizador a recriar manualmente perguntas noutras plataformas, o backend gera ficheiros num formato que essas plataformas já sabem importar.

### 3.1. Novo endpoint de exportação

O endpoint `GET /banks/:id/export` aceita um parâmetro `format` que define o tipo de ficheiro a gerar. A mesma rota dá resposta a três formatos diferentes, o que simplifica a experiência do utilizador (um único endpoint para todas as exportações).

Definição de rota (rota relativa, montada em `/banks` no `index.js`):

```js
// src/routes/bankRoutes.js
router.get("/:id/export", exportBank);
```

Trecho essencial do controlador:

```js
// src/controllers/QuestionBankController.js
function questionsToGift(questions) {
  return questions
    .map((q) => {
      const title = q.title || "Pergunta";
      const text = q.text || "";
      const options = q.options || [];
      const correctIndex =
        q.correctIndex ?? options.findIndex((o) => o.isCorrect);

      const header = `::${title}:: ${text}`;
      const body = options
        .map((opt, idx) => {
          const prefix = idx === correctIndex ? "=" : "~";
          return `${prefix}${opt.text ?? opt}`;
        })
        .join(" ");

      return `${header} {${body}}`;
    })
    .join("\n\n");
}

function questionsToAiken(questions) {
  return questions
    .map((q) => {
      const title = q.title || q.text || "Pergunta";
      const options = q.options || [];
      const correctIndex =
        q.correctIndex ?? options.findIndex((o) => o.isCorrect);

      const letters = ["A", "B", "C", "D", "E", "F"];
      const lines = [];

      lines.push(title);
      options.forEach((opt, idx) => {
        const letter = letters[idx] || String.fromCharCode(65 + idx);
        lines.push(`${letter}. ${opt.text ?? opt}`);
      });

      const correctLetter = letters[correctIndex] || letters[0];
      lines.push(`ANSWER: ${correctLetter}`);

      return lines.join("\n");
    })
    .join("\n\n");
}

function questionsToMoodleXml(questions, bankName = "Banco") {
  const escapeXml = (str = "") =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const xmlQuestions = questions
    .map((q) => {
      const name = escapeXml(q.title || "Pergunta");
      const text = escapeXml(q.text || "");
      const options = q.options || [];
      const correctIndex =
        q.correctIndex ?? options.findIndex((o) => o.isCorrect);

      const answersXml = options
        .map((opt, idx) => {
          const fraction = idx === correctIndex ? 100 : 0;
          const answerText = escapeXml(opt.text ?? opt);
          return `    <answer fraction="${fraction}"><text>${answerText}</text></answer>`;
        })
        .join("\n");

      return `  <question type="multichoice">
    <name><text>${name}</text></name>
    <questiontext format="html"><text>${text}</text></questiontext>
${answersXml}
  </question>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${xmlQuestions}
</quiz>`;
}

// GET /banks/:id/export?format=gift|aiken|moodle
export async function exportBank(req, res) {
  try {
    const { id } = req.params;
    const format = (req.query.format || "").toLowerCase();

    const supported = ["gift", "aiken", "moodle"];
    if (!supported.includes(format)) {
      return res
        .status(400)
        .json({ error: "Formato inválido. Use gift, aiken ou moodle" });
    }

    const bank = await QuestionBank.findById(id);
    if (!bank) {
      return res.status(404).json({ error: "Banco não encontrado" });
    }

    if (String(bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para exportar este banco" });
    }

    const questions = await Question.find({ bank: bank._id }).lean();

    let content = "";
    let filename = `${bank.title || "banco"}`.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (format === "gift") {
      content = questionsToGift(questions);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.gift"`
      );
      return res.send(content);
    }

    if (format === "aiken") {
      content = questionsToAiken(questions);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.txt"`
      );
      return res.send(content);
    }

    if (format === "moodle") {
      content = questionsToMoodleXml(questions, bank.title);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.xml"`
      );
      return res.send(content);
    }

    return res.status(500).json({ error: "Erro ao gerar exportação" });
  } catch (err) {
    console.error("Erro em exportBank:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
```

### 3.2. Formatos suportados (resumo)

- **GIFT** – formato textual nativo do Moodle, que permite representar várias tipologias de pergunta. Atualmente está focado em escolha múltipla e verdadeiro/falso, o que já cobre muitos exames/testes típicos.
- **AIKEN** – formato de texto muito simples e legível, útil tanto para importação noutras plataformas como para revisão humana.
- **Moodle XML** – formato estruturado que segue o esquema de importação do Moodle. Este é o formato mais "rico" e flexível, permitindo no futuro suportar mais tipos de pergunta e metadados.

Por trás desta funcionalidade existem helpers (`bankToGift`, `bankToAiken`, `bankToMoodleXml`) que encapsulam a lógica de converter objetos `Question` para as estruturas de texto/XML exigidas por cada formato.

### 3.3. Limitações e extensões futuras

Neste momento, a exportação está otimizada para perguntas de **escolha múltipla** e **verdadeiro/falso**, que são as mais comuns. Está planeada a extensão para suportar:

- Perguntas de resposta curta (`SHORT_ANSWER`).
- Perguntas de resposta aberta (`OPEN`), possivelmente com feedback e critérios adicionais.

A arquitetura dos helpers foi desenhada de forma modular, precisamente para permitir essa expansão sem reescrever a lógica existente.

---

## 4. Atualizações na Documentação Swagger

A documentação Swagger foi enriquecida para servir não só como referência técnica, mas também como **ferramenta de teste e de recolha de evidências**. As alterações tornam o Swagger uma interface quase completa para explorar e validar o backend.

### 4.1. Autenticação via JWT no Swagger

Foi configurado um esquema de segurança `bearerAuth` no Swagger. Com isso, o utilizador pode autenticar-se uma vez, através do botão **Authorize**, e todas as chamadas subsequentes passam a incluir automaticamente o header `Authorization: Bearer <token>`.

Isto reduz muito o atrito durante testes, porque deixa de ser necessário copiar e colar o token manualmente em cada endpoint.

Exemplo da configuração de segurança (extraído de `src/config/swagger.js`):

```js
// src/config/swagger.js
export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "QForge API",
    version: "1.0.0",
    description: "API para gestão de bancos de questões (QForge)",
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Servidor local de desenvolvimento",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    // ... schemas omitidos para brevidade
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  // ... paths
};
```

### 4.2. Documentação dos novos comportamentos de `/banks`

Os endpoints relacionados com bancos (`/banks` e `/banks/{id}/export`) foram documentados com mais detalhe, incluindo todos os parâmetros de query relevantes e o formato esperado.

Na prática, qualquer utilizador consegue, a partir do Swagger:

- Ver quais filtros e parâmetros de paginação existem para `GET /banks`.
- Experimentar combinações de filtros (status, tags, ano académico, pesquisa) sem escrever uma única linha de código.
- Ver os formatos de exportação disponíveis e os tipos de resposta possíveis.

Os exemplos abaixo são um **resumo adaptado** do que está definido em `src/config/swagger.js` dentro da propriedade `paths`.

Exemplo (resumido) da documentação de `GET /banks` com query params (baseado em `src/config/swagger.js`):

```js
// excerto adaptado de src/config/swagger.js
paths: {
  "/banks": {
    get: {
      summary: "Listar bancos de questões do utilizador autenticado",
      tags: ["Bancos de Questões"],
      security: [{ bearerAuth: [] }],
      // ... aqui, no ficheiro real, estão definidas também as respostas e schemas
    },
  },
  "/banks/{id}/export": {
    get: {
      summary: "Exportar banco de questões",
      tags: ["Bancos de Questões"],
      security: [{ bearerAuth: [] }],
      // ... definição detalhada de parâmetros e respostas em src/config/swagger.js
    },
  },
};
```

---

## 5. Preparação para Testes Automatizados

Embora os testes automatizados ainda não tenham sido implementados, foi feito o planeamento para introduzir **Jest** e **Supertest**. A ideia é, numa fase seguinte, escrever testes que validem:

- Fluxo de autenticação (`/auth`), incluindo casos de erro.
- Listagem e criação de bancos (`/banks`), com especial atenção a regras de permissão.
- Exportações (`/banks/{id}/export`), garantindo que os formatos gerados são válidos.

Este planeamento antecipa uma fase de maturidade superior do projeto, onde regressões poderão ser rapidamente detetadas através de pipelines de CI/CD, sem depender exclusivamente de testes manuais.

---

## 6. Registo de Evidências (Swagger) – Passo a Passo para Prints

Esta secção indica **como gerar evidências visuais (prints)** das funcionalidades através do Swagger UI (`/docs`). Estas evidências podem ser usadas em relatórios, documentação para stakeholders ou anexadas a trabalhos académicos.

### 6.1. Aceder ao Swagger

1. Certificar-se que o backend está a correr (por exemplo):
   - `npm run dev` ou `npm start` no diretório `backend/`.
2. No navegador, abrir: `http://localhost:4000/docs` (ou a porta definida em `PORT`).
3. Confirmar que aparece o título da API (por ex.: "QForge API").

**Print sugerido 1**: vista geral do Swagger com a lista de endpoints (`/auth`, `/banks`, `/dev`, etc.).

### 6.2. Autenticação via JWT no Swagger

1. No Swagger UI, clicar no botão **"Authorize"** (normalmente no topo direito).
2. Na janela que abre, no campo do esquema `bearerAuth`, inserir:
   - `Bearer <token>`
   - Exemplo: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. Carregar em **"Authorize"** e depois em **"Close"**.

Depois deste passo, todos os endpoints protegidos passam a funcionar como se o pedido tivesse sido feito com o header correto, facilitando bastante o teste de cenários que exigem autenticação.

**Print sugerido 2**: janela do botão Authorize preenchida com o token (pode ofuscar parte do token antes de guardar a imagem).

### 6.3. Testar `GET /banks` com paginação, filtros e pesquisa

1. No Swagger, localizar o endpoint `GET /banks`.
2. Clicar em **"Try it out"**.
3. Preencher alguns parâmetros de teste, por exemplo:
   - `page`: `1`
   - `limit`: `5`
   - `status`: `published` (se existir)
   - `tags`: `moodle,exame` (por exemplo)
   - `academicYear`: `2024/2025`
   - `search`: `álgebra`
4. Clicar em **"Execute"**.
5. Verificar o **código de resposta** (200 OK) e o JSON devolvido.

Este teste demonstra, de forma visual, que a API está a aplicar corretamente a combinação de filtros e paginação e que apenas bancos associados ao utilizador autenticado são devolvidos.

**Print sugerido 3**: ecrã do Swagger a mostrar a chamada a `GET /banks` com os parâmetros preenchidos e a resposta em JSON.

### 6.4. Testar `GET /banks/{id}/export`

1. No Swagger, localizar o endpoint `GET /banks/{id}/export`.
2. Clicar em **"Try it out"**.
3. Preencher:
   - `id`: o ID de um banco válido (copiado do resultado de `GET /banks`).
   - `format`: `gift` (por exemplo; repetir mais tarde com `aiken` e `moodle`).
4. Clicar em **"Execute"**.
5. Verificar a resposta:
   - Código 200 OK.
   - Corpo da resposta com texto GIFT, AIKEN ou XML, consoante o formato.

Esta evidência comprova que o backend é capaz de gerar ficheiros de exportação corretos e que respeita as permissões de acesso ao banco.

**Print sugerido 4**: ecrã do Swagger para `GET /banks/{id}/export` a mostrar o `id`, o `format` e o corpo da resposta.

### 6.5. Testar erros de permissões

1. Repetir os testes anteriores com um utilizador que **não tenha acesso** a certo banco (por exemplo, não é owner, não está em `sharedWith` nem `coordinators`).
2. Voltar a executar `GET /banks/{id}` ou `GET /banks/{id}/export`.
3. Confirmar que a resposta é `403 Forbidden` com mensagem adequada.

Este cenário é importante para provar que as regras de segurança estão de facto a bloquear acessos indevidos.

**Print sugerido 5**: exemplo de resposta `403` no Swagger, demonstrando o funcionamento do controlo de permissões.

---

## 7. Resumo das Principais Melhorias

As principais melhorias adicionadas desde o último relatório completo são:

1. **Controlo de acesso avançado por role** com o middleware `requireRole`, permitindo distinguir comportamentos entre DOCENTE, COORDENADOR e ADMIN.
2. **Listagem de bancos com paginação, filtros e pesquisa** em `GET /banks`, facilitando a gestão em cenários com muitos bancos.
3. **Exportação de bancos de questões** em três formatos principais: **GIFT**, **AIKEN** e **Moodle XML**, simplificando a integração com Moodle e outras ferramentas.
4. **Swagger atualizado** com autenticação JWT via botão Authorize, documentação detalhada de `/banks` e do endpoint de exportação, e exemplos de uso.
5. **Planeamento de testes automatizados** com Jest + Supertest, preparando o projeto para uma fase seguinte de cobertura de testes.
6. **Guia de evidências no Swagger**, com passos claros para executar endpoints e capturar prints demonstrativos.

Este relatório incremental deve ser lido em complemento ao relatório anterior, focando-se exclusivamente nas funcionalidades e alterações agora introduzidas no backend do QForge.
