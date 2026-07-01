import { TestarFuncaoMoodleAsync } from "../services/MoodleService.js";
import AuditLog from "../models/AuditLog.js";
import MoodleConnection from "../models/MoodleConnection.js";
import { importBank } from "./QuestionBankController.js";

/**
 * POST /moodle/test-function
 * Executa um teste simples a uma funcao REST do Moodle.
 */
export async function testMoodleFunctionHandler(req, res) {
  const { moodleBaseUrl, moodleUrl, token, functionName, extraParams } =
    req.body || {};

  try {
    // Se o frontend não enviar baseUrl/token, usamos o que está guardado no backend.
    let baseUrl = moodleBaseUrl;
    let resolvedToken = token;

    if ((!baseUrl || !resolvedToken) && (!moodleUrl || !token)) {
      const connection = await MoodleConnection.findOne({ userId: req.userId }).lean();
      if (connection) {
        baseUrl = connection.moodleBaseUrl;
        resolvedToken = connection.moodleToken;
      }
    }

    // Compatibilidade: se o cliente ainda enviar `moodleUrl` como endpoint completo,
    // convertemos para baseUrl.
    if (!baseUrl && moodleUrl && typeof moodleUrl === "string") {
      baseUrl = moodleUrl.replace(/\/webservice\/rest\/server\.php\/?$/i, "");
    }

    if (!baseUrl || !resolvedToken) {
      return res.status(400).json({
        success: false,
        error: "Moodle nao esta configurado para este utilizador",
      });
    }

    const json = await TestarFuncaoMoodleAsync(
      baseUrl,
      resolvedToken,
      functionName,
      extraParams
    );

    return res.json({ success: true, json });
  } catch (err) {
    const message = err.message || "Erro ao testar funcao Moodle";
    const status = /vazio|invalido/i.test(message) ? 400 : 502;

    return res.status(status).json({
      success: false,
      error: message,
    });
  }
}

/**
 * POST /moodle/import-question-bank
 * Importa um conjunto de perguntas (Moodle XML) para uma categoria no Moodle via plugin custom.
 */
export async function importQuestionBankToMoodleHandler(req, res) {
  const {
    moodleBaseUrl,
    moodleUrl,
    token,
    courseId,
    categoryName,
    moodleXml,
  } = req.body || {};

  try {
    let baseUrl = moodleBaseUrl;
    let resolvedToken = token;

    if ((!baseUrl || !resolvedToken) && (!moodleUrl || !token)) {
      const connection = await MoodleConnection.findOne({ userId: req.userId }).lean();
      if (connection) {
        baseUrl = connection.moodleBaseUrl;
        resolvedToken = connection.moodleToken;
      }
    }

    if (!baseUrl && moodleUrl && typeof moodleUrl === "string") {
      baseUrl = moodleUrl.replace(/\/webservice\/rest\/server\.php\/?$/i, "");
    }

    if (!baseUrl || !resolvedToken) {
      return res.status(400).json({
        success: false,
        error: "Moodle nao esta configurado para este utilizador",
      });
    }

    const extraParams = {
      courseid: Number(courseId),
      categoryname: String(categoryName || ""),
      moodlexml: String(moodleXml || ""),
    };

    const json = await TestarFuncaoMoodleAsync(
      baseUrl,
      resolvedToken,
      "local_qforge_moodle_app_import_questions",
      extraParams
    );

    // Auditoria: exportação do QForge para o Moodle (import via plugin)
    try {
      await AuditLog.create({
        userId: req.userId,
        action: "Exportação",
        targetType: "Moodle",
        targetName: String(categoryName || "").slice(0, 140) || "Moodle",
        result: "Sucesso",
        ipAddress: req.ip,
        details: {
          courseId: Number(courseId),
          categoryName,
        },
      });
    } catch (e) {
      console.warn("Falha ao criar AuditLog (Exportação Moodle):", e?.message || e);
    }

    return res.json({ success: true, json });
  } catch (err) {
    // Auditoria: falha de exportação/import para Moodle
    try {
      const message = err?.message || "Erro ao importar para Moodle";
      await AuditLog.create({
        userId: req.userId,
        action: "Exportação",
        targetType: "Moodle",
        targetName: String(categoryName || "").slice(0, 140) || "Moodle",
        result: "Falha",
        errorMessage: message,
        ipAddress: req.ip,
        details: {
          courseId: Number(courseId),
          categoryName,
        },
      });
    } catch (e) {
      console.warn("Falha ao criar AuditLog (Exportação Moodle - Falha):", e?.message || e);
    }

    const message = err.message || "Erro ao importar para Moodle";
    const status = /vazio|invalido/i.test(message) ? 400 : 502;

    return res.status(status).json({ success: false, error: message });
  }
}

/**
 * GET /moodle/connection
 * Devolve apenas informação de setup (baseUrl + se existe token guardado).
 * O token fica no backend.
 */
export async function getMoodleConnectionHandler(req, res) {
  try {
    const connection = await MoodleConnection.findOne({ userId: req.userId })
      .lean();

    if (!connection) {
      return res.json({ exists: false });
    }

    return res.json({
      exists: true,
      moodleBaseUrl: connection.moodleBaseUrl,
    });
  } catch (err) {
    console.error("Erro em getMoodleConnectionHandler:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
}

/**
 * PUT /moodle/connection
 * Guarda baseUrl + token do Moodle (para a conta atual da app).
 */
export async function upsertMoodleConnectionHandler(req, res) {
  try {
    const { moodleBaseUrl, token } = req.body || {};
    const base = String(moodleBaseUrl ?? "").trim();
    const t = String(token ?? "").trim();

    if (!base || !t) {
      return res.status(400).json({ error: "moodleBaseUrl e token são obrigatórios" });
    }

    const doc = await MoodleConnection.findOneAndUpdate(
      { userId: req.userId },
      { moodleBaseUrl: base, moodleToken: t },
      { upsert: true, new: true }
    );

    return res.json({ success: true, moodleBaseUrl: doc.moodleBaseUrl });
  } catch (err) {
    console.error("Erro em upsertMoodleConnectionHandler:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
}

/**
 * GET /moodle/courses
 * Lista cursos acessíveis ao utilizador do token Moodle guardado.
 */
export async function listMoodleCoursesHandler(req, res) {
  try {
    const connection = await MoodleConnection.findOne({ userId: req.userId }).lean();
    if (!connection) {
      return res.status(400).json({ error: "Moodle connection não configurada" });
    }

    const baseUrl = connection.moodleBaseUrl;
    const token = connection.moodleToken;

    // 1) obtem userid do token
    const siteInfo = await TestarFuncaoMoodleAsync(
      baseUrl,
      token,
      "core_webservice_get_site_info"
    );
    const moodleUserId = siteInfo?.userid;

    if (!moodleUserId) {
      return res.status(502).json({ error: "Não consegui obter userid do Moodle" });
    }

    // 2) cursos do utilizador (tenta algumas variações de params/shape)
    const candidateCalls = [
      { userid: String(moodleUserId) },
      { userid: Number(moodleUserId) },
      { userids: [String(moodleUserId)] },
    ];

    let coursesRes = null;
    for (const extraParams of candidateCalls) {
      try {
        coursesRes = await TestarFuncaoMoodleAsync(
          baseUrl,
          token,
          "core_enrol_get_users_courses",
          extraParams
        );
        // Sair mais cedo se já tiver a lista.
        const maybeCourses = coursesRes?.courses || coursesRes?.usercourses || coursesRes?.enrolledcourses;
        if (Array.isArray(maybeCourses) && maybeCourses.length) break;
      } catch {
        // tenta o próximo
      }
    }

    let rawCourses = [];
    if (Array.isArray(coursesRes)) {
      rawCourses = coursesRes;
    } else if (coursesRes && typeof coursesRes === "object") {
      rawCourses =
        coursesRes?.courses ||
        coursesRes?.usercourses ||
        coursesRes?.enrolledcourses ||
        [];

      // Algumas versões/outputs devolvem a lista "diretamente"
      // com keys numéricas (ex.: { "0": {...}, "1": {...} }).
      if (!Array.isArray(rawCourses) || rawCourses.length === 0) {
        const values = Object.values(coursesRes);
        if (Array.isArray(values) && values.length > 0) {
          rawCourses = values;
        }
      }
    }

    const mapped = Array.isArray(rawCourses)
      ? rawCourses.map((c) => {
          // Moodle pode devolver o id no "nível" ou aninhado em "course".
          const nested = c?.course && typeof c.course === "object" ? c.course : {};

          const idCandidates = [
            c?.courseid,
            c?.course_id,
            nested?.id,
            nested?.courseid,
            nested?.course_id,
            c?.id,
            nested?.id,
          ];

          const id = Number(
            idCandidates.find((v) => v !== undefined && v !== null) ?? 0
          );

          const fullname =
            c?.fullname ||
            c?.name ||
            nested?.fullname ||
            nested?.fullname ||
            nested?.name ||
            c?.coursefullname ||
            nested?.coursefullname ||
            c?.shortname ||
            nested?.shortname ||
            c?.code ||
            nested?.code ||
            (id > 0 ? String(id) : "");

          const shortname = c?.shortname || c?.code || nested?.shortname || nested?.code || "";

          return {
            id: Number.isFinite(id) && id > 0 ? id : null,
            fullname: String(fullname || "").trim(),
            shortname: String(shortname || "").trim(),
          };
        })
      : [];

    const finalCourses = mapped.filter((c) => c.id);

    return res.json({
      courses: finalCourses,
      debug:
        finalCourses.length === 0
          ? {
              moodleUserId,
              // mostra o que o Moodle devolveu (pelo menos as chaves) para identificar variações
              responseType: coursesRes ? typeof coursesRes : null,
              receivedKeys: coursesRes ? Object.keys(coursesRes) : [],
              // se for array mas vazio, isto ajuda a perceber se o user não tem enrolments
              rawCoursesIsArray: Array.isArray(rawCourses),
              rawCoursesLength: Array.isArray(rawCourses)
                ? rawCourses.length
                : null,
              rawCoursesSample:
                Array.isArray(rawCourses) && rawCourses.length > 0
                  ? rawCourses[0]
                  : null,
              coursesResSample:
                coursesRes && typeof coursesRes === "object"
                  ? (Array.isArray(coursesRes) ? coursesRes[0] : Object.values(coursesRes)[0])
                  : null,
            }
          : undefined,
    });
  } catch (err) {
    console.error("Erro em listMoodleCoursesHandler:", err);
    return res.status(500).json({ error: err?.message || "Erro no servidor" });
  }
}

function shouldIncludeMoodleDebug(req) {
  return String(req.query?.debug || "").toLowerCase() === "true";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizePayloadShape(payload) {
  if (Array.isArray(payload)) {
    return {
      type: "array",
      length: payload.length,
      firstItemKeys: isObject(payload[0]) ? Object.keys(payload[0]) : [],
    };
  }

  if (isObject(payload)) {
    return {
      type: "object",
      keys: Object.keys(payload),
    };
  }

  return {
    type: payload === null ? "null" : typeof payload,
  };
}

function getNestedObject(value, key) {
  const nested = value?.[key];
  return isObject(nested) ? nested : {};
}

function normalizeMoodleQuestionCategory(category) {
  const nestedCategory = getNestedObject(category, "category");
  const nestedQuestionCategory = getNestedObject(category, "questioncategory");

  const idCandidates = [
    category?.questioncategoryid,
    category?.questioncategory_id,
    category?.questioncategory,
    nestedQuestionCategory?.id,
    nestedQuestionCategory?.categoryid,
    nestedQuestionCategory?.questioncategoryid,
    category?.categoryid,
    category?.category_id,
    nestedCategory?.id,
    nestedCategory?.categoryid,
    nestedCategory?.questioncategoryid,
    category?.id,
    category?.value,
    category?.key,
  ];
  const id = Number(
    idCandidates.find((value) => value !== undefined && value !== null) ?? 0
  );

  const name =
    category?.name ||
    category?.fullname ||
    category?.displayname ||
    category?.categoryname ||
    category?.categoryName ||
    category?.label ||
    category?.text ||
    category?.title ||
    nestedQuestionCategory?.name ||
    nestedQuestionCategory?.fullname ||
    nestedQuestionCategory?.categoryname ||
    nestedCategory?.name ||
    nestedCategory?.fullname ||
    nestedCategory?.categoryname ||
    "";

  const validId = Number.isFinite(id) && id > 0 ? id : null;

  return {
    id: validId,
    name: String(name || (validId ? `Categoria ${validId}` : "")).trim(),
    hadName: Boolean(String(name || "").trim()),
  };
}

function extractCategoriesFromMoodleResponse(payload) {
  const knownContainers = [
    "categories",
    "questioncategories",
    "question_categories",
    "questionbankcategories",
    "question_bank_categories",
    "questionBankCategories",
    "categorylist",
    "category_list",
    "data",
    "payload",
    "result",
    "results",
    "items",
    "records",
    "values",
    "list",
  ];

  const seen = new Set();
  const candidates = [];

  function scoreCategoryCandidate(items, path, fromKnownContainer) {
    const normalized = items.map((item) => normalizeMoodleQuestionCategory(item));
    const validIdCount = normalized.filter((item) => item.id).length;
    const namedCount = normalized.filter((item) => item.id && item.hadName).length;
    const objectCount = items.filter((item) => isObject(item)).length;
    const categoryPath = /categor/i.test(path);

    return (
      validIdCount * 20 +
      namedCount * 5 +
      objectCount +
      (categoryPath ? 30 : 0) +
      (fromKnownContainer ? 15 : 0) +
      (items.length > 0 ? 2 : 0)
    );
  }

  function addCandidate(items, path, fromKnownContainer) {
    if (/(\.|^)(warnings?|messages?|errors?)$/i.test(path)) return;

    candidates.push({
      categoriesRaw: items,
      sourcePath: path,
      score: scoreCategoryCandidate(items, path, fromKnownContainer),
    });
  }

  function collectFrom(value, path, fromKnownContainer = false) {
    if (value === null || value === undefined) return;
    if (seen.has(value)) return;
    if (typeof value === "object") seen.add(value);

    if (Array.isArray(value)) {
      addCandidate(value, path, fromKnownContainer);
      return;
    }

    if (!isObject(value)) return;

    const numericKeys = Object.keys(value).filter((key) => /^\d+$/.test(key));
    if (numericKeys.length > 0) {
      addCandidate(
        numericKeys
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => value[key]),
        path,
        fromKnownContainer
      );
    }

    for (const key of knownContainers) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectFrom(value[key], `${path}.${key}`, true);
      }
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (knownContainers.includes(key)) continue;
      if (!isObject(nestedValue) && !Array.isArray(nestedValue)) continue;
      collectFrom(nestedValue, `${path}.${key}`, /categor/i.test(key));
    }
  }

  collectFrom(payload, "root");

  const viableCandidates = candidates.filter((candidate) => {
    return (
      candidate.score > 0 ||
      /categor/i.test(candidate.sourcePath) ||
      candidate.categoriesRaw.length > 0
    );
  });

  viableCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.categoriesRaw.length - a.categoriesRaw.length;
  });

  const found = viableCandidates[0];
  return found
    ? { categoriesRaw: found.categoriesRaw, sourcePath: found.sourcePath }
    : { categoriesRaw: [], sourcePath: null };
}

function extractMoodleDiagnosticMessage(payload) {
  if (!payload) return null;

  const direct =
    payload?.message ||
    payload?.error ||
    payload?.warning ||
    payload?.exception ||
    payload?.debuginfo;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const warning = Array.isArray(payload?.warnings) ? payload.warnings[0] : null;
  const warningMessage = warning?.message || warning?.warning || warning?.item;
  if (typeof warningMessage === "string" && warningMessage.trim()) {
    return warningMessage.trim();
  }

  if (!isObject(payload) && !Array.isArray(payload)) return null;

  const values = Array.isArray(payload) ? payload : Object.values(payload);
  for (const value of values) {
    if (!isObject(value) && !Array.isArray(value)) continue;
    const nested = extractMoodleDiagnosticMessage(value);
    if (nested) return nested;
  }

  return null;
}

function buildQuestionCategoriesDebug({
  courseId,
  json,
  categoriesRaw,
  categories,
  sourcePath,
  missingNameCount,
  includeRaw,
}) {
  const debug = {
    wsfunction: "local_qforge_moodle_app_get_question_categories",
    requestedCourseId: courseId,
    responseShape: summarizePayloadShape(json),
    categoriesSourcePath: sourcePath,
    rawCategoryCount: categoriesRaw.length,
    mappedCategoryCount: categories.length,
    missingNameCount,
    requestParamsSent: { courseid: courseId },
    moodleStatus: json?.status ?? json?.success ?? null,
    moodleMessage: extractMoodleDiagnosticMessage(json),
  };

  if (categoriesRaw.length === 0) {
    if (
      debug.moodleStatus === false ||
      /capabil|permission|permiss|acesso|access|allowed|autoriz/i.test(
        debug.moodleMessage || ""
      )
    ) {
      debug.possibleCause =
        "O plugin Moodle respondeu sem categorias e parece haver bloqueio de permissao/capability no Moodle.";
    } else if (debug.moodleMessage) {
      debug.possibleCause =
        "O plugin Moodle respondeu sem categorias; verifica a mensagem devolvida pelo plugin.";
    } else {
      debug.possibleCause =
        "O Moodle devolveu uma resposta sem categorias visiveis para este curso, ou o plugin nao devolveu o array no formato esperado.";
    }
  } else if (categories.length === 0) {
    debug.possibleCause =
      "Foram recebidos itens, mas nenhum tinha id valido para mapear para { id, name }. Verifica o formato do plugin.";
    debug.rawCategorySample = categoriesRaw[0] || null;
  }

  if (includeRaw) {
    debug.rawMoodleResponse = json;
    debug.rawCategorySample = categoriesRaw[0] || null;
  }

  return debug;
}

function extractMoodleXmlFromExportResponse(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;

  return (
    payload?.moodlexml ||
    payload?.moodleXml ||
    payload?.moodle_xml ||
    payload?.xml ||
    payload?.content ||
    payload?.moodleXmlContent ||
    payload?.questionsxml ||
    ""
  );
}

function extractTitleFromExportResponse(payload) {
  return (
    payload?.title ||
    payload?.categoryname ||
    payload?.categoryName ||
    payload?.name ||
    payload?.category?.name ||
    "Banco Moodle"
  );
}

/**
 * GET /moodle/question-categories?courseId=#
 * Lista categorias do question bank (Question bank category) acessíveis via plugin custom.
 */
export async function listMoodleQuestionCategoriesHandler(req, res) {
  try {
    const connection = await MoodleConnection.findOne({ userId: req.userId })
      .lean();
    if (!connection) {
      return res.status(400).json({ error: "Moodle connection não configurada" });
    }

    const courseIdRaw =
      req.query?.courseId ?? req.query?.courseid ?? req.query?.course_id;
    const courseIdNum = Number(courseIdRaw);
    if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) {
      return res.status(400).json({ error: "courseId inválido" });
    }

    const includeDebug = shouldIncludeMoodleDebug(req);
    const json = await TestarFuncaoMoodleAsync(
      connection.moodleBaseUrl,
      connection.moodleToken,
      "local_qforge_moodle_app_get_question_categories",
      { courseid: courseIdNum }
    );

    const { categoriesRaw, sourcePath } = extractCategoriesFromMoodleResponse(json);
    const normalizedCategories = categoriesRaw.map((category) =>
      normalizeMoodleQuestionCategory(category)
    );
    const categories = normalizedCategories
      .filter((category) => category.id)
      .map(({ id, name }) => ({ id, name }));
    const missingNameCount = normalizedCategories.filter(
      (category) => category.id && !category.hadName
    ).length;

    const response = { categories };
    if (includeDebug || categories.length === 0) {
      response.debug = buildQuestionCategoriesDebug({
        courseId: courseIdNum,
        json,
        categoriesRaw,
        categories,
        sourcePath,
        missingNameCount,
        includeRaw: includeDebug,
      });
    }

    if (categories.length === 0) {
      console.warn("[MoodleWS] question categories empty", {
        courseId: courseIdNum,
        sourcePath,
        rawCategoryCount: categoriesRaw.length,
        moodleStatus: response.debug.moodleStatus,
        moodleMessage: response.debug.moodleMessage,
      });
    }

    return res.json(response);
  } catch (err) {
    console.error("Erro em listMoodleQuestionCategoriesHandler:", err);
    const message = err?.message || "Erro no servidor";
    const status = /^Erro Moodle|Falha de ligacao ao Moodle|Resposta HTTP/i.test(message)
      ? 502
      : 500;

    return res.status(status).json({
      error: message,
      debug: shouldIncludeMoodleDebug(req)
        ? {
            wsfunction: "local_qforge_moodle_app_get_question_categories",
            requestedCourseId: Number(
              req.query?.courseId ?? req.query?.courseid ?? req.query?.course_id
            ),
            possibleCause:
              "Falha ao chamar o Web Service do Moodle. Confirma se a funcao esta publicada no servico, se o token tem permissao e se o plugin esta instalado.",
          }
        : undefined,
    });
  }
}

/**
 * POST /moodle/import-question-bank-from-category
 * Exporta questões Moodle de uma category e importa na app como QuestionBank (format=moodle).
 */
export async function importQuestionBankFromCategoryHandler(req, res) {
  try {
    const connection = await MoodleConnection.findOne({ userId: req.userId })
      .lean();
    if (!connection) {
      return res.status(400).json({ error: "Moodle connection não configurada" });
    }

    const { courseId, categoryId } = req.body || {};

    const categoryIdNum = Number(categoryId);
    if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) {
      return res.status(400).json({ error: "categoryId inválido" });
    }

    // courseId é opcional para o wsfunction, mas a app manda sempre que possível.
    const courseIdNum =
      courseId === undefined || courseId === null || courseId === ""
        ? null
        : Number(courseId);

    const extraParams = {
      categoryid: categoryIdNum,
    };
    if (courseIdNum && Number.isFinite(courseIdNum) && courseIdNum > 0) {
      extraParams.courseid = courseIdNum;
    }

    const exportJson = await TestarFuncaoMoodleAsync(
      connection.moodleBaseUrl,
      connection.moodleToken,
      "local_qforge_moodle_app_export_questions_from_category",
      extraParams
    );

    const moodleXml = extractMoodleXmlFromExportResponse(exportJson);
    if (!moodleXml || !String(moodleXml).trim()) {
      const backendMsg =
        exportJson?.message ||
        "O Moodle não devolveu moodle XML válido (sem XML para importar).";
      return res.status(400).json({
        error: backendMsg,
        moodleQuestionCount: exportJson?.questioncount ?? null,
        moodleExportableCount: exportJson?.exportablecount ?? null,
      });
    }

    const title = extractTitleFromExportResponse(exportJson);

    // Reaproveita o import já existente (Moodle XML -> QuestionBank/Question + labels/chapterTags).
    const importReq = {
      ...req,
      userId: req.userId,
      body: {
        format: "moodle",
        content: String(moodleXml),
        title: String(title),
      },
    };

    // resMock captura o JSON e o status do handler existente.
    const resMock = (() => {
      let statusCode = 200;
      return {
        status: (code) => {
          statusCode = code;
          return resMock;
        },
        json: (payload) => ({ statusCode, payload }),
      };
    })();

    // importBank devolve resposta via res.json/status; portanto precisamos capturar.
    // Para isso, executamos e interceptamos o retorno de resMock.json.
    let result;
    const resMock2 = {
      status: (code) => {
        resMock2._statusCode = code;
        return resMock2;
      },
      json: (payload) => {
        result = { statusCode: resMock2._statusCode || 200, payload };
        return result;
      },
    };

    await importBank(importReq, resMock2);

    if (!result) return res.status(500).json({ error: "Falha interna a importar" });
    if (result.statusCode >= 400) {
      return res.status(result.statusCode).json(result.payload);
    }

    return res.json(result.payload);
  } catch (err) {
    console.error("Erro em importQuestionBankFromCategoryHandler:", err);
    return res.status(500).json({ error: err?.message || "Erro no servidor" });
  }
}

