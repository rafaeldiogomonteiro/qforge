import express from "express";
import { register, login, getMe } from "../controllers/AuthController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Registar novo utilizador
router.post("/register", register);

// Login
router.post("/login", login);

// Dados do utilizador autenticado
router.get("/me", authMiddleware, getMe);

export default router;
