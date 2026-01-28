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

/**
 * Obtém a API key do Groq (sempre do servidor)
 */
async function getGroqProvider() {
  const apiKey = process.env.GROQ_API_KEY;
  return {
    apiKey: apiKey || null,
    model: GROQ_MODELS.LLAMA_3_3_70B,
  };
}

/**
 * Helper simples para obter só a apiKey (usado em improve/distractors)
 */
async function getGroqApiKey() {
  const provider = await getGroqProvider();
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
    } = req.body;

    // Validação básica
    if (!topic && !content) {
      return res
        .status(400)
        .json({ error: "É necessário fornecer 'topic' ou 'content'" });
    }

    const provider = await getGroqProvider();
    if (!provider.apiKey) {
      return res.status(500).json({
        error: "API key do Groq não configurada no servidor. Contacta o administrador.",
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

    const apiKey = await getGroqApiKey();
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

    const apiKey = await getGroqApiKey();
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
