import QuestionBank from "../models/QuestionBank.js";
import Question from "../models/Question.js";
import Label from "../models/Label.js";
import ChapterTag from "../models/ChapterTag.js";
import { XMLParser } from "fast-xml-parser";

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

    // Remove questões ligadas e depois o banco
    await Question.deleteMany({ bank: bank._id });
    await bank.deleteOne();

    res.json({ message: "Banco apagado com sucesso" });
  } catch (err) {
    console.error("Erro em deleteBank:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
}

// Helpers para exportação
function extractNames(values = []) {
  return (values || [])
    .map((v) => (typeof v === "string" ? v : v?.name))
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

function buildMetaCommentLines(q) {
  const lines = [];
  const labelNames = extractNames(q.labels);
  const chapterNames = extractNames(q.chapterTags);

  if (labelNames.length) lines.push(`// Etiquetas: ${labelNames.join(", ")}`);
  if (chapterNames.length)
    lines.push(`// Etiquetas de capítulo: ${chapterNames.join(", ")}`);
  return lines;
}

function questionsToGift(questions) {
  return questions
    .map((q) => {
      const title = q.title || q.stem || "Pergunta";
      const text = q.text || q.stem || "";
      const options = q.options || [];
      const correctIndex = q.correctIndex ?? options.findIndex((o) => o.isCorrect);

      const header = `::${title}:: ${text}`;
      const body = options
        .map((opt, idx) => {
          const prefix = idx === correctIndex ? "=" : "~";
          return `${prefix}${opt.text ?? opt}`;
        })
        .join(" ");

      const meta = buildMetaCommentLines(q);
      return [...meta, `${header} {${body}}`].join("\n");
    })
    .join("\n\n");
}

function questionsToAiken(questions) {
  return questions
    .map((q) => {
      const title = q.title || q.text || q.stem || "Pergunta";
      const options = q.options || [];
      const correctIndex = q.correctIndex ?? options.findIndex((o) => o.isCorrect);

      const letters = ["A", "B", "C", "D", "E", "F"]; // suporte básico
      const lines = [];

      lines.push(...buildMetaCommentLines(q));
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

  const buildTagsBlock = (q) => {
    const labelTags = extractNames(q.labels).map((name) => `label:${name}`);
    const chapterTags = extractNames(q.chapterTags).map((name) => `chapter:${name}`);
    const merged = [...labelTags, ...chapterTags];
    if (merged.length === 0) return "";
    const tagsXml = merged
      .map((t) => `    <tag><text>${escapeXml(t)}</text></tag>`)
      .join("\n");
    return `    <tags>\n${tagsXml}\n    </tags>`;
  };

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

    const tagsBlock = buildTagsBlock(q);

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
  ${tagsBlock ? `${tagsBlock}\n` : ""}${answersXml}
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

    const tagsBlock = buildTagsBlock(q);

    return `  <question type="truefalse">
    <name>${formatTextTag(sanitizeName(q))}</name>
    <questiontext format="html">${formatTextTag(sanitizeStem(q))}</questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>${defaultGrade}</defaultgrade>
    <penalty>${penalty}</penalty>
    <hidden>${hidden}</hidden>
${tagsBlock ? `${tagsBlock}\n` : ""}    <answer fraction="${correctIsTrue ? "100" : "0"}" format="html">
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

    const tagsBlock = buildTagsBlock(q);

    return `  <question type="shortanswer">
    <name>${formatTextTag(sanitizeName(q))}</name>
    <questiontext format="html">${formatTextTag(sanitizeStem(q))}</questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>${defaultGrade}</defaultgrade>
    <penalty>${penalty}</penalty>
    <hidden>${hidden}</hidden>
    <usecase>0</usecase>
  ${tagsBlock ? `${tagsBlock}\n` : ""}${answersXml}
  </question>`;
  };

  const buildEssay = (q) => {
    const tagsBlock = buildTagsBlock(q);

    return `  <question type="essay">
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
${tagsBlock ? `${tagsBlock}\n` : ""}  </question>`;
  };

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

    const questions = await Question.find(questionFilter)
      .populate("labels", "name")
      .populate("chapterTags", "name")
      .lean();

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

function clampDifficulty(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 2;
  if (num < 1) return 1;
  if (num > 4) return 4;
  return num;
}

function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, "").trim();
}

async function upsertLabelsFromNames(names, ownerId) {
  const cleaned = [...new Set((names || []).map((n) => String(n || "").trim()).filter(Boolean))];
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
  const cleaned = [...new Set((names || []).map((n) => String(n || "").trim()).filter(Boolean))];
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

function normalizeToStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseQuestionsFromAiken(content) {
  const blocks = String(content)
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions = [];

  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 3) continue;

    const stem = lines[0];
    const answerLine = lines.find((l) => /^ANSWER\s*:/i.test(l));
    const optionLines = lines.filter((l) => /^[A-Z][\.|\)]\s+/i.test(l));

    if (!answerLine || optionLines.length < 2) continue;

    const correctLetter = answerLine.replace(/^ANSWER\s*:/i, "").trim().toUpperCase();

    const options = optionLines.map((l, idx) => {
      const letter = l.slice(0, 1).toUpperCase();
      const text = l.replace(/^[A-Z][\.|\)]\s+/i, "").trim();
      return { text, isCorrect: letter === correctLetter || (correctLetter === "" && idx === 0) };
    });

    if (!options.some((o) => o.isCorrect)) {
      options[0].isCorrect = true;
    }

    questions.push({
      type: "MULTIPLE_CHOICE",
      stem,
      options,
      acceptableAnswers: [],
      difficulty: 2,
    });
  }

  return questions;
}

function parseQuestionsFromGift(content) {
  const regex = /(?:::[^:]+::)?\s*(?<stem>[^\{]+?)\s*\{(?<answers>[^}]*)\}/gms;
  const questions = [];

  let match;
  while ((match = regex.exec(content)) !== null) {
    const stem = String(match.groups?.stem || "").trim();
    const answersRaw = match.groups?.answers || "";
    const answerTokens = answersRaw
      .split(/\r?\n|(?==)|(?=~)/)
      .map((s) => s.trim())
      .filter(Boolean);

    const options = [];
    for (const token of answerTokens) {
      const prefix = token[0];
      if (prefix !== "=" && prefix !== "~") continue;
      const text = token.slice(1).trim();
      if (!text) continue;
      options.push({ text, isCorrect: prefix === "=" });
    }

    if (!stem || options.length < 2) continue;
    if (!options.some((o) => o.isCorrect)) options[0].isCorrect = true;

    questions.push({
      type: "MULTIPLE_CHOICE",
      stem,
      options,
      acceptableAnswers: [],
      difficulty: 2,
    });
  }

  return questions;
}

function parseQuestionsFromMoodleXml(content) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const parsed = parser.parse(content);
  const rawQuestions = parsed?.quiz?.question || [];
  const arr = Array.isArray(rawQuestions) ? rawQuestions : [rawQuestions];

  const questions = [];

  for (const q of arr) {
    if (!q) continue;
    const qType = String(q.type || "").toLowerCase();
    const stem = stripHtml(q.questiontext?.text || q.questiontext || "");
    if (!stem) continue;

    if (qType === "multichoice") {
      const answers = Array.isArray(q.answer) ? q.answer : q.answer ? [q.answer] : [];
      const options = answers
        .map((a) => ({ text: stripHtml(a?.text || ""), isCorrect: Number(a?.fraction || 0) > 0 }))
        .filter((o) => o.text);
      if (!options.some((o) => o.isCorrect) && options.length > 0) options[0].isCorrect = true;
      questions.push({ type: "MULTIPLE_CHOICE", stem, options, acceptableAnswers: [], difficulty: 2 });
      continue;
    }

    if (qType === "truefalse") {
      const answers = Array.isArray(q.answer) ? q.answer : q.answer ? [q.answer] : [];
      let correctIsTrue = true;
      const trueAns = answers.find((a) => /^true$/i.test(stripHtml(a?.text || "")) && Number(a?.fraction || 0) > 0);
      const falseAns = answers.find((a) => /^false$/i.test(stripHtml(a?.text || "")) && Number(a?.fraction || 0) > 0);
      if (trueAns && !falseAns) correctIsTrue = true;
      if (falseAns && !trueAns) correctIsTrue = false;
      const options = [
        { text: "Verdadeiro", isCorrect: correctIsTrue },
        { text: "Falso", isCorrect: !correctIsTrue },
      ];
      questions.push({ type: "TRUE_FALSE", stem, options, acceptableAnswers: [], difficulty: 2 });
      continue;
    }

    if (qType === "shortanswer") {
      const answers = Array.isArray(q.answer) ? q.answer : q.answer ? [q.answer] : [];
      const acceptableAnswers = answers.map((a) => stripHtml(a?.text || "")).filter(Boolean);
      if (acceptableAnswers.length === 0) continue;
      questions.push({ type: "SHORT_ANSWER", stem, options: [], acceptableAnswers, difficulty: 2 });
      continue;
    }

    if (qType === "essay") {
      questions.push({ type: "OPEN", stem, options: [], acceptableAnswers: [], difficulty: 2 });
      continue;
    }
  }

  return questions;
}

function buildQuestionDocs(parsedQuestions, bankId, userId, labelIds = [], chapterTagIds = []) {
  const docs = [];
  let skipped = 0;

  for (const q of parsedQuestions) {
    const type = String(q.type || "MULTIPLE_CHOICE").toUpperCase();
    const stem = String(q.stem || "").trim();
    if (!stem) {
      skipped += 1;
      continue;
    }

    const doc = {
      bank: bankId,
      type,
      stem,
      options: Array.isArray(q.options)
        ? q.options.map((o) => ({
            text: String(o?.text || "").trim(),
            isCorrect: Boolean(o?.isCorrect),
          }))
        : [],
      acceptableAnswers: Array.isArray(q.acceptableAnswers)
        ? q.acceptableAnswers.map((a) => String(a || "").trim()).filter(Boolean)
        : [],
      difficulty: clampDifficulty(q.difficulty ?? 2),
      tags: Array.isArray(q.tags) ? q.tags.map((t) => String(t || "").trim()).filter(Boolean) : [],
      chapterTags: chapterTagIds,
      labels: labelIds,
      source: "IMPORTED",
      createdBy: userId,
    };

    if (type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE") {
      doc.options = doc.options.filter((o) => o.text);
      if (doc.options.length < 2 || !doc.options.some((o) => o.isCorrect)) {
        skipped += 1;
        continue;
      }
    }

    if (type === "SHORT_ANSWER" && doc.acceptableAnswers.length === 0) {
      skipped += 1;
      continue;
    }

    docs.push(doc);
  }

  return { docs, skipped };
}

export async function importBank(req, res) {
  try {
    const {
      format,
      content,
      title,
      description,
      language,
      discipline,
      academicYear,
      tags,
      labels,
      chapterTags,
    } = req.body || {};

    const trimmedTitle = String(title || "").trim();

    if (!format || !content || !trimmedTitle) {
      return res.status(400).json({ error: "'title', 'format' e 'content' são obrigatórios" });
    }

    const fmt = String(format).toLowerCase();
    let parsed = [];

    if (fmt === "aiken") parsed = parseQuestionsFromAiken(content);
    else if (fmt === "gift") parsed = parseQuestionsFromGift(content);
    else if (fmt === "moodle") parsed = parseQuestionsFromMoodleXml(content);
    else {
      return res.status(400).json({ error: "Formato inválido. Use aiken, gift ou moodle" });
    }

    const { docs, skipped } = buildQuestionDocs(parsed, null, req.userId);

    if (docs.length === 0) {
      return res.status(400).json({ error: "Nenhuma questão válida encontrada no ficheiro" });
    }

    const tagsList = normalizeToStringArray(tags);
    const labelNames = normalizeToStringArray(labels);
    const chapterTagNames = normalizeToStringArray(chapterTags);

    const bank = await QuestionBank.create({
      title: trimmedTitle,
      description,
      language: language || "pt-PT",
      discipline,
      academicYear,
      owner: req.userId,
      tags: tagsList,
    });

    const labelIds = await upsertLabelsFromNames(labelNames, req.userId);
    const chapterTagIds = await upsertChapterTagsFromNames(chapterTagNames, req.userId);

    const docsWithIds = docs.map((doc) => ({
      ...doc,
      bank: bank._id,
      labels: labelIds,
      chapterTags: chapterTagIds,
    }));

    const created = await Question.insertMany(docsWithIds, { ordered: false });

    res.json({
      bankId: bank._id,
      imported: created.length,
      skipped,
      createdLabels: labelIds.length,
      createdChapterTags: chapterTagIds.length,
    });
  } catch (err) {
    console.error("Erro em importBank:", err);
    res.status(500).json({ error: err.message || "Erro ao importar" });
  }
}
