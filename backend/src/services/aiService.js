/**
 * Serviço de IA para geração de questões
 * Suporta Groq API (compatível com formato OpenAI)
 */

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Modelos disponíveis no Groq (gratuitos)
export const GROQ_MODELS = {
  LLAMA_3_3_70B: "llama-3.3-70b-versatile",
  LLAMA_3_1_8B: "llama-3.1-8b-instant",
  MIXTRAL_8X7B: "mixtral-8x7b-32768",
  GEMMA_2_9B: "gemma2-9b-it",
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
 * Faz chamada à API Groq
 */
async function callGroqAPI(apiKey, model, messages, temperature = 0.7) {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `Groq API error: ${response.status}`
    );
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
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
    prompt += `CAPÍTULOS/TAGS SUGERIDOS: ${chapterTags.join(", ")} (usa estes como referência mas podes adicionar outros relevantes)\n`;
  }

  if (content) {
    prompt += `\nCONTEÚDO DE REFERÊNCIA:\n${content}\n`;
  }

  prompt += `\nREQUISITOS:
- Tipos de questão: ${typeDescriptions}
- Níveis de dificuldade: ${difficultyDescriptions}
- Distribui as questões pelos tipos e dificuldades pedidos
- Para cada questão, identifica 1-3 chapter tags relevantes (tópicos/conceitos abordados)
- Usa nomes descritivos para os chapter tags (ex: "HTML Básico", "CSS Flexbox", "JavaScript Arrays")`;

  if (additionalInstructions) {
    prompt += `\n\nINSTRUÇÕES ADICIONAIS: ${additionalInstructions}`;
  }

  prompt += `\n\nResponde APENAS com o JSON, sem texto adicional.`;

  return prompt;
}

/**
 * Gera questões usando IA
 */
export async function generateQuestions(apiKey, params) {
  const {
    model = GROQ_MODELS.LLAMA_3_3_70B,
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

  const responseText = await callGroqAPI(apiKey, model, messages);

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

    return {
      type: q.type || types[idx % types.length] || "MULTIPLE_CHOICE",
      stem: q.stem || q.question || "",
      options: Array.isArray(q.options) ? q.options : [],
      acceptableAnswers: Array.isArray(q.acceptableAnswers)
        ? q.acceptableAnswers
        : [],
      difficulty,
      labels: asStringArray(q.labels),
      chapterTags: asStringArray(q.chapterTags),
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

/**
 * Melhora uma questão existente
 */
export async function improveQuestion(apiKey, question, instructions = "") {
  const model = GROQ_MODELS.LLAMA_3_3_70B;

  const systemPrompt = `És um especialista em melhorar questões educativas.
Recebe uma questão e melhora-a seguindo as instruções.
Mantém o mesmo tipo e formato. Responde em JSON.

FORMATO DE RESPOSTA:
{
  "improved": {
    "type": "...",
    "stem": "...",
    "options": [...],
    "acceptableAnswers": [...],
    "explanation": "..."
  },
  "changes": ["lista de alterações feitas"]
}`;

  const userPrompt = `QUESTÃO ORIGINAL:
${JSON.stringify(question, null, 2)}

INSTRUÇÕES: ${instructions || "Melhora a clareza, os distratores e a explicação."}

Responde APENAS com JSON.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const responseText = await callGroqAPI(apiKey, model, messages);

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Resposta da IA não é JSON válido");
    }
  }

  return parsed;
}

/**
 * Gera distratores para uma questão de escolha múltipla
 */
export async function generateDistractors(
  apiKey,
  stem,
  correctAnswer,
  numDistractors = 3
) {
  const model = GROQ_MODELS.LLAMA_3_1_8B; // Modelo mais rápido para tarefa simples

  const systemPrompt = `Gera distratores (opções erradas mas plausíveis) para questões de escolha múltipla.
Os distratores devem parecer credíveis mas estar claramente errados.
Responde em JSON: { "distractors": ["opção1", "opção2", ...] }`;

  const userPrompt = `ENUNCIADO: ${stem}
RESPOSTA CORRETA: ${correctAnswer}

Gera ${numDistractors} distratores plausíveis. Responde APENAS com JSON.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const responseText = await callGroqAPI(apiKey, model, messages, 0.8);

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Resposta da IA não é JSON válido");
    }
  }

  return parsed.distractors || [];
}
