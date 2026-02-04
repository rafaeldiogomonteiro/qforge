import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  listChapterTags,
  listGroupedChapterTags,
  createChapterTag,
  updateChapterTag,
  deleteChapterTag,
} from "../controllers/ChapterTagController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/grouped", listGroupedChapterTags);
router.get("/", listChapterTags);
router.post("/", createChapterTag);
router.put("/:id", updateChapterTag);
router.delete("/:id", deleteChapterTag);

export default router;
