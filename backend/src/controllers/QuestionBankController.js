import QuestionBank from "../models/QuestionBank.js";
import Question from "../models/Question.js";

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
      tags,
      academicYear,
      search,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

    const filter = { owner: req.userId };

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

  const asText = (value) => (value == null ? "" : String(value));

  const sanitizeStem = (q) => asText(q.stem || q.text || q.question || "");
  const sanitizeName = (q) => {
    const raw = asText(q.title || sanitizeStem(q) || "Pergunta").trim();
    return raw || "Pergunta";
  };

  const formatTextTag = (value, format = "html") =>
    `<text>${escapeXml(asText(value))}</text>`;

  const defaultGrade = "1.0000000";
  const penalty = "0.0000000";
  const hidden = "0";

  const buildCategory = (name) => `  <question type="category">
    <category>
      <text>$course$/top/${escapeXml(name || "Banco")}</text>
    </category>
  </question>`;

  const buildMultichoice = (q) => {
    const options = (q.options || []).map((opt) => ({
      text: asText(opt?.text ?? opt ?? ""),
      isCorrect: Boolean(opt?.isCorrect),
    }));

    if (options.length === 0) {
      return null; // Moodle ignora perguntas sem respostas; evitamos XML inválido
    }

    const anyMarked = options.some((o) => o.isCorrect);
    const preparedOptions = anyMarked
      ? options
      : options.map((opt, idx) => ({ ...opt, isCorrect: idx === 0 }));

    const correctCount = Math.max(
      1,
      preparedOptions.filter((o) => o.isCorrect).length
    );
    const single = correctCount === 1 ? "true" : "false";

    const answersXml = preparedOptions
      .map((opt) => {
        const fraction = opt.isCorrect ? 100 / correctCount : 0;
        return `    <answer fraction="${fraction}" format="html">
      ${formatTextTag(opt.text)}
      <feedback format="html"><text></text></feedback>
    </answer>`;
      })
      .join("\n");

    return `  <question type="multichoice">
    <name>${formatTextTag(sanitizeName(q))}</name>
    <questiontext format="html">${formatTextTag(sanitizeStem(q))}</questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>${defaultGrade}</defaultgrade>
    <penalty>${penalty}</penalty>
    <hidden>${hidden}</hidden>
    <single>${single}</single>
    <shuffleanswers>1</shuffleanswers>
    <answernumbering>abc</answernumbering>
${answersXml}
  </question>`;
  };

  const buildTrueFalse = (q) => {
    const options = (q.options || []).map((opt) => ({
      text: asText(opt?.text ?? opt ?? ""),
      isCorrect: Boolean(opt?.isCorrect),
    }));

    const hasTrueCorrect = options.some(
      (o) => o.isCorrect && /^true|verdadeiro$/i.test(o.text.trim())
    );
    const hasFalseCorrect = options.some(
      (o) => o.isCorrect && /^false|falso$/i.test(o.text.trim())
    );

    const correctIsTrue =
      hasTrueCorrect || (!hasFalseCorrect && !hasTrueCorrect && true);

    return `  <question type="truefalse">
    <name>${formatTextTag(sanitizeName(q))}</name>
    <questiontext format="html">${formatTextTag(sanitizeStem(q))}</questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>${defaultGrade}</defaultgrade>
    <penalty>${penalty}</penalty>
    <hidden>${hidden}</hidden>
    <answer fraction="${correctIsTrue ? "100" : "0"}" format="html">
      <text>true</text>
      <feedback format="html"><text></text></feedback>
    </answer>
    <answer fraction="${correctIsTrue ? "0" : "100"}" format="html">
      <text>false</text>
      <feedback format="html"><text></text></feedback>
    </answer>
  </question>`;
  };

  const buildShortAnswer = (q) => {
    const answers = (q.acceptableAnswers || [])
      .map((a) => asText(a).trim())
      .filter(Boolean);

    if (answers.length === 0) {
      return null;
    }

    const answersXml = answers
      .map(
        (ans) => `    <answer fraction="100" format="moodle_auto_format">
      ${formatTextTag(ans, "moodle_auto_format")}
      <feedback format="html"><text></text></feedback>
    </answer>`
      )
      .join("\n");

    return `  <question type="shortanswer">
    <name>${formatTextTag(sanitizeName(q))}</name>
    <questiontext format="html">${formatTextTag(sanitizeStem(q))}</questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>${defaultGrade}</defaultgrade>
    <penalty>${penalty}</penalty>
    <hidden>${hidden}</hidden>
    <usecase>0</usecase>
${answersXml}
  </question>`;
  };

  const buildEssay = (q) => `  <question type="essay">
    <name>${formatTextTag(sanitizeName(q))}</name>
    <questiontext format="html">${formatTextTag(sanitizeStem(q))}</questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>${defaultGrade}</defaultgrade>
    <penalty>${penalty}</penalty>
    <hidden>${hidden}</hidden>
    <responseformat>editor</responseformat>
    <responserequired>1</responserequired>
    <responsefieldlines>10</responsefieldlines>
    <attachments>0</attachments>
    <attachmentsrequired>0</attachmentsrequired>
    <graderinfo format="html"><text></text></graderinfo>
    <responsetemplate format="html"><text></text></responsetemplate>
  </question>`;

  const buildQuestion = (q) => {
    const qType = String(q.type || "MULTIPLE_CHOICE").toUpperCase();
    if (qType === "MULTIPLE_CHOICE") return buildMultichoice(q);
    if (qType === "TRUE_FALSE") return buildTrueFalse(q);
    if (qType === "SHORT_ANSWER") return buildShortAnswer(q);
    if (qType === "OPEN") return buildEssay(q);
    return buildMultichoice(q); // fallback
  };

  const blocks = [
    buildCategory(bankName),
    ...questions.map((q) => buildQuestion(q)).filter(Boolean),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${blocks.join("\n")}
</quiz>`;
}

// GET /banks/:id/export?format=gift|aiken|moodle
export async function exportBank(req, res) {
  try {
    const { id } = req.params;
    const format = (req.query.format || "").toLowerCase();
    const idsRaw = (req.query.ids || "").trim();

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

    let questionFilter = { bank: bank._id };
    if (idsRaw) {
      const ids = idsRaw
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        questionFilter._id = { $in: ids };
      }
    }

    const questions = await Question.find(questionFilter).lean();

    // Marca utilização: cada export incrementa 1 uso por questão do banco
    if (questions.length > 0) {
      await Question.updateMany(
        { _id: { $in: questions.map((q) => q._id) } },
        { $inc: { usageCount: 1 } }
      );
    }

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
