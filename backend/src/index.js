import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import devRoutes from "./routes/devRoutes.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import authRoutes from "./routes/authRoutes.js";
import bankRoutes from "./routes/bankRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Swagger UI em /docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas principais
app.use("/auth", authRoutes);
app.use("/banks", bankRoutes);

// Rotas de teste/desenvolvimento
app.use("/dev", devRoutes);

// Rota de health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "QForge API está a funcionar" });
});

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server a correr em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro ao ligar à base de dados:", err.message);
    process.exit(1);
  }
}

start();
