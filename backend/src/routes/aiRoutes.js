import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { generateQuestionsHandler } from "../controllers/AiController.js";

const router = express.Router();

// Todas as rotas de IA requerem autenticação
router.use(authMiddleware);

// Geração de questões
router.post("/generate-questions", generateQuestionsHandler);

export default router;
