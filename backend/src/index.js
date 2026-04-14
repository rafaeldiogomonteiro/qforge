import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
import express from "express";
import cors from "cors";
import { connectDB, disconnectDB } from "./config/db.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import authRoutes from "./routes/authRoutes.js";
import bankRoutes from "./routes/bankRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import labelRoutes from "./routes/labelRoutes.js";
import chapterTagRoutes from "./routes/chapterTagRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import folderRoutes from "./routes/folderRoutes.js";
import User from "./models/User.js";
import Label from "./models/Label.js";
import ChapterTagFolder from "./models/ChapterTagFolder.js";
import ChapterTag from "./models/ChapterTag.js";

const app = express();

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

const defaultAllowedOrigins = [
  "https://qforge.maruqes.com",
  "https://www.qforge.maruqes.com",
  "https://qforge-backend.maruqes.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const allowedOrigins = new Set(
  [...defaultAllowedOrigins, ...envAllowedOrigins]
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
);

const corsOptions = {
  origin(origin, callback) {
    // Sem Origin: chamadas server-to-server, health checks e ferramentas locais.
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Origem bloqueada: ${normalizedOrigin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// Swagger UI em /docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas principais
app.use("/auth", authRoutes);
app.use("/banks", bankRoutes);
app.use("/", questionRoutes);
app.use("/labels", labelRoutes);
app.use("/chapter-tags", chapterTagRoutes);
app.use("/folders", folderRoutes);
app.use("/ai", aiRoutes);
app.use("/audit-logs", auditRoutes);

// Rota de health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "QForge API está a funcionar" });
});

const PORT = 4000;

async function start() {
  try {
    await connectDB();

    // Garante que os índices refletem o esquema atual (inclui índices por owner)
    await Promise.all([
      Label.syncIndexes(),
      ChapterTagFolder.syncIndexes(),
      ChapterTag.syncIndexes(),
    ]);

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server a correr em http://localhost:${PORT}`);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ A porta ${PORT} já está em uso.`);
        process.exit(1);
      }

      console.error("❌ Erro ao iniciar o servidor:", err.message);
      process.exit(1);
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Encerrando servidor...");
      server.close(async () => {
        await disconnectDB();
        console.log("✅ Servidor encerrado");
        process.exit(0);
      });
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Encerrando servidor...");
      server.close(async () => {
        await disconnectDB();
        console.log("✅ Servidor encerrado");
        process.exit(0);
      });
    });
  } catch (err) {
    console.error("❌ Erro ao ligar à base de dados:", err.message);
    await disconnectDB();
    process.exit(1);
  }
}

start();
