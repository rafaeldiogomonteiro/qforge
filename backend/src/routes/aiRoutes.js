import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  generateQuestionsHandler,
  improveQuestionHandler,
  generateDistractorsHandler,
} from "../controllers/AiController.js";

const router = express.Router();

// Todas as rotas de IA requerem autenticação
router.use(authMiddleware);

// Geração de questões
router.post("/generate-questions", generateQuestionsHandler);

// Melhorar questão
router.post("/improve-question", improveQuestionHandler);

// Gerar distratores
router.post("/generate-distractors", generateDistractorsHandler);

export default router;
