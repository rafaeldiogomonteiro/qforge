import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  generateQuestionsHandler,
  listGenerationsHandler,
  getGenerationHandler,
  approveGenerationHandler,
  improveQuestionHandler,
  generateDistractorsHandler,
  listModelsHandler,
  saveConfigHandler,
  getConfigHandler,
} from "../controllers/AiController.js";

const router = express.Router();

// Todas as rotas de IA requerem autenticação
router.use(authMiddleware);

// Configuração
router.get("/config", getConfigHandler);
router.post("/config", saveConfigHandler);

// Modelos disponíveis
router.get("/models", listModelsHandler);

// Geração de questões
router.post("/generate-questions", generateQuestionsHandler);

// Review/approve workflow
router.get("/generations", listGenerationsHandler);
router.get("/generations/:id", getGenerationHandler);
router.post("/generations/:id/approve", approveGenerationHandler);

// Melhorar questão
router.post("/improve-question", improveQuestionHandler);

// Gerar distratores
router.post("/generate-distractors", generateDistractorsHandler);

export default router;
