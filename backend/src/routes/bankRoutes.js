import express from "express";
import { listBanks, createBank } from "../controllers/BankController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listBanks);
router.post("/", createBank);

export default router;
