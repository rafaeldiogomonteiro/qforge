/**
 * Serviço de IA para geração de questões
 * Suporta Groq API (compatível com formato OpenAI)
 */
import { Agent, fetch as undiciFetch } from "undici";

// Dispatcher dedicado para chamadas de IA com timeouts mais generosos
const AI_CONNECT_TIMEOUT_MS = Number(process.env.AI_CONNECT_TIMEOUT_MS) || 10_000;
const AI_HEADERS_TIMEOUT_MS = Number(process.env.AI_HEADERS_TIMEOUT_MS) || 30_000;
const AI_BODY_TIMEOUT_MS = Number(process.env.AI_BODY_TIMEOUT_MS) || 45_000;
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 45_000;
const AI_REQUEST_RETRIES = Number(process.env.AI_REQUEST_RETRIES ?? 0); // nº de tentativas extra
const AI_RETRY_DELAY_MS = Number(process.env.AI_RETRY_DELAY_MS) || 1_500;
const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS) || 2_048;
const OPENROUTER_FAST_MODEL = process.env.OPENROUTER_FAST_MODEL || "";
const DEFAULT_OPENROUTER_FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];
const OPENROUTER_FALLBACK_MODELS = (
  process.env.OPENROUTER_FALLBACK_MODELS ||
  DEFAULT_OPENROUTER_FALLBACK_MODELS.join(",")
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

const aiDispatcher = new Agent({
  connect: { timeout: AI_CONNECT_TIMEOUT_MS },
  headersTimeout: AI_HEADERS_TIMEOUT_MS,
  bodyTimeout: AI_BODY_TIMEOUT_MS,
});

// Fecha o dispatcher ao terminar o processo para evitar handles pendentes
process.on("exit", () => aiDispatcher.close());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function isRetriableProviderError(err) {
  const message = String(err?.message || "");
  return /(tempo limite|timeout|timed out|rate limit|429|502|503|504|overloaded|temporarily unavailable|provider returned error|upstream error|service unavailable|gateway error)/i.test(
    message
  );
}

function isModelUnavailableError(err) {
  const message = String(err?.message || "");
  return /(model|endpoint).*(not found|not available|unavailable|does not exist|decommissioned|no endpoints)/i.test(
    message
  );
}

function isCreditsError(err) {
  const message = String(err?.message || "");
  return /(insufficient credits|insufficient balance|quota|payment required|402)/i.test(
    message
  );
}

function isAccountCreditsNotActivatedError(err) {
  const message = String(err?.message || "");
  return /never purchased credits/i.test(message);
}

function isUnsupportedJsonModeError(err) {
  const message = String(err?.message || "");
  const mentionsJsonMode = /(response[_\s-]?format|json[_\s-]?object|structured output)/i.test(
    message
  );
  const mentionsUnsupported = /(unsupported|not support|invalid)/i.test(message);
  return mentionsJsonMode && mentionsUnsupported;
}

// Modelos disponíveis no Groq (gratuitos)
export const GROQ_MODELS = {
  LLAMA_3_3_70B: "llama-3.3-70b-versatile",
};

const DIFFICULTY_LABELS = {
  1: "Básico",
  2: "Normal",
  3: "Difícil",
  4: "Muito Difícil",
};

const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: "escolha múltipla (4 opções, apenas 1 correta)",
  TRUE_FALSE: "verdadeiro ou falso",
  SHORT_ANSWER: "resposta curta",
  OPEN: "resposta aberta/desenvolvimento",
};

/**
 * Faz chamada à API de chat (Groq ou OpenRouter, ambas compatíveis com formato OpenAI)
 */
async function callChatAPI(
  provider,
  model,
  messages,
  temperature = 0.7,
  maxTokens = AI_MAX_TOKENS,
  options = {}
) {
  const { forceJsonResponseFormat = true } = options;
  const baseURL =
    provider?.baseURL ||
    (provider?.name === "openrouter" ? OPENROUTER_BASE_URL : GROQ_BASE_URL);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider?.apiKey}`,
    ...(provider?.headers || {}),
  };

  if (!provider?.apiKey) {
    throw new Error("API key de IA não configurada");
  }

  const url = `${baseURL}/chat/completions`;

  const makeRequest = async (attempt) => {
    const controller = new AbortController();
    const requestTimeout = setTimeout(
      () => controller.abort(new Error("AI request timeout")),
      AI_REQUEST_TIMEOUT_MS
    );

    try {
      const response = await undiciFetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(forceJsonResponseFormat
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        dispatcher: aiDispatcher,
        headersTimeout: AI_HEADERS_TIMEOUT_MS,
        bodyTimeout: AI_BODY_TIMEOUT_MS,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.error?.message ||
            error.message ||
            `AI provider error: ${response.status}`
        );
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      const isTimeout =
        err?.name === "AbortError" ||
        err?.code === "UND_ERR_HEADERS_TIMEOUT" ||
        err?.code === "UND_ERR_BODY_TIMEOUT";

      const isNetwork =
        err?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        err?.code === "UND_ERR_SOCKET" ||
        err?.code === "UND_ERR_REQUEST_ABORTED";

      const retriable = isTimeout || isNetwork;

      if (retriable && attempt < AI_REQUEST_RETRIES) {
        await sleep(AI_RETRY_DELAY_MS);
        return makeRequest(attempt + 1);
      }

      // propaga com mensagem mais amigável
      const reason = isTimeout
        ? "Tempo limite excedido ao contactar o provedor de IA. Tenta novamente."
        : err.message || "Erro ao contactar o provedor de IA";
      throw new Error(reason);
    } finally {
      clearTimeout(requestTimeout);
    }
  };

  return makeRequest(0);
}

/**
 * Gera o prompt do sistema para geração de questões
 */
function buildSystemPrompt(language = "pt-PT") {
  const lang = language === "pt-PT" ? "português de Portugal" : language;

  return `És um especialista em criação de questões educativas para avaliação académica.
Gera questões de alta qualidade em ${lang}.

REGRAS IMPORTANTES:
1. As questões devem ser claras, precisas e sem ambiguidades
2. Para escolha múltipla: cria 4 opções com distratores plausíveis (apenas 1 correta)
3. Para verdadeiro/falso: a afirmação deve ser claramente verdadeira OU falsa
4. Adapta a complexidade ao nível de dificuldade pedido
5. Responde SEMPRE em JSON válido

FORMATO DE RESPOSTA (JSON):
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE|TRUE_FALSE|SHORT_ANSWER|OPEN",
      "stem": "Enunciado da questão",
      "difficulty": 1,
      "labels": ["Época Normal"],
      "chapterTags": ["HTML", "CSS"],
      "options": [
        { "text": "Opção A", "isCorrect": false },
        { "text": "Opção B", "isCorrect": true },
        { "text": "Opção C", "isCorrect": false },
        { "text": "Opção D", "isCorrect": false }
      ],
      "acceptableAnswers": ["resposta1", "resposta2"],
      "explanation": "Explicação da resposta correta"
    }
  ]
}

NOTAS:
- "options" só é usado em MULTIPLE_CHOICE e TRUE_FALSE
- "acceptableAnswers" só é usado em SHORT_ANSWER e OPEN
- "difficulty" deve ser um inteiro: 1=Básico, 2=Normal, 3=Difícil, 4=Muito Difícil
- "labels" deve ser array de strings descritivas como ["Época Normal", "Recurso", "Exame Final"]
- "chapterTags" deve ser array de strings com tópicos/conceitos relevantes (ex: ["HTML", "CSS", "JavaScript"])
  IMPORTANTE: Os chapterTags devem ser nomes descritivos e específicos do conteúdo/tópico da questão
  Não uses IDs ou códigos, apenas nomes legíveis como "Programação Linear", "Método Simplex", "HTML Básico", etc.
- Inclui sempre "explanation" para feedback ao aluno`;
}

/**
 * Gera o prompt do utilizador para geração de questões
 */
function buildUserPrompt(params) {
  const {
    topic,
    content,
    numQuestions = 5,
    types = ["MULTIPLE_CHOICE"],
    difficulties = [2],
    chapterTags = [],
    additionalInstructions = "",
  } = params;

  const typeDescriptions = types
    .map((t) => QUESTION_TYPE_LABELS[t] || t)
    .join(", ");

  const difficultyDescriptions = difficulties
    .map((d) => `${d} (${DIFFICULTY_LABELS[d] || d})`)
    .join(", ");

  let prompt = `Gera ${numQuestions} questão(ões) sobre o seguinte:\n\n`;

  if (topic) {
    prompt += `TÓPICO: ${topic}\n`;
  }

  if (chapterTags && chapterTags.length > 0) {
    prompt += `CAPÍTULOS/TAGS OBRIGATÓRIOS: ${chapterTags.join(", ")}\n`;
  }

  if (content) {
    prompt += `\nCONTEÚDO DE REFERÊNCIA:\n${content}\n`;
  }

  prompt += `\nREQUISITOS:
- Tipos de questão: ${typeDescriptions}
- Níveis de dificuldade: ${difficultyDescriptions}
- Distribui as questões pelos tipos e dificuldades pedidos
- Para cada questão, identifica 1-3 chapter tags (tópicos/conceitos abordados)
- Usa nomes descritivos para os chapter tags (ex: "HTML Básico", "CSS Flexbox", "JavaScript Arrays")`;

  if (chapterTags && chapterTags.length > 0) {
    prompt += `\n- Usa apenas chapter tags da lista fornecida acima; não inventes novos nomes.`;
  } else {
    prompt += `\n- Se necessário, sugere chapter tags coerentes com o conteúdo.`;
  }

  if (additionalInstructions) {
    prompt += `\n\nINSTRUÇÕES ADICIONAIS: ${additionalInstructions}`;
  }

  prompt += `\n\nResponde APENAS com o JSON, sem texto adicional.`;

  return prompt;
}

/**
 * Gera questões usando IA
 */
export async function generateQuestions(provider, params) {
  let {
    model = provider?.model || GROQ_MODELS.LLAMA_3_3_70B,
    language = "pt-PT",
    topic,
    content,
    numQuestions = 5,
    types = ["MULTIPLE_CHOICE"],
    difficulties = [2],
    chapterTags = [],
    additionalInstructions = "",
  } = params;

  if (!topic && !content) {
    throw new Error("É necessário fornecer 'topic' ou 'content'");
  }

  const messages = [
    { role: "system", content: buildSystemPrompt(language) },
    {
      role: "user",
      content: buildUserPrompt({
        topic,
        content,
        numQuestions,
        types,
        difficulties,
        chapterTags,
        additionalInstructions,
      }),
    },
  ];

  let responseText;
  const tryModel = async (candidateModel) => {
    try {
      return await callChatAPI(
        provider,
        candidateModel,
        messages,
        0.7,
        AI_MAX_TOKENS,
        { forceJsonResponseFormat: true }
      );
    } catch (err) {
      if (!isUnsupportedJsonModeError(err)) {
        throw err;
      }

      console.warn(
        `[AI] Modelo ${candidateModel} não suporta response_format=json_object. A tentar sem response_format.`
      );
      return callChatAPI(provider, candidateModel, messages, 0.7, AI_MAX_TOKENS, {
        forceJsonResponseFormat: false,
      });
    }
  };

  try {
    responseText = await tryModel(model);
  } catch (err) {
    if (
      provider?.name === "openrouter" &&
      isAccountCreditsNotActivatedError(err)
    ) {
      throw new Error(
        "Conta OpenRouter sem créditos ativados. Adiciona créditos em https://openrouter.ai/settings/credits ou configura GROQ_API_KEY no backend."
      );
    }

    const canUseModelFallback =
      provider?.name === "openrouter" &&
      (isRetriableProviderError(err) ||
        isModelUnavailableError(err) ||
        isCreditsError(err));

    if (!canUseModelFallback) {
      throw err;
    }

    const fallbackCandidates = [...new Set([
      OPENROUTER_FAST_MODEL,
      ...OPENROUTER_FALLBACK_MODELS,
      "openrouter/auto",
    ])].filter((candidate) => candidate && candidate !== model);

    if (fallbackCandidates.length === 0) {
      throw err;
    }

    let failedModel = model;
    let lastError = err;
    for (const candidate of fallbackCandidates) {
      try {
        console.warn(
          `[AI] Falha no modelo ${failedModel}. A tentar fallback para ${candidate}. Motivo: ${lastError.message}`
        );
        responseText = await tryModel(candidate);
        model = candidate;
        lastError = null;
        break;
      } catch (fallbackErr) {
        if (isAccountCreditsNotActivatedError(fallbackErr)) {
          throw new Error(
            "Conta OpenRouter sem créditos ativados. Adiciona créditos em https://openrouter.ai/settings/credits ou configura GROQ_API_KEY no backend."
          );
        }
        failedModel = candidate;
        lastError = fallbackErr;
      }
    }

    if (!responseText) {
      throw lastError || err;
    }
  }

  // Parse JSON response
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (err) {
    // Tenta extrair JSON do texto
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Resposta da IA não é JSON válido");
    }
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error("Formato de resposta inválido");
  }

  // Normaliza e valida questões
  const clampDifficulty = (value, fallback = 2) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(4, Math.max(1, Math.round(num)));
  };

  const asStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
  };

  const questions = parsed.questions.map((q, idx) => {
    const fallbackDifficulty =
      difficulties[idx % difficulties.length] || difficulties[0] || 2;
    const difficulty = clampDifficulty(q.difficulty, fallbackDifficulty);

    const providedChapterTags = asStringArray(chapterTags);
    const generatedChapterTags = asStringArray(q.chapterTags);
    // Se o utilizador forneceu chapterTags, usamos exclusivamente esses; caso contrário, ficamos com os gerados (se houver)
    const finalChapterTags =
      providedChapterTags.length > 0 ? providedChapterTags : generatedChapterTags;

    return {
      type: q.type || types[idx % types.length] || "MULTIPLE_CHOICE",
      stem: q.stem || q.question || "",
      options: Array.isArray(q.options) ? q.options : [],
      acceptableAnswers: Array.isArray(q.acceptableAnswers)
        ? q.acceptableAnswers
        : [],
      difficulty,
      labels: asStringArray(q.labels),
      chapterTags: finalChapterTags,
      explanation: q.explanation || "",
      source: "AI",
    };
  });

  return {
    questions,
    rawResponse: parsed,
    model,
  };
}
