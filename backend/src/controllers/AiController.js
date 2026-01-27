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
 * Retorna objeto com apiKey, providerConfigId e model
 */
async function getGroqProvider(userId) {
  const config = await AiProviderConfig.findOne({
    provider: "groq",
    isActive: true,
    $or: [{ createdBy: userId }, { createdBy: { $exists: false } }],
  }).sort({ createdBy: -1 }); // Prefere config do utilizador

  if (config?.apiKeyEncrypted) {
    return {
      apiKey: config.getApiKey(), // Desencripta
      providerConfigId: config._id,
      model: config.model || GROQ_MODELS.LLAMA_3_3_70B,
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      apiKey: process.env.GROQ_API_KEY,
      providerConfigId: null,
      model: GROQ_MODELS.LLAMA_3_3_70B,
    };
  }

  return { apiKey: null, providerConfigId: null, model: GROQ_MODELS.LLAMA_3_3_70B };
}

/**
 * Helper simples para obter só a apiKey (usado em improve/distractors)
 */
async function getGroqApiKey(userId) {
  const provider = await getGroqProvider(userId);
  return provider.apiKey;
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
      requireApproval = false,
    } = req.body;

    // Validação básica
    if (!topic && !content) {
      return res
        .status(400)
        .json({ error: "É necessário fornecer 'topic' ou 'content'" });
    }

    const provider = await getGroqProvider(req.userId);
    if (!provider.apiKey) {
      return res.status(400).json({
        error:
          "API key do Groq não configurada. Configure em /ai/config ou defina GROQ_API_KEY no ambiente.",
      });
    }

    if (requireApproval && !bankId) {
      return res
        .status(400)
        .json({ error: "requireApproval exige bankId (para rever/aprovar e guardar)" });
    }

    // Valida banco se for guardar (saveToBank) OU se for workflow de aprovação
    let bank = null;
    if ((saveToBank || requireApproval) && bankId) {
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
    const result = await generateQuestions(provider.apiKey, {
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

    // Workflow: devolve sugestões para revisão/aprovação
    if (requireApproval && bank) {
      const generation = await AiGeneration.create({
        user: req.userId,
        bank: bank._id,
        providerConfig: provider.providerConfigId,
        prompt: `Topic: ${topic || ""}\nContent: ${content || ""}`,
        params: {
          numQuestions,
          types,
          difficulty: difficulties,
          language,
        },
        suggestedQuestions: result.questions,
        status: "PENDING",
        questionIds: [],
        rawResponse: result.rawResponse,
      });

      return res.json({
        success: true,
        mode: "approval",
        generationId: generation._id,
        bankId: bank._id,
        suggestions: generation.suggestedQuestions,
        model: result.model,
        message: "Sugestões geradas. Revê/edita e aprova em /ai/generations/:id/approve",
      });
    }

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
          status: "DRAFT",
          createdBy: req.userId,
        });
        savedQuestions.push(question);
      }

      // Regista geração
      await AiGeneration.create({
        user: req.userId,
        bank: bank._id,
        providerConfig: provider.providerConfigId,
        prompt: `Topic: ${topic || ""}\nContent: ${content || ""}`,
        params: {
          numQuestions,
          types,
          difficulty: difficulties,
          language,
        },
        questionIds: savedQuestions.map((q) => q._id),
        suggestedQuestions: result.questions,
        status: "APPLIED",
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
 * GET /ai/generations
 * Lista todas as gerações do utilizador
 */
export async function listGenerationsHandler(req, res) {
  try {
    const generations = await AiGeneration.find({ user: req.userId })
      .populate("bank", "title")
      .sort({ createdAt: -1 })
      .lean();

    res.json(generations);
  } catch (err) {
    console.error("Erro em listGenerationsHandler:", err);
    res.status(500).json({ error: "Erro ao listar gerações" });
  }
}

/**
 * GET /ai/generations/:id
 * Ver uma geração (sugestões) para revisão
 */
export async function getGenerationHandler(req, res) {
  try {
    const { id } = req.params;
    const generation = await AiGeneration.findById(id)
      .populate("bank", "title")
      .lean();

    if (!generation) {
      return res.status(404).json({ error: "Geração não encontrada" });
    }

    if (String(generation.user) !== String(req.userId)) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    res.json(generation);
  } catch (err) {
    console.error("Erro em getGenerationHandler:", err);
    res.status(500).json({ error: "Erro ao obter geração" });
  }
}

/**
 * POST /ai/generations/:id/approve
 * Aprovar/aplicar sugestões (com edições opcionais) e criar questões no banco
 */
export async function approveGenerationHandler(req, res) {
  try {
    const { id } = req.params;
    const { approvals } = req.body || {};

    const generation = await AiGeneration.findById(id);
    if (!generation) {
      return res.status(404).json({ error: "Geração não encontrada" });
    }

    if (String(generation.user) !== String(req.userId)) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    if (generation.status !== "PENDING") {
      return res.status(400).json({ error: `Geração não está pendente (status=${generation.status})` });
    }

    const bank = await QuestionBank.findById(generation.bank);
    if (!bank) {
      return res.status(404).json({ error: "Banco de questões não encontrado" });
    }
    if (String(bank.owner) !== String(req.userId)) {
      return res.status(403).json({ error: "Não tens permissão para gravar neste banco" });
    }

    const suggestions = Array.isArray(generation.suggestedQuestions)
      ? generation.suggestedQuestions
      : [];

    // Se não vier approvals, aprova tudo
    const normalizedApprovals = Array.isArray(approvals)
      ? approvals
      : suggestions.map((_, index) => ({ index, approved: true }));

    const created = [];
    const rejectedIndexes = [];

    for (const item of normalizedApprovals) {
      const index = Number(item?.index);
      if (!Number.isInteger(index) || index < 0 || index >= suggestions.length) {
        continue;
      }

      if (item?.approved === false) {
        rejectedIndexes.push(index);
        continue;
      }

      const base = suggestions[index] || {};
      const edits = item?.edits || {};
      const merged = {
        ...base,
        ...edits,
      };

      const finalLabels = Array.isArray(merged.labels) ? merged.labels : [];
      const finalChapterTags = Array.isArray(merged.chapterTags) ? merged.chapterTags : [];

      const labelIds = await upsertLabels(finalLabels, req.userId);
      const chapterTagIds = await upsertChapterTags(finalChapterTags, req.userId);

      const question = await Question.create({
        bank: bank._id,
        type: merged.type,
        stem: merged.stem,
        options: Array.isArray(merged.options) ? merged.options : [],
        acceptableAnswers: Array.isArray(merged.acceptableAnswers)
          ? merged.acceptableAnswers
          : [],
        difficulty: merged.difficulty,
        tags: finalChapterTags, // legacy
        chapterTags: chapterTagIds,
        labels: labelIds,
        source: "AI",
        status: "DRAFT",
        createdBy: req.userId,
      });

      created.push(question);
    }

    generation.questionIds = created.map((q) => q._id);
    generation.status = "APPLIED";
    await generation.save();

    res.json({
      success: true,
      generationId: generation._id,
      createdCount: created.length,
      createdQuestionIds: created.map((q) => q._id),
      rejectedIndexes,
      status: generation.status,
    });
  } catch (err) {
    console.error("Erro em approveGenerationHandler:", err);
    res.status(500).json({ error: err.message || "Erro ao aprovar geração" });
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
