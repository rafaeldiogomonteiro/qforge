import {
  generateQuestions,
  GROQ_MODELS,
} from "../services/aiService.js";
import zlib from "zlib";
import { OpenAIEmbeddings } from "@langchain/openai";
import PdfSource from "../models/PdfSource.js";
import Question from "../models/Question.js";
import QuestionBank from "../models/QuestionBank.js";
import ChapterTag from "../models/ChapterTag.js";
import Label from "../models/Label.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ||
  process.env.OPENROUTER_FAST_MODEL ||
  "openrouter/auto";

function getAiProviderForEmbeddingsAndLLM() {
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

function gunzipToString(buffer) {
  if (!buffer) return "";
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return zlib.gunzipSync(buf).toString("utf8");
}

function clampArrayStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => String(v).trim()).filter(Boolean);
}

function chunkText(text, chunkSize = 900, chunkOverlap = 140) {
  const s = String(text || "");
  if (!s.trim()) return [];

  const chunks = [];
  let start = 0;

  while (start < s.length) {
    const end = Math.min(start + chunkSize, s.length);
    const chunk = s.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= s.length) break;
    start = end - chunkOverlap;
    if (start < 0) start = 0;
    if (chunkSize <= chunkOverlap) break; // avoid infinite loops
  }

  return chunks;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]);
    const y = Number(b[i]);
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) return -1;
  return dot / denom;
}

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

/**
 * POST /ai/pdf-chat/generate
 * Gera questões a partir de PDFs extraídos via RAG (LangChain) + IA.
 */
export async function generatePdfChatHandler(req, res) {
  try {
    const {
      documentIds,
      chatMessage,
      // opcional: conversa anterior inteira (para refinar o contexto)
      chatHistory = [],
      numQuestions = 5,
      types = ["MULTIPLE_CHOICE"],
      difficulties = [2],
      saveToBank = false,
      bankId,
      additionalInstructions = "",
      topK = 6,
      language = "pt-PT",
    } = req.body || {};

    const userId = String(req.userId);
    const provider = getAiProviderForEmbeddingsAndLLM();
    if (!provider?.apiKey) {
      return res.status(500).json({
        error:
          "Nenhum provedor de IA configurado (GROQ_API_KEY ou OPENROUTER_API_KEY).",
      });
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: "documentIds é obrigatório" });
    }

    const message = String(chatMessage ?? "").trim();
    if (!message) {
      return res.status(400).json({ error: "chatMessage é obrigatório" });
    }

    // 1) buscar textos extraídos
    const pdfDocs = await PdfSource.find({
      userId,
      _id: { $in: documentIds },
      isActive: true,
    }).lean();

    if (!pdfDocs || pdfDocs.length === 0) {
      return res.status(404).json({ error: "Nenhum documento PDF encontrado" });
    }

    // 2) chunking (manual, para evitar dependências de splitters/vectorstores)
    const docs = [];
    for (const d of pdfDocs) {
      const extractedText = gunzipToString(d.extractedTextGz);
      if (!extractedText.trim()) continue;

      const chunks = chunkText(extractedText, 900, 140);
      for (const chunk of chunks) {
        docs.push({ pageContent: chunk, filename: d.filename });
      }
    }

    if (docs.length === 0) {
      return res.status(400).json({
        error: "O PDF não contém texto extraível (ou ficou vazio após extração).",
      });
    }

    // 3) embeddings (em memória) + retrieval via cosine similarity
    const embeddings = new OpenAIEmbeddings({
      apiKey: provider.apiKey,
      // OpenAIEmbeddings usa "baseURL" como endpoint compatível.
      baseURL: provider.baseURL,
    });

    const queryEmbedding = await embeddings.embedQuery(message);
    const docEmbeddings = await embeddings.embedDocuments(
      docs.map((d) => d.pageContent)
    );

    const scored = docs
      .map((d, i) => ({
        idx: i,
        score: cosineSimilarity(queryEmbedding, docEmbeddings[i]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(topK) || 6);

    const context = scored
      .map((s, i) => {
        const doc = docs[s.idx];
        const fn = doc?.filename ? String(doc.filename) : `doc-${i + 1}`;
        return `--- Contexto ${i + 1} (de ${fn}) ---\n${doc.pageContent}`;
      })
      .join("\n\n");

    // 5) montar instruções adicionais (iterativo)
    const historyBlock = Array.isArray(chatHistory) && chatHistory.length
      ? chatHistory
          .slice(-8)
          .map((m) => `${m.role || "user"}: ${m.content || ""}`)
          .join("\n")
      : "";

    const additional =
      `${additionalInstructions ? `${additionalInstructions}\n\n` : ""}` +
      `${historyBlock ? `Histórico:\n${historyBlock}\n\n` : ""}` +
      `Pedido atual:\n${message}\n`;

    const result = await generateQuestions(provider, {
      model: provider.model,
      language,
      // Reutiliza o teu pipeline: "content" = contexto recuperado
      topic: undefined,
      content: context,
      numQuestions,
      types,
      difficulties,
      labels: [],
      chapterTags: [],
      additionalInstructions: additional,
    });

    let savedQuestions = [];
    let bank = null;

    if (saveToBank && bankId) {
      bank = await QuestionBank.findById(bankId);
      if (!bank) return res.status(404).json({ error: "Banco não encontrado" });

      const isOwner = String(bank.owner) === userId;
      if (!isOwner) {
        return res.status(403).json({
          error: "Não tens permissão para adicionar questões a este banco",
        });
      }
    }

    if (saveToBank && bank && Array.isArray(result.questions)) {
      for (const q of result.questions) {
        const finalChapterTags = clampArrayStrings(q.chapterTags || []);
        const finalLabels = clampArrayStrings(q.labels || []);

        const chapterTagIds = await upsertChapterTags(finalChapterTags, userId);
        const labelIds = await upsertLabels(finalLabels, userId);

        const question = await Question.create({
          bank: bank._id,
          type: q.type,
          stem: q.stem,
          options: q.options,
          acceptableAnswers: q.acceptableAnswers,
          difficulty: q.difficulty,
          tags: finalChapterTags,
          chapterTags: chapterTagIds,
          labels: labelIds,
          source: "AI",
          createdBy: req.userId,
        });
        savedQuestions.push(question);
      }
    }

    return res.json({
      success: true,
      questions: result.questions,
      savedQuestions: savedQuestions.length ? savedQuestions : undefined,
      model: result.model,
    });
  } catch (err) {
    console.error("Erro em generatePdfChatHandler:", err);
    return res.status(500).json({
      error: err?.message || "Erro ao gerar questões a partir de PDFs",
    });
  }
}

/**
 * POST /ai/pdf-chat/improve
 * Recebe questões existentes (JSON) e um pedido de melhoria e devolve questões melhoradas.
 */
export async function improvePdfChatHandler(req, res) {
  try {
    const {
      documentIds,
      existingQuestions = [],
      chatMessage,
      numQuestions,
      types = ["MULTIPLE_CHOICE"],
      difficulties = [2],
      language = "pt-PT",
      topK = 6,
    } = req.body || {};

    const userId = String(req.userId);
    const provider = getAiProviderForEmbeddingsAndLLM();
    if (!provider?.apiKey) {
      return res.status(500).json({
        error:
          "Nenhum provedor de IA configurado (GROQ_API_KEY ou OPENROUTER_API_KEY).",
      });
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: "documentIds é obrigatório" });
    }

    const msg = String(chatMessage ?? "").trim();
    if (!msg) return res.status(400).json({ error: "chatMessage é obrigatório" });

    if (!Array.isArray(existingQuestions) || existingQuestions.length === 0) {
      return res.status(400).json({ error: "existingQuestions é obrigatório" });
    }

    const targetNum = Number(numQuestions ?? existingQuestions.length);

    const pdfDocs = await PdfSource.find({
      userId,
      _id: { $in: documentIds },
      isActive: true,
    }).lean();

    if (!pdfDocs || pdfDocs.length === 0) {
      return res.status(404).json({ error: "Nenhum documento PDF encontrado" });
    }

    // chunking
    const docs = [];
    for (const d of pdfDocs) {
      const extractedText = gunzipToString(d.extractedTextGz);
      if (!extractedText.trim()) continue;

      const chunks = chunkText(extractedText, 900, 140);
      for (const chunk of chunks) docs.push({ pageContent: chunk, filename: d.filename });
    }

    if (docs.length === 0) {
      return res.status(400).json({
        error: "O PDF não contém texto extraível (ou ficou vazio após extração).",
      });
    }

    // embeddings
    const embeddings = new OpenAIEmbeddings({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
    });

    const queryEmbedding = await embeddings.embedQuery(msg);
    const docEmbeddings = await embeddings.embedDocuments(docs.map((d) => d.pageContent));

    const scored = docs
      .map((d, i) => ({
        idx: i,
        score: cosineSimilarity(queryEmbedding, docEmbeddings[i]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(topK) || 6);

    const context = scored
      .map((s, i) => {
        const doc = docs[s.idx];
        const fn = doc?.filename ? String(doc.filename) : `doc-${i + 1}`;
        return `--- Contexto ${i + 1} (de ${fn}) ---\n${doc.pageContent}`;
      })
      .join("\n\n");

    const existingJson = JSON.stringify(existingQuestions, null, 2);

    // Reutiliza o generateQuestions para respeitar o schema JSON do teu aiService.
    const result = await generateQuestions(provider, {
      model: provider.model,
      language,
      topic: "Revisão de questões",
      content: `${context}\n\n--- QUESTÕES ATUAIS (JSON) ---\n${existingJson}`,
      numQuestions: targetNum,
      types,
      difficulties,
      labels: [],
      chapterTags: [],
      additionalInstructions:
        `${msg}\n\n` +
        `Tarefa: melhora as questões fornecidas acima (mantém o mesmo número e schema JSON).\n` +
        `Regras:\n` +
        `- Obedece aos tipos e dificuldades pedidos.\n` +
        `- Usa apenas informação que está no contexto dos PDFs.\n` +
        `- Mantém consistência entre opções/respostas/explicações.\n` +
        `- Devolve SEMPRE apenas JSON válido no formato do aiService.`,
    });

    return res.json({ success: true, questions: result.questions, model: result.model });
  } catch (err) {
    console.error("Erro em improvePdfChatHandler:", err);
    return res.status(500).json({
      error: err?.message || "Erro ao melhorar questões a partir de PDFs",
    });
  }
}

