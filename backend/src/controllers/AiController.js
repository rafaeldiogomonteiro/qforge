import {
  generateQuestions,
  improveQuestion,
  generateDistractors,
  GROQ_MODELS,
} from "../services/aiService.js";
import Question from "../models/Question.js";
import QuestionBank from "../models/QuestionBank.js";
import ChapterTag from "../models/ChapterTag.js";
import Label from "../models/Label.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "arcee-ai/trinity-large-preview:free";
const OPENROUTER_FAST_MODEL =
  process.env.OPENROUTER_FAST_MODEL ||
  "liquid/lfm-2.5-1.2b-instruct:free";

/**
 * Obtém o provedor de IA (Groq por defeito, senão OpenRouter como fallback)
 */
function getAiProvider({ preferFastModel = false } = {}) {
  if (process.env.GROQ_API_KEY) {
    return {
      name: "groq",
      apiKey: process.env.GROQ_API_KEY,
      model: preferFastModel
        ? GROQ_MODELS.LLAMA_3_1_8B
        : GROQ_MODELS.LLAMA_3_3_70B,
      baseURL: "https://api.groq.com/openai/v1",
    };
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: preferFastModel ? OPENROUTER_FAST_MODEL : OPENROUTER_DEFAULT_MODEL,
      baseURL: OPENROUTER_BASE_URL,
      headers: {
        // OpenRouter recomenda enviar estas headers
        "HTTP-Referer": process.env.OPENROUTER_SITE || "http://localhost:5173",
        "X-Title": process.env.OPENROUTER_TITLE || "QForge",
      },
    };
  }

  return null;
}

/**
 * POST /ai/generate-questions
 * Gera questões usando IA e opcionalmente guarda num banco
 */
export async function generateQuestionsHandler(req, res) {
  try {
    const {
      bankId,
      topic,
      content,
      numQuestions = 5,
      types = ["MULTIPLE_CHOICE"],
      difficulties = [2],
      chapterTags = [],
      labels = [],
      language = "pt-PT",
      additionalInstructions = "",
      saveToBank = false,
    } = req.body;

    // Validação básica
    if (!topic && !content) {
      return res
        .status(400)
        .json({ error: "É necessário fornecer 'topic' ou 'content'" });
    }

    const provider = getAiProvider();
    if (!provider?.apiKey) {
      return res.status(500).json({
        error:
          "Nenhum provedor de IA está configurado. Define GROQ_API_KEY ou OPENROUTER_API_KEY no servidor.",
      });
    }

    // Valida banco se for guardar
    let bank = null;
    if (saveToBank && bankId) {
      bank = await QuestionBank.findById(bankId);
      if (!bank) {
        return res.status(404).json({ error: "Banco de questões não encontrado" });
      }

      const userId = String(req.userId);
      const isOwner = String(bank.owner) === userId;
      const isCoordinator = Array.isArray(bank.coordinators)
        ? bank.coordinators.map(String).includes(userId)
        : false;
      const isShared = Array.isArray(bank.sharedWith)
        ? bank.sharedWith.map(String).includes(userId)
        : false;

      if (!isOwner && !isCoordinator && !isShared) {
        return res
          .status(403)
          .json({ error: "Não tens permissão para adicionar questões a este banco" });
      }
    }

    // Gera questões
    const result = await generateQuestions(provider, {
      model: provider.model,
      topic,
      content,
      numQuestions,
      types,
      difficulties,
      chapterTags,
      language,
      additionalInstructions,
    });

    // Se saveToBank, guarda as questões no banco
    let savedQuestions = [];
    if (saveToBank && bank) {
      for (const q of result.questions) {
        // Usa chapter tags e labels gerados pela IA, ou os fornecidos pelo utilizador como fallback
        const finalChapterTags = Array.isArray(q.chapterTags) && q.chapterTags.length > 0 ? q.chapterTags : chapterTags;
        const finalLabels = Array.isArray(q.labels) && q.labels.length > 0 ? q.labels : labels;

        console.log(`[AI] Processando chapter tags para questão:`, finalChapterTags);
        console.log(`[AI] Processando labels para questão:`, finalLabels);

        // Converte nomes de chapter tags em IDs (cria se não existirem)
        const chapterTagIds = await upsertChapterTags(finalChapterTags, req.userId);
        // Converte nomes de labels em IDs (cria se não existirem)
        const labelIds = await upsertLabels(finalLabels, req.userId);

        console.log(`[AI] Chapter tag IDs criados/encontrados:`, chapterTagIds);
        console.log(`[AI] Label IDs criados/encontrados:`, labelIds);

        const question = await Question.create({
          bank: bank._id,
          type: q.type,
          stem: q.stem,
          options: q.options,
          acceptableAnswers: q.acceptableAnswers,
          difficulty: q.difficulty,
          tags: finalChapterTags, // legacy
          chapterTags: chapterTagIds,
          labels: labelIds,
          source: "AI",
          createdBy: req.userId,
        });
        savedQuestions.push(question);
      }
    }

    res.json({
      success: true,
      questions: result.questions,
      savedQuestions: savedQuestions.length > 0 ? savedQuestions : undefined,
      model: result.model,
      message: saveToBank
        ? `${savedQuestions.length} questões guardadas no banco`
        : "Questões geradas (não guardadas)",
    });
  } catch (err) {
    console.error("Erro em generateQuestionsHandler:", err);
    res.status(500).json({
      error: err.message || "Erro ao gerar questões",
    });
  }
}

/**
 * POST /ai/improve-question
 * Melhora uma questão existente
 */
export async function improveQuestionHandler(req, res) {
  try {
    const { questionId, question, instructions = "" } = req.body;

    let targetQuestion = question;

    // Se foi passado questionId, carrega a questão
    if (questionId) {
      const loaded = await Question.findById(questionId).lean();
      if (!loaded) {
        return res.status(404).json({ error: "Questão não encontrada" });
      }
      targetQuestion = {
        type: loaded.type,
        stem: loaded.stem,
        options: loaded.options,
        acceptableAnswers: loaded.acceptableAnswers,
      };
    }

    if (!targetQuestion || !targetQuestion.stem) {
      return res
        .status(400)
        .json({ error: "É necessário fornecer 'question' ou 'questionId'" });
    }

    const provider = getAiProvider();
    if (!provider?.apiKey) {
      return res
        .status(400)
        .json({ error: "API key de IA não configurada" });
    }

    const result = await improveQuestion(provider, targetQuestion, instructions);

    res.json({
      success: true,
      original: targetQuestion,
      improved: result.improved,
      changes: result.changes,
    });
  } catch (err) {
    console.error("Erro em improveQuestionHandler:", err);
    res.status(500).json({ error: err.message || "Erro ao melhorar questão" });
  }
}

/**
 * POST /ai/generate-distractors
 * Gera distratores para uma questão
 */
export async function generateDistractorsHandler(req, res) {
  try {
    const { stem, correctAnswer, numDistractors = 3 } = req.body;

    if (!stem || !correctAnswer) {
      return res
        .status(400)
        .json({ error: "'stem' e 'correctAnswer' são obrigatórios" });
    }

    const provider = getAiProvider({ preferFastModel: true });
    if (!provider?.apiKey) {
      return res
        .status(400)
        .json({ error: "API key de IA não configurada" });
    }

    const distractors = await generateDistractors(
      provider,
      stem,
      correctAnswer,
      numDistractors
    );

    res.json({
      success: true,
      stem,
      correctAnswer,
      distractors,
    });
  } catch (err) {
    console.error("Erro em generateDistractorsHandler:", err);
    res.status(500).json({ error: err.message || "Erro ao gerar distratores" });
  }
}

// Helpers para upsert de tags e labels
async function upsertChapterTags(names, ownerId) {
  if (!Array.isArray(names) || names.length === 0) return [];

  const ids = [];
  for (const name of names) {
    const normalizedName = String(name).trim().toLowerCase();
    const tag = await ChapterTag.findOneAndUpdate(
      { owner: ownerId, normalizedName },
      {
        $setOnInsert: {
          name: String(name).trim(),
          normalizedName,
          isActive: true,
          owner: ownerId,
        },
      },
      { new: true, upsert: true }
    );
    if (tag && tag.isActive === false) {
      tag.isActive = true;
      await tag.save();
    }
    ids.push(tag._id);
  }
  return ids;
}

async function upsertLabels(names, ownerId) {
  if (!Array.isArray(names) || names.length === 0) return [];

  const ids = [];
  for (const name of names) {
    const normalizedName = String(name).trim().toLowerCase();
    const label = await Label.findOneAndUpdate(
      { owner: ownerId, normalizedName },
      {
        $setOnInsert: {
          name: String(name).trim(),
          normalizedName,
          isActive: true,
          owner: ownerId,
        },
      },
      { new: true, upsert: true }
    );
    if (label && label.isActive === false) {
      label.isActive = true;
      await label.save();
    }
    ids.push(label._id);
  }
  return ids;
}
