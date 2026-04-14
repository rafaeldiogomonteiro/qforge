import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  listAuditLogs,
  createAuditLog,
  getAuditStats
} from "../controllers/AuditController.js";

const router = express.Router();

// Todas as rotas de auditoria requerem autenticação
router.use(authMiddleware);

router.get("/", listAuditLogs);
router.post("/", createAuditLog);
router.get("/stats", getAuditStats);

export default router;
