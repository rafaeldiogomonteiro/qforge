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
    const { name, email, password } = req.body;

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

    const user = await User.create({
      name,
      email,
      passwordHash,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      message: "Utilizador registado com sucesso",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
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

// PUT /auth/profile - Atualizar informações do perfil
export async function updateProfile(req, res) {
  try {
    const { name, email, institution, department } = req.body;

    // Validações básicas
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "O nome é obrigatório" });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "O email é obrigatório" });
    }

    // Verificar se o email já está em uso por outro utilizador
    const existingUser = await User.findOne({ 
      email: email.trim(), 
      _id: { $ne: req.userId } 
    });
    
    if (existingUser) {
      return res.status(409).json({ error: "Este email já está em uso" });
    }

    // Atualizar o utilizador
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      {
        name: name.trim(),
        email: email.trim(),
        institution: institution?.trim() || null,
        department: department?.trim() || null,
      },
      { new: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    res.json({
      message: "Perfil atualizado com sucesso",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Erro no updateProfile:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PUT /auth/password - Alterar palavra-passe
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        error: "Todos os campos são obrigatórios" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: "A nova password deve ter pelo menos 6 caracteres" 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        error: "A nova password e a confirmação não coincidem" 
      });
    }

    // Buscar utilizador com a passwordHash
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    // Verificar password atual
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Password atual incorreta" });
    }

    // Verificar se a nova password é igual à atual
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ 
        error: "A nova password não pode ser igual à password atual" 
      });
    }

    // Hash da nova password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar password
    await User.findByIdAndUpdate(req.userId, { 
      passwordHash: newPasswordHash 
    });

    res.json({ message: "Password alterada com sucesso" });
  } catch (err) {
    console.error("Erro no changePassword:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
