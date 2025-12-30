import QuestionBank from "../models/QuestionBank.js";
import User from "../models/User.js";
import Question from "../models/Question.js";

function canSetOfficialOrArchived(role) {
  return role === "COORDENADOR" || role === "ADMIN";
}

function isValidStatusTransition(from, to) {
  if (from === to) return true;

  if (from === "DRAFT") {
    return ["IN_REVIEW", "ARCHIVED"].includes(to);
  }

  if (from === "IN_REVIEW") {
    return ["DRAFT", "OFFICIAL", "ARCHIVED"].includes(to);
  }

  if (from === "OFFICIAL") {
    return ["ARCHIVED"].includes(to);
  }

  if (from === "ARCHIVED") {
    // banco arquivado não pode voltar atrás
    return false;
  }

  return false;
}

// POST /banks
export async function createBank(req, res) {
  try {
    const { title, description, language, discipline, academicYear, tags } =
      req.body;

    if (!title) {
      return res.status(400).json({ error: "title é obrigatório" });
    }

    const bank = await QuestionBank.create({
      title,
      description,
      language: language || "pt-PT",
      discipline,
      academicYear,
      owner: req.userId,
      tags: tags || [],
    });

    res.status(201).json(bank);
  } catch (err) {
    console.error("Erro em createBank:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// GET /banks
export async function listMyBanks(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      tags,
      academicYear,
      search,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

    const filter = { owner: req.userId };

    if (status) {
      filter.status = status;
    }

    if (academicYear) {
      filter.academicYear = academicYear;
    }

    if (tags) {
      const tagList = Array.isArray(tags)
        ? tags
        : String(tags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
      if (tagList.length > 0) {
        filter.tags = { $in: tagList };
      }
    }

    if (search) {
      const regex = new RegExp(String(search), "i");
      filter.$or = [{ title: regex }, { discipline: regex }];
    }

    const total = await QuestionBank.countDocuments(filter);

    const banks = await QuestionBank.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: banks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("Erro em listMyBanks:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// GET /banks/:id
export async function getBankById(req, res) {
  try {
    const { id } = req.params;
    const bank = await QuestionBank.findById(id);

    if (!bank) {
      return res.status(404).json({ error: "Banco não encontrado" });
    }

    if (String(bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para ver este banco" });
    }

    res.json(bank);
  } catch (err) {
    console.error("Erro em getBankById:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PUT /banks/:id
export async function updateBank(req, res) {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      language,
      discipline,
      academicYear,
      tags,
      status,
    } = req.body;

    const bank = await QuestionBank.findById(id);

    if (!bank) {
      return res.status(404).json({ error: "Banco não encontrado" });
    }

    if (String(bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para editar este banco" });
    }

    if (title !== undefined) bank.title = title;
    if (description !== undefined) bank.description = description;
    if (language !== undefined) bank.language = language;
    if (discipline !== undefined) bank.discipline = discipline;
    if (academicYear !== undefined) bank.academicYear = academicYear;
    if (tags !== undefined) bank.tags = tags;

    // status é tratado numa rota própria (updateBankStatus)
    if (status !== undefined) {
      console.warn(
        "Ignorado status em updateBank, usar rota PATCH /banks/:id/status"
      );
    }

    await bank.save();

    res.json(bank);
  } catch (err) {
    console.error("Erro em updateBank:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// DELETE /banks/:id
export async function deleteBank(req, res) {
  try {
    const { id } = req.params;

    const bank = await QuestionBank.findById(id);

    if (!bank) {
      return res.status(404).json({ error: "Banco não encontrado" });
    }

    if (String(bank.owner) !== String(req.userId)) {
      return res
        .status(403)
        .json({ error: "Não tens permissão para apagar este banco" });
    }

    await bank.deleteOne();

    res.json({ message: "Banco apagado com sucesso" });
  } catch (err) {
    console.error("Erro em deleteBank:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// PATCH /banks/:id/status
export async function updateBankStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["DRAFT", "IN_REVIEW", "OFFICIAL", "ARCHIVED"];

    if (!status) {
      return res.status(400).json({ error: "status é obrigatório" });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "status inválido" });
    }

    const bank = await QuestionBank.findById(id);
    if (!bank) {
      return res.status(404).json({ error: "Banco não encontrado" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: "Utilizador não encontrado" });
    }

    const from = bank.status;
    const to = status;

    if (!isValidStatusTransition(from, to)) {
      return res.status(400).json({
        error: `Transição de estado inválida: ${from} -> ${to}`,
      });
    }

    // OFFICIAL / ARCHIVED só coordenador ou admin
    if ((to === "OFFICIAL" || to === "ARCHIVED") && !canSetOfficialOrArchived(user.role)) {
      return res.status(403).json({
        error:
          "Apenas COORDENADOR ou ADMIN podem definir estado OFFICIAL ou ARCHIVED",
      });
    }

    // DRAFT / IN_REVIEW: owner ou coordenador/admin
    if (
      (to === "DRAFT" || to === "IN_REVIEW") &&
      String(bank.owner) !== String(req.userId) &&
      !canSetOfficialOrArchived(user.role)
    ) {
      return res.status(403).json({
        error:
          "Apenas o dono do banco (ou COORDENADOR/ADMIN) pode alterar este estado",
      });
    }

    bank.status = to;

    // Quando sobe a OFFICIAL, aumenta versão
    if (to === "OFFICIAL") {
      bank.version = (bank.version || 1) + 1;
    }

    await bank.save();

    res.json(bank);
  } catch (err) {
    console.error("Erro em updateBankStatus:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// Helpers para exportação
function questionsToGift(questions) {
  return questions
    .map((q) => {
      const title = q.title || "Pergunta";
      const text = q.text || "";
      const options = q.options || [];
      const correctIndex = q.correctIndex ?? options.findIndex((o) => o.isCorrect);

      const header = `::${title}:: ${text}`;
      const body = options
        .map((opt, idx) => {
          const prefix = idx === correctIndex ? "=" : "~";
          return `${prefix}${opt.text ?? opt}`;
        })
        .join(" ");

      return `${header} {${body}}`;
    })
    .join("\n\n");
}

function questionsToAiken(questions) {
  return questions
    .map((q) => {
      const title = q.title || q.text || "Pergunta";
      const options = q.options || [];
      const correctIndex = q.correctIndex ?? options.findIndex((o) => o.isCorrect);

      const letters = ["A", "B", "C", "D", "E", "F"]; // suporte básico
      const lines = [];

      lines.push(title);
      options.forEach((opt, idx) => {
        const letter = letters[idx] || String.fromCharCode(65 + idx);
        lines.push(`${letter}. ${opt.text ?? opt}`);
      });

      const correctLetter = letters[correctIndex] || letters[0];
      lines.push(`ANSWER: ${correctLetter}`);

      return lines.join("\n");
    })
    .join("\n\n");
}

function questionsToMoodleXml(questions, bankName = "Banco") {
  const escapeXml = (str = "") =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const xmlQuestions = questions
    .map((q) => {
      const name = escapeXml(q.title || "Pergunta");
      const text = escapeXml(q.text || "");
      const options = q.options || [];
      const correctIndex = q.correctIndex ?? options.findIndex((o) => o.isCorrect);

      const answersXml = options
        .map((opt, idx) => {
          const fraction = idx === correctIndex ? 100 : 0;
          const answerText = escapeXml(opt.text ?? opt);
          return `    <answer fraction="${fraction}"><text>${answerText}</text></answer>`;
        })
        .join("\n");

      return `  <question type="multichoice">
    <name><text>${name}</text></name>
    <questiontext format="html"><text>${text}</text></questiontext>
${answersXml}
  </question>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${xmlQuestions}
</quiz>`;
}

// GET /banks/:id/export?format=gift|aiken|moodle
export async function exportBank(req, res) {
  try {
    const { id } = req.params;
    const format = (req.query.format || "").toLowerCase();

    const supported = ["gift", "aiken", "moodle"];    
    if (!supported.includes(format)) {
      return res.status(400).json({ error: "Formato inválido. Use gift, aiken ou moodle" });
    }

    const bank = await QuestionBank.findById(id);
    if (!bank) {
      return res.status(404).json({ error: "Banco não encontrado" });
    }

    // Permissão básica: owner ou utilizador com acesso (podes refinar conforme o modelo)
    if (String(bank.owner) !== String(req.userId)) {
      return res.status(403).json({ error: "Não tens permissão para exportar este banco" });
    }

    const questions = await Question.find({ bank: bank._id }).lean();

    let content = "";
    let filename = `${bank.title || "banco"}`.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (format === "gift") {
      content = questionsToGift(questions);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.gift"`);
      return res.send(content);
    }

    if (format === "aiken") {
      content = questionsToAiken(questions);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.txt"`);
      return res.send(content);
    }

    if (format === "moodle") {
      content = questionsToMoodleXml(questions, bank.title);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xml"`);
      return res.send(content);
    }

    // fallback improvável
    return res.status(500).json({ error: "Erro ao gerar exportação" });
  } catch (err) {
    console.error("Erro em exportBank:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}
