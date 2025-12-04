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
          role: { type: "string", enum: ["DOCENTE", "COORDENADOR", "ADMIN"] },
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
            enum: ["DOCENTE", "COORDENADOR", "ADMIN"],
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
  },
};
