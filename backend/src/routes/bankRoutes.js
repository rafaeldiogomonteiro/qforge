import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  createBank,
  listMyBanks,
  getBankById,
  updateBank,
  deleteBank,
  exportBank,
  importBank,
} from "../controllers/QuestionBankController.js";

const router = express.Router();

// todas as rotas de bancos exigem utilizador autenticado
router.use(authMiddleware);

router.get("/", listMyBanks);
router.post("/", createBank);

// Importação de novo banco (colocado antes das rotas com :id para evitar conflito)
router.post("/import", importBank);

router.get("/:id", getBankById);
router.put("/:id", updateBank);
router.delete("/:id", deleteBank);

// Exportação: /banks/:id/export?format=gift|aiken|moodle
router.get("/:id/export", exportBank);

export default router;
