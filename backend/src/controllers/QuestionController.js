import Question from "../models/Question.js";
import QuestionBank from "../models/QuestionBank.js";

// POST /banks/:bankId/questions
export async function createQuestion(req, res) {
  try {
    const { bankId } = req.params;
    const {
      type,
      stem,
      options,
      acceptableAnswers,
      difficulty,
      tags,
      source,
      status,
    } = req.body;

    const bank = await QuestionBank.findById(bankId);
    if (!bank) {
      return res.status(404).json({ error: "Banco de questões não encontrado" });
    }

    if (String(bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para adicionar questões a este banco" });
    }

    if (!stem) {
      return res.status(400).json({ error: "stem (enunciado) é obrigatório" });
    }

    const question = await Question.create({
      bank: bank._id,
      type: type || "MULTIPLE_CHOICE",
      stem,
      options: options || [],
      acceptableAnswers: acceptableAnswers || [],
      difficulty: difficulty || 2,
      tags: tags || [],
      source: source || "MANUAL",
      status: status || "DRAFT",
      createdBy: req.userId,
    });

    res.status(201).json(question);
  } catch (err) {
    console.error("Erro em createQuestion:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// GET /banks/:bankId/questions
export async function listQuestionsForBank(req, res) {
  try {
    const { bankId } = req.params;

    const bank = await QuestionBank.findById(bankId);
    if (!bank) {
      return res.status(404).json({ error: "Banco de questões não encontrado" });
    }

    if (String(bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para ver as questões deste banco" });
    }

    const questions = await Question.find({ bank: bankId }).sort({
      createdAt: -1,
    });

    res.json(questions);
  } catch (err) {
    console.error("Erro em listQuestionsForBank:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// GET /questions/:id
export async function getQuestionById(req, res) {
  try {
    const { id } = req.params;

    const question = await Question.findById(id).populate("bank");
    if (!question) {
      return res.status(404).json({ error: "Questão não encontrada" });
    }

    if (String(question.createdBy) !== String(req.userId) &&
        String(question.bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para ver esta questão" });
    }

    res.json(question);
  } catch (err) {
    console.error("Erro em getQuestionById:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PUT /questions/:id
export async function updateQuestion(req, res) {
  try {
    const { id } = req.params;
    const {
      type,
      stem,
      options,
      acceptableAnswers,
      difficulty,
      tags,
      source,
      status,
    } = req.body;

    const question = await Question.findById(id).populate("bank");
    if (!question) {
      return res.status(404).json({ error: "Questão não encontrada" });
    }

    if (String(question.createdBy) !== String(req.userId) &&
        String(question.bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para editar esta questão" });
    }

    if (type !== undefined) question.type = type;
    if (stem !== undefined) question.stem = stem;
    if (options !== undefined) question.options = options;
    if (acceptableAnswers !== undefined)
      question.acceptableAnswers = acceptableAnswers;
    if (difficulty !== undefined) question.difficulty = difficulty;
    if (tags !== undefined) question.tags = tags;
    if (source !== undefined) question.source = source;
    if (status !== undefined) question.status = status;

    await question.save();

    res.json(question);
  } catch (err) {
    console.error("Erro em updateQuestion:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// DELETE /questions/:id
export async function deleteQuestion(req, res) {
  try {
    const { id } = req.params;

    const question = await Question.findById(id).populate("bank");
    if (!question) {
      return res.status(404).json({ error: "Questão não encontrada" });
    }

    if (String(question.createdBy) !== String(req.userId) &&
        String(question.bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para apagar esta questão" });
    }

    await question.deleteOne();

    res.json({ message: "Questão apagada com sucesso" });
  } catch (err) {
    console.error("Erro em deleteQuestion:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
