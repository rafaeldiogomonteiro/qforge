import express from "express";
import User from "../models/User.js";
import QuestionBank from "../models/QuestionBank.js";
import Question from "../models/Question.js";

const router = express.Router();

router.post("/seed", async (req, res) => {
  try {
    const user = await User.create({
      name: "Docente Teste",
      email: "docente@example.com",
      passwordHash: "hash_fake"
    });

    const bank = await QuestionBank.create({
      title: "POO - Teste 1",
      owner: user._id,
      discipline: "Programação Orientada a Objetos",
      academicYear: "2025/2026"
    });

    const question = await Question.create({
      bank: bank._id,
      type: "MULTIPLE_CHOICE",
      stem: "O que é uma classe?",
      options: [
        { text: "Um molde para objetos", isCorrect: true },
        { text: "Um objeto específico", isCorrect: false }
      ],
      createdBy: user._id
    });

    res.json({
      message: "Seed realizado com sucesso",
      user,
      bank,
      question
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
