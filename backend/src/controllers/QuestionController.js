import Question from "../models/Question.js";
import QuestionBank from "../models/QuestionBank.js";
import mongoose from "mongoose";
import Label from "../models/Label.js";
import ChapterTag from "../models/ChapterTag.js";

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : null))
    .filter(Boolean);
}

function looksLikeObjectId(value) {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

function splitIdsAndNames(arr) {
  const ids = new Set();
  const names = new Set();

  (arr || []).forEach((item) => {
    if (looksLikeObjectId(item)) {
      ids.add(String(item));
    } else if (typeof item === "string" && item.trim()) {
      names.add(item.trim());
    }
  });

  return {
    ids: Array.from(ids),
    names: Array.from(names),
  };
}

async function upsertLabelsFromNames(names, ownerId) {
  const cleaned = [...new Set(normalizeStringArray(names))];
  const ids = [];

  for (const name of cleaned) {
    const normalizedName = name.toLowerCase();
    const label = await Label.findOneAndUpdate(
      { owner: ownerId, normalizedName },
      {
        $setOnInsert: {
          name,
          normalizedName,
          isActive: true,
          owner: ownerId,
        },
      },
      { new: true, upsert: true }
    );
    if (label.isActive === false) {
      label.isActive = true;
      await label.save();
    }
    ids.push(label._id);
  }

  return ids;
}

async function upsertChapterTagsFromNames(names, ownerId) {
  const cleaned = [...new Set(normalizeStringArray(names))];
  const ids = [];

  for (const name of cleaned) {
    const normalizedName = name.toLowerCase();
    const tag = await ChapterTag.findOneAndUpdate(
      { owner: ownerId, normalizedName },
      {
        $setOnInsert: {
          name,
          normalizedName,
          isActive: true,
          owner: ownerId,
        },
      },
      { new: true, upsert: true }
    );
    if (tag.isActive === false) {
      tag.isActive = true;
      await tag.save();
    }
    ids.push(tag._id);
  }

  return ids;
}

async function namesFromChapterTagIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return [];
  const tags = await ChapterTag.find({ _id: { $in: uniqueIds } })
    .select("name")
    .lean();
  return tags.map((t) => t.name);
}

function validateDifficulty(value) {
  if (value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1 || num > 4) {
    return { error: "difficulty inválida. Use 1 (Básico) a 4 (Muito Difícil)" };
  }
  return { value: num };
}

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
      chapterTags,
      labels,
      source,
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

    const difficultyCheck = validateDifficulty(difficulty);
    if (difficultyCheck?.error) {
      return res.status(400).json({ error: difficultyCheck.error });
    }

    let chapterTagIds = [];
    if (chapterTags !== undefined) {
      const { ids: providedIds, names: providedNames } = splitIdsAndNames(chapterTags);

      if (providedIds.length) {
        const allowedTags = await ChapterTag.find({
          _id: { $in: providedIds },
          owner: req.userId,
        }).select("_id");
        if (allowedTags.length !== providedIds.length) {
          return res
            .status(400)
            .json({ error: "Algumas chapter tags não existem ou não pertencem ao utilizador" });
        }
        chapterTagIds.push(...allowedTags.map((t) => t._id));
      }

      if (providedNames.length) {
        const created = await upsertChapterTagsFromNames(providedNames, req.userId);
        chapterTagIds.push(...created);
      }
    } else if (tags !== undefined) {
      // Compatibilidade: tags (strings) -> chapterTags
      const { names: providedNames } = splitIdsAndNames(tags);
      chapterTagIds = await upsertChapterTagsFromNames(providedNames, req.userId);
    }

    let labelIds = [];
    if (labels !== undefined) {
      const { ids: providedIds, names: providedNames } = splitIdsAndNames(labels);

      if (providedIds.length) {
        const allowedLabels = await Label.find({
          _id: { $in: providedIds },
          owner: req.userId,
        }).select("_id");
        if (allowedLabels.length !== providedIds.length) {
          return res
            .status(400)
            .json({ error: "Algumas labels não existem ou não pertencem ao utilizador" });
        }
        labelIds.push(...allowedLabels.map((l) => l._id));
      }

      if (providedNames.length) {
        const created = await upsertLabelsFromNames(providedNames, req.userId);
        labelIds.push(...created);
      }
    }

    const legacyTagNames = await namesFromChapterTagIds(chapterTagIds);

    const question = await Question.create({
      bank: bank._id,
      type: type || "MULTIPLE_CHOICE",
      stem,
      options: options || [],
      acceptableAnswers: acceptableAnswers || [],
      difficulty: difficultyCheck?.value ?? 2,
      // tags legacy mantém nomes das chapterTags (para não partir clientes)
      tags: legacyTagNames,
      chapterTags: chapterTagIds,
      labels: labelIds,
      source: source || "MANUAL",
      createdBy: req.userId,
    });

    const populated = await Question.findById(question._id)
      .populate("labels", "name isActive")
      .populate("chapterTags", "name isActive")
      .lean();

    res.status(201).json(populated || question);
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

    const questions = await Question.find({ bank: bankId })
      .sort({ createdAt: -1 })
      .populate("labels", "name isActive")
      .populate("chapterTags", "name isActive")
      .lean();

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

    const question = await Question.findById(id)
      .populate("bank")
      .populate("labels", "name isActive")
      .populate("chapterTags", "name isActive");
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
      chapterTags,
      labels,
      source,
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
    if (difficulty !== undefined) {
      const difficultyCheck = validateDifficulty(difficulty);
      if (difficultyCheck?.error) {
        return res.status(400).json({ error: difficultyCheck.error });
      }
      question.difficulty = difficultyCheck.value;
    }

    if (labels !== undefined) {
      if (Array.isArray(labels) && labels.every(looksLikeObjectId)) {
        const allowedLabels = await Label.find({
          _id: { $in: labels },
          owner: req.userId,
        }).select("_id");
        if (allowedLabels.length !== labels.length) {
          return res
            .status(400)
            .json({ error: "Algumas labels não existem ou não pertencem ao utilizador" });
        }
        question.labels = allowedLabels.map((l) => l._id);
      } else {
        question.labels = await upsertLabelsFromNames(labels, req.userId);
      }
    }

    // chapterTags aceita ids ou nomes; tags (legacy) aceita nomes
    if (chapterTags !== undefined) {
      if (Array.isArray(chapterTags) && chapterTags.every(looksLikeObjectId)) {
        const allowedTags = await ChapterTag.find({
          _id: { $in: chapterTags },
          owner: req.userId,
        }).select("_id");
        if (allowedTags.length !== chapterTags.length) {
          return res
            .status(400)
            .json({ error: "Algumas chapter tags não existem ou não pertencem ao utilizador" });
        }
        question.chapterTags = allowedTags.map((t) => t._id);
      } else {
        question.chapterTags = await upsertChapterTagsFromNames(chapterTags, req.userId);
      }
      question.tags = await namesFromChapterTagIds(question.chapterTags);
    } else if (tags !== undefined) {
      question.chapterTags = await upsertChapterTagsFromNames(tags, req.userId);
      question.tags = await namesFromChapterTagIds(question.chapterTags);
    }
    if (source !== undefined) question.source = source;

    await question.save();

    const populated = await Question.findById(question._id)
      .populate("bank")
      .populate("labels", "name isActive")
      .populate("chapterTags", "name isActive")
      .lean();

    res.json(populated || question);
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
