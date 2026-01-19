import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  listLabels,
  createLabel,
  updateLabel,
  deleteLabel,
} from "../controllers/LabelController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listLabels);
router.post("/", createLabel);
router.put("/:id", updateLabel);
router.delete("/:id", deleteLabel);

export default router;
