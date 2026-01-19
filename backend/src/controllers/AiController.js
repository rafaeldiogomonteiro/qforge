import {
  generateQuestions,
  improveQuestion,
  generateDistractors,
  GROQ_MODELS,
} from "../services/aiService.js";
import AiProviderConfig from "../models/AiProviderConfig.js";
import AiGeneration from "../models/AiGeneration.js";
import Question from "../models/Question.js";
import QuestionBank from "../models/QuestionBank.js";
import ChapterTag from "../models/ChapterTag.js";
import Label from "../models/Label.js";

/**
 * Obtém a API key do Groq (do provider configurado ou env)
 */
async function getGroqApiKey(userId) {
  // 1. Tenta buscar config do utilizador
  const config = await AiProviderConfig.findOne({
    provider: "groq",
    isActive: true,
    $or: [{ createdBy: userId }, { createdBy: { $exists: false } }],
  }).sort({ createdBy: -1 }); // Prefere config do utilizador

  if (config?.apiKey) {
    return config.apiKey;
  }

  // 2. Fallback para variável de ambiente
  if (process.env.GROQ_API_KEY) {
    return process.env.GROQ_API_KEY;
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

    // Obtém API key
    const apiKey = await getGroqApiKey(req.userId);
    if (!apiKey) {
      return res.status(400).json({
        error:
          "API key do Groq não configurada. Configure em /ai/config ou defina GROQ_API_KEY no ambiente.",
      });
    }

    // Valida banco se for guardar
    let bank = null;
    if (saveToBank && bankId) {
      bank = await QuestionBank.findById(bankId);
      if (!bank) {
        return res.status(404).json({ error: "Banco de questões não encontrado" });
      }
      if (String(bank.owner) !== String(req.userId)) {
        return res
          .status(403)
          .json({ error: "Não tens permissão para adicionar questões a este banco" });
      }
    }

    // Gera questões
    const result = await generateQuestions(apiKey, {
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
      // Processa chapterTags (cria se não existir)
      const chapterTagIds = await upsertChapterTags(chapterTags);
      const labelIds = await upsertLabels(labels);

      for (const q of result.questions) {
        const question = await Question.create({
          bank: bank._id,
          type: q.type,
          stem: q.stem,
          options: q.options,
          acceptableAnswers: q.acceptableAnswers,
          difficulty: q.difficulty,
          tags: chapterTags, // legacy
          chapterTags: chapterTagIds,
          labels: labelIds,
          source: "AI",
          status: "DRAFT",
          createdBy: req.userId,
        });
        savedQuestions.push(question);
      }

      // Regista geração
      await AiGeneration.create({
        user: req.userId,
        bank: bank._id,
        providerConfig: null, // TODO: guardar ref se usar config
        prompt: `Topic: ${topic || ""}\nContent: ${content || ""}`,
        params: {
          numQuestions,
          types,
          difficulty: difficulties,
          language,
        },
        questionIds: savedQuestions.map((q) => q._id),
        rawResponse: result.rawResponse,
      });
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

    const apiKey = await getGroqApiKey(req.userId);
    if (!apiKey) {
      return res.status(400).json({ error: "API key do Groq não configurada" });
    }

    const result = await improveQuestion(apiKey, targetQuestion, instructions);

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

    const apiKey = await getGroqApiKey(req.userId);
    if (!apiKey) {
      return res.status(400).json({ error: "API key do Groq não configurada" });
    }

    const distractors = await generateDistractors(
      apiKey,
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

/**
 * GET /ai/models
 * Lista modelos disponíveis
 */
export async function listModelsHandler(req, res) {
  res.json({
    provider: "groq",
    models: Object.entries(GROQ_MODELS).map(([key, value]) => ({
      id: value,
      name: key.replace(/_/g, " "),
    })),
    default: GROQ_MODELS.LLAMA_3_3_70B,
  });
}

/**
 * POST /ai/config
 * Configura API key do Groq
 */
export async function saveConfigHandler(req, res) {
  try {
    const { apiKey, model } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: "apiKey é obrigatória" });
    }

    // Testa a API key
    try {
      const testResponse = await fetch(
        "https://api.groq.com/openai/v1/models",
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      if (!testResponse.ok) {
        return res.status(400).json({ error: "API key inválida" });
      }
    } catch {
      return res.status(400).json({ error: "Não foi possível validar a API key" });
    }

    // Guarda ou atualiza config
    const config = await AiProviderConfig.findOneAndUpdate(
      { provider: "groq", createdBy: req.userId },
      {
        name: "Groq",
        provider: "groq",
        model: model || GROQ_MODELS.LLAMA_3_3_70B,
        apiKey,
        isActive: true,
        createdBy: req.userId,
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Configuração guardada",
      config: {
        id: config._id,
        provider: config.provider,
        model: config.model,
        isActive: config.isActive,
      },
    });
  } catch (err) {
    console.error("Erro em saveConfigHandler:", err);
    res.status(500).json({ error: "Erro ao guardar configuração" });
  }
}

/**
 * GET /ai/config
 * Obtém configuração atual
 */
export async function getConfigHandler(req, res) {
  try {
    const config = await AiProviderConfig.findOne({
      provider: "groq",
      createdBy: req.userId,
    }).lean();

    const hasEnvKey = !!process.env.GROQ_API_KEY;

    res.json({
      hasConfig: !!config || hasEnvKey,
      config: config
        ? {
            id: config._id,
            provider: config.provider,
            model: config.model,
            isActive: config.isActive,
          }
        : null,
      usingEnvKey: !config && hasEnvKey,
    });
  } catch (err) {
    console.error("Erro em getConfigHandler:", err);
    res.status(500).json({ error: "Erro ao obter configuração" });
  }
}

// Helpers para upsert de tags e labels
async function upsertChapterTags(names) {
  if (!Array.isArray(names) || names.length === 0) return [];

  const ids = [];
  for (const name of names) {
    const normalizedName = String(name).trim().toLowerCase();
    const tag = await ChapterTag.findOneAndUpdate(
      { normalizedName },
      { $setOnInsert: { name: String(name).trim(), normalizedName, isActive: true } },
      { new: true, upsert: true }
    );
    ids.push(tag._id);
  }
  return ids;
}

async function upsertLabels(names) {
  if (!Array.isArray(names) || names.length === 0) return [];

  const ids = [];
  for (const name of names) {
    const normalizedName = String(name).trim().toLowerCase();
    const label = await Label.findOneAndUpdate(
      { normalizedName },
      { $setOnInsert: { name: String(name).trim(), normalizedName, isActive: true } },
      { new: true, upsert: true }
    );
    ids.push(label._id);
  }
  return ids;
}
