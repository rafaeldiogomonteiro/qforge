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
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          role: { type: "string", enum: ["DOCENTE", "ADMIN"] },
        },
      },
      AuthRegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Rafael Monteiro" },
          email: { type: "string", example: "rafael@example.com" },
          password: { type: "string", example: "123456" },
          role: {
            type: "string",
            enum: ["DOCENTE", "ADMIN"],
            example: "DOCENTE",
          },
        },
      },
      AuthLoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "rafael@example.com" },
          password: { type: "string", example: "123456" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          token: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      QuestionBank: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string", example: "Banco POO" },
          description: { type: "string", example: "Questões de Programação Orientada a Objetos" },
          language: { type: "string", example: "pt-PT" },
          discipline: { type: "string", example: "POO" },
          academicYear: { type: "string", example: "2025/2026" },
          tags: {
            type: "array",
            items: { type: "string" },
            example: ["POO", "frequência"],
          },
          status: {
            type: "string",
            enum: ["DRAFT", "IN_REVIEW", "OFFICIAL", "ARCHIVED"],
          },
        },
      },
      CreateBankRequest: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", example: "Banco POO" },
          description: { type: "string" },
          language: { type: "string", example: "pt-PT" },
          discipline: { type: "string", example: "POO" },
          academicYear: { type: "string", example: "2025/2026" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      Question: {
        type: "object",
        properties: {
          id: { type: "string" },
          bank: { type: "string" },
          type: {
            type: "string",
            enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "OPEN"],
          },
          stem: { type: "string", example: "Qual é a saída do seguinte código?" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                isCorrect: { type: "boolean" },
              },
            },
          },
          acceptableAnswers: {
            type: "array",
            items: { type: "string" },
          },
          difficulty: { type: "integer", minimum: 1, maximum: 4 },
          usageCount: { type: "integer", minimum: 0 },
          tags: { type: "array", items: { type: "string" } },
          labels: { type: "array", items: { type: "string" } },
          chapterTags: { type: "array", items: { type: "string" } },
          status: {
            type: "string",
            enum: ["DRAFT", "IN_REVIEW", "APPROVED"],
          },
        },
      },
      CreateQuestionRequest: {
        type: "object",
        required: ["bank", "type", "stem"],
        properties: {
          bank: { type: "string" },
          type: {
            type: "string",
            enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "OPEN"],
          },
          stem: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                isCorrect: { type: "boolean" },
              },
            },
          },
          acceptableAnswers: {
            type: "array",
            items: { type: "string" },
          },
          difficulty: { type: "integer", minimum: 1, maximum: 4 },
          tags: { type: "array", items: { type: "string" } },
          labels: { type: "array", items: { type: "string" } },
          chapterTags: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check da API",
        tags: ["Sistema"],
        responses: {
          200: {
            description: "API operacional",
          },
        },
      },
    },
    "/auth/register": {
      post: {
        summary: "Registar novo utilizador",
        tags: ["Autenticação"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AuthRegisterRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Utilizador registado com sucesso",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          400: { description: "Dados em falta" },
          409: { description: "Email já registado" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login de utilizador",
        tags: ["Autenticação"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AuthLoginRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Login com sucesso",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          400: { description: "Dados em falta" },
          401: { description: "Credenciais inválidas" },
        },
      },
    },
    "/auth/me": {
      get: {
        summary: "Obter dados do utilizador autenticado",
        tags: ["Autenticação"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Dados do utilizador",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          401: { description: "Token em falta ou inválido" },
        },
      },
    },
    "/banks": {
      get: {
        summary: "Listar bancos de questões do utilizador autenticado",
        tags: ["Bancos de Questões"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Lista de bancos",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/QuestionBank" },
                },
              },
            },
          },
          401: { description: "Token inválido" },
        },
      },
      post: {
        summary: "Criar novo banco de questões",
        tags: ["Bancos de Questões"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBankRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Banco criado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuestionBank" },
              },
            },
          },
          400: { description: "Dados inválidos" },
        },
      },
    },
    "/banks/{id}": {
      get: {
        summary: "Obter banco por ID",
        tags: ["Bancos de Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Banco encontrado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuestionBank" },
              },
            },
          },
          404: { description: "Banco não encontrado" },
        },
      },
      put: {
        summary: "Atualizar banco por ID",
        tags: ["Bancos de Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBankRequest" },
            },
          },
        },
        responses: {
          200: { description: "Banco atualizado" },
          403: { description: "Sem permissão" },
          404: { description: "Banco não encontrado" },
        },
      },
      delete: {
        summary: "Apagar banco por ID",
        tags: ["Bancos de Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Banco apagado" },
          403: { description: "Sem permissão" },
          404: { description: "Banco não encontrado" },
        },
      },
    },
    "/banks/{id}/status": {
      patch: {
        summary: "Atualizar estado do banco",
        tags: ["Bancos de Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["DRAFT", "IN_REVIEW", "OFFICIAL", "ARCHIVED"],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Estado atualizado" },
          400: { description: "Transição inválida" },
          403: { description: "Sem permissão" },
          404: { description: "Banco não encontrado" },
        },
      },
    },
    "/banks/{id}/export": {
      get: {
        summary: "Exportar banco de questões",
        description: "Exporta o banco em GIFT, AIKEN ou Moodle XML",
        tags: ["Bancos de Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "format",
            in: "query",
            required: true,
            schema: {
              type: "string",
              enum: ["gift", "aiken", "moodle"],
            },
            description: "Formato de exportação",
          },
        ],
        responses: {
          200: {
            description: "Ficheiro de exportação",
          },
          400: { description: "Formato inválido" },
          403: { description: "Sem permissão" },
          404: { description: "Banco não encontrado" },
        },
      },
    },
    "/questions": {
      get: {
        summary: "Listar questões (pode ser filtrado por banco)",
        tags: ["Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "bankId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filtrar por ID do banco",
          },
        ],
        responses: {
          200: {
            description: "Lista de questões",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Question" },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Criar questão",
        tags: ["Questões"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateQuestionRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Questão criada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Question" },
              },
            },
          },
        },
      },
    },
    "/questions/{id}": {
      get: {
        summary: "Obter questão por ID",
        tags: ["Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Questão",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Question" },
              },
            },
          },
          404: { description: "Questão não encontrada" },
        },
      },
      put: {
        summary: "Atualizar questão por ID",
        tags: ["Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateQuestionRequest" },
            },
          },
        },
        responses: {
          200: { description: "Questão atualizada" },
          404: { description: "Questão não encontrada" },
        },
      },
      delete: {
        summary: "Apagar questão por ID",
        tags: ["Questões"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Questão apagada" },
          404: { description: "Questão não encontrada" },
        },
      },
    },

    "/labels": {
      get: {
        summary: "Listar labels disponíveis",
        tags: ["Labels"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "includeInactive",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["0", "1"] },
          },
        ],
        responses: {
          200: { description: "Lista de labels" },
        },
      },
      post: {
        summary: "Criar/reutilizar label",
        tags: ["Labels"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Label criada ou existente" },
          400: { description: "Dados inválidos" },
        },
      },
    },
    "/labels/{id}": {
      put: {
        summary: "Editar label",
        tags: ["Labels"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Label atualizada" },
          404: { description: "Não encontrada" },
        },
      },
      delete: {
        summary: "Desativar label",
        tags: ["Labels"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Label desativada" },
          404: { description: "Não encontrada" },
        },
      },
    },

    "/chapter-tags": {
      get: {
        summary: "Listar tags de capítulos disponíveis",
        tags: ["Chapter Tags"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "includeInactive",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["0", "1"] },
          },
        ],
        responses: {
          200: { description: "Lista de tags" },
        },
      },
      post: {
        summary: "Criar/reutilizar tag de capítulo",
        tags: ["Chapter Tags"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Tag criada ou existente" },
          400: { description: "Dados inválidos" },
        },
      },
    },
    "/chapter-tags/{id}": {
      put: {
        summary: "Editar tag de capítulo",
        tags: ["Chapter Tags"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Tag atualizada" },
          404: { description: "Não encontrada" },
        },
      },
      delete: {
        summary: "Desativar tag de capítulo",
        tags: ["Chapter Tags"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Tag desativada" },
          404: { description: "Não encontrada" },
        },
      },
    },

    // ============ AI Routes ============
    "/ai/config": {
      get: {
        summary: "Obter configuração de IA",
        tags: ["IA (Groq)"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Configuração atual" },
        },
      },
      post: {
        summary: "Configurar API key do Groq",
        tags: ["IA (Groq)"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["apiKey"],
                properties: {
                  apiKey: { type: "string", description: "API key do Groq" },
                  model: { type: "string", description: "Modelo a usar (opcional)" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Configuração guardada" },
          400: { description: "API key inválida" },
        },
      },
    },
    "/ai/models": {
      get: {
        summary: "Listar modelos de IA disponíveis",
        tags: ["IA (Groq)"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Lista de modelos" },
        },
      },
    },
    "/ai/generate-questions": {
      post: {
        summary: "Gerar questões usando IA",
        tags: ["IA (Groq)"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  bankId: { type: "string", description: "ID do banco para guardar (opcional)" },
                  topic: { type: "string", example: "HTML Forms", description: "Tópico para gerar questões" },
                  content: { type: "string", description: "Conteúdo/texto de referência" },
                  numQuestions: { type: "integer", default: 5, description: "Número de questões" },
                  types: {
                    type: "array",
                    items: { type: "string", enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "OPEN"] },
                    default: ["MULTIPLE_CHOICE"],
                  },
                  difficulties: {
                    type: "array",
                    items: { type: "integer", minimum: 1, maximum: 4 },
                    default: [2],
                    description: "1=Básico, 2=Normal, 3=Difícil, 4=Muito Difícil",
                  },
                  chapterTags: { type: "array", items: { type: "string" }, description: "Tags de capítulos" },
                  labels: { type: "array", items: { type: "string" }, description: "Labels (ex: Época Normal)" },
                  language: { type: "string", default: "pt-PT" },
                  additionalInstructions: { type: "string", description: "Instruções adicionais para a IA" },
                  saveToBank: { type: "boolean", default: false, description: "Guardar questões no banco" },
                  requireApproval: {
                    type: "boolean",
                    default: false,
                    description: "Se true, cria uma geração PENDING para revisão/aprovação antes de guardar (requer bankId)",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Questões geradas com sucesso" },
          400: { description: "Parâmetros inválidos ou API key não configurada" },
        },
      },
    },

    "/ai/generations/{id}": {
      get: {
        summary: "Obter geração de IA (sugestões) por ID",
        tags: ["IA (Groq)"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Geração" },
          404: { description: "Não encontrada" },
        },
      },
    },
    "/ai/generations/{id}/approve": {
      post: {
        summary: "Aprovar/aplicar sugestões e criar questões no banco",
        tags: ["IA (Groq)"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  approvals: {
                    type: "array",
                    description: "Lista de decisões por índice; se omitido aprova tudo",
                    items: {
                      type: "object",
                      required: ["index"],
                      properties: {
                        index: { type: "integer", minimum: 0 },
                        approved: { type: "boolean", default: true },
                        edits: {
                          type: "object",
                          description: "Edições opcionais antes de guardar",
                          properties: {
                            type: { type: "string" },
                            stem: { type: "string" },
                            difficulty: { type: "integer", minimum: 1, maximum: 4 },
                            labels: { type: "array", items: { type: "string" } },
                            chapterTags: { type: "array", items: { type: "string" } },
                            options: { type: "array" },
                            acceptableAnswers: { type: "array", items: { type: "string" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Aplicado com sucesso" },
          400: { description: "Geração não pendente ou dados inválidos" },
          404: { description: "Não encontrada" },
        },
      },
    },
    "/ai/improve-question": {
      post: {
        summary: "Melhorar uma questão existente usando IA",
        tags: ["IA (Groq)"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  questionId: { type: "string", description: "ID da questão existente" },
                  question: {
                    type: "object",
                    description: "Questão a melhorar (alternativa a questionId)",
                    properties: {
                      stem: { type: "string" },
                      type: { type: "string" },
                      options: { type: "array" },
                    },
                  },
                  instructions: { type: "string", description: "Instruções específicas para melhoria" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Questão melhorada" },
          400: { description: "Dados inválidos" },
        },
      },
    },
    "/ai/generate-distractors": {
      post: {
        summary: "Gerar distratores (opções erradas) para uma questão",
        tags: ["IA (Groq)"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["stem", "correctAnswer"],
                properties: {
                  stem: { type: "string", description: "Enunciado da questão" },
                  correctAnswer: { type: "string", description: "Resposta correta" },
                  numDistractors: { type: "integer", default: 3, description: "Número de distratores" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Distratores gerados" },
          400: { description: "Dados inválidos" },
        },
      },
    },
  },
};
