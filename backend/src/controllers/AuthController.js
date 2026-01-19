import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
}

// POST /auth/register
export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "name, email e password são obrigatórios" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ error: "Já existe um utilizador com esse email" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const allowedRoles = ["DOCENTE", "ADMIN"];
    if (role !== undefined && role !== null && role !== "" && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: "role inválido" });
    }

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || "DOCENTE",
    });

    const token = generateToken(user._id);

    res.status(201).json({
      message: "Utilizador registado com sucesso",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Erro no register:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// POST /auth/login
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email e password são obrigatórios" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = generateToken(user._id);

    res.json({
      message: "Login efetuado com sucesso",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// GET /auth/me
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }
    res.json(user);
  } catch (err) {
    console.error("Erro no getMe:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
