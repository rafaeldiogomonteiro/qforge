import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { getDashboardStats } from "../controllers/DashboardController.js";

const router = express.Router();

router.use(authMiddleware);
router.get("/", getDashboardStats);

export default router;

