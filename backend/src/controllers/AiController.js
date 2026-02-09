import {
  generateQuestions,
  GROQ_MODELS,
} from "../services/aiService.js";
import Question from "../models/Question.js";
import QuestionBank from "../models/QuestionBank.js";
import ChapterTag from "../models/ChapterTag.js";
import Label from "../models/Label.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "arcee-ai/trinity-large-preview:free";

/**
 * Obtém o provedor de IA (Groq por defeito, senão OpenRouter como fallback)
 */
function getAiProvider() {
  if (process.env.GROQ_API_KEY) {
    return {
      name: "groq",
      apiKey: process.env.GROQ_API_KEY,
      model: GROQ_MODELS.LLAMA_3_3_70B,
      baseURL: "https://api.groq.com/openai/v1",
    };
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: OPENROUTER_DEFAULT_MODEL,
      baseURL: OPENROUTER_BASE_URL,
      headers: {
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

      if (!isOwner) {
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
    const userProvidedChapterTags =
      Array.isArray(chapterTags) && chapterTags.length > 0 ? chapterTags : [];

    if (saveToBank && bank) {
      for (const q of result.questions) {
        // Capítulos: se o utilizador forneceu, usa-os sempre. Caso contrário, usa os gerados pela IA.
        const finalChapterTags =
          userProvidedChapterTags.length > 0
            ? userProvidedChapterTags
            : Array.isArray(q.chapterTags) && q.chapterTags.length > 0
            ? q.chapterTags
            : [];
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
    const message = err?.message || "Erro ao gerar questões";
    const isTimeout = /(tempo limite|timeout|timed out)/i.test(message);

    res.status(isTimeout ? 504 : 500).json({
      error: message,
    });
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
