import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import authRoutes from "./routes/authRoutes.js";
import bankRoutes from "./routes/bankRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import labelRoutes from "./routes/labelRoutes.js";
import chapterTagRoutes from "./routes/chapterTagRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import folderRoutes from "./routes/folderRoutes.js";
import User from "./models/User.js";
import Label from "./models/Label.js";
import ChapterTagFolder from "./models/ChapterTagFolder.js";
import ChapterTag from "./models/ChapterTag.js";

const app = express();

const allowedOrigins = new Set([
  "https://qforge.maruqes.com",
  "https://qforge-backend.maruqes.com",
]);

const corsOptions = {
  origin(origin, callback) {
    // Sem Origin: chamadas server-to-server, health checks e ferramentas locais.
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

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

// Rota de health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "QForge API está a funcionar" });
});

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await connectDB();

    // Garante que os índices refletem o esquema atual (inclui índices por owner)
    await Promise.all([
      Label.syncIndexes(),
      ChapterTagFolder.syncIndexes(),
      ChapterTag.syncIndexes(),
    ]);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server a correr em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro ao ligar à base de dados:", err.message);
    process.exit(1);
  }
}

start();
