import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { generateQuestionsHandler } from "../controllers/AiController.js";
import multer from "multer";
import {
  extractPdfHandler,
  deletePdfHandler,
  deleteAllPdfsHandler,
} from "../controllers/PdfController.js";
import {
  generatePdfChatHandler,
  improvePdfChatHandler,
} from "../controllers/PdfChatController.js";

const router = express.Router();

// Todas as rotas de IA requerem autenticação
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // PDFs podem ser grandes; ajusta conforme necessidade.
    fileSize: Number(process.env.PDF_MAX_SIZE_BYTES) || 15 * 1024 * 1024,
  },
});

// Geração de questões
router.post("/generate-questions", generateQuestionsHandler);

// Upload/extração de PDFs para RAG
router.post("/pdf/extract", upload.array("pdfs", 10), extractPdfHandler);
router.delete("/pdf/:id", deletePdfHandler);
router.delete("/pdf", deleteAllPdfsHandler);

// PDF -> RAG + geração de questões
router.post("/pdf-chat/generate", generatePdfChatHandler);
router.post("/pdf-chat/improve", improvePdfChatHandler);

export default router;
