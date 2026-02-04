import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  reorderFolders,
} from "../controllers/ChapterTagFolderController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listFolders);
router.post("/", createFolder);
router.patch("/reorder", reorderFolders);
router.patch("/:id", updateFolder);
router.delete("/:id", deleteFolder);

export default router;
