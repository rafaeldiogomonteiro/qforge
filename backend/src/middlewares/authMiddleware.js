import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2) {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;

    // Carrega o utilizador para permitir verificação de role em middlewares seguintes
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return res.status(401).json({ error: "Utilizador não encontrado" });
    }
    req.user = user;

    return next();
  } catch (err) {
    console.error("Erro ao verificar token:", err);
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

// Middleware para verificar se o utilizador tem um dos roles exigidos
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.userId || !req.user) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: "Sem permissão para esta operação" });
      }

      next();
    } catch (err) {
      console.error("Erro em requireRole:", err);
      return res.status(500).json({ error: "Erro no servidor" });
    }
  };
}
