import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  createQuestion,
  listQuestionsForBank,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
} from "../controllers/QuestionController.js";

const router = express.Router();

// todas as rotas de questões exigem autenticação
router.use(authMiddleware);

// criar questão num banco
router.post("/banks/:bankId/questions", createQuestion);

// listar questões de um banco
router.get("/banks/:bankId/questions", listQuestionsForBank);

// operações por id de questão
router.get("/questions/:id", getQuestionById);
router.put("/questions/:id", updateQuestion);
router.delete("/questions/:id", deleteQuestion);

export default router;
