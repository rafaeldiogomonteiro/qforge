import QuestionBank from "../models/QuestionBank.js";

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : null))
    .filter((item) => item);
}

// GET /banks
export async function listBanks(req, res) {
  try {
    const userId = req.userId;

    const banks = await QuestionBank.find({
      $or: [{ owner: userId }, { sharedWith: userId }, { coordinators: userId }]
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(banks);
  } catch (err) {
    console.error("Erro ao listar bancos:", err);
    res.status(500).json({ error: "Erro ao obter bancos" });
  }
}

// POST /banks
export async function createBank(req, res) {
  try {
    const {
      title,
      description,
      language,
      discipline,
      academicYear,
      tags,
      sharedWith,
      coordinators
    } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title é obrigatório" });
    }

    const payload = {
      title: title.trim(),
      description,
      language,
      discipline,
      academicYear,
      owner: req.userId,
      tags: normalizeStringArray(tags)
    };

    if (Array.isArray(sharedWith) && sharedWith.length > 0) {
      payload.sharedWith = sharedWith;
    }

    if (Array.isArray(coordinators) && coordinators.length > 0) {
      payload.coordinators = coordinators;
    }

    const bank = await QuestionBank.create(payload);

    res.status(201).json(bank);
  } catch (err) {
    console.error("Erro ao criar banco:", err);
    res.status(500).json({ error: "Erro ao criar banco de questões" });
  }
}
