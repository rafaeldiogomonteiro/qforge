import express from "express";
import { register, login, getMe, updateProfile, changePassword } from "../controllers/AuthController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Registar novo utilizador
router.post("/register", register);

// Login
router.post("/login", login);

// Dados do utilizador autenticado
router.get("/me", authMiddleware, getMe);

// Atualizar perfil
router.put("/profile", authMiddleware, updateProfile);

// Alterar password
router.put("/password", authMiddleware, changePassword);

export default router;
