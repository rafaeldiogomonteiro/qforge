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
            c?.id,
            c?.courseid,
            c?.course_id,
            nested?.id,
            nested?.courseid,
            nested?.course_id,
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

function extractCategoriesFromMoodleResponse(payload) {
  const candidate =
    payload?.categories ||
    payload?.questioncategories ||
    payload?.question_categories ||
    payload?.data ||
    payload;

  if (Array.isArray(candidate)) return candidate;
  if (candidate && typeof candidate === "object") {
    const values = Object.values(candidate);
    if (Array.isArray(values)) return values;
  }

  return [];
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

    const courseIdRaw = req.query?.courseId;
    const courseIdNum = Number(courseIdRaw);
    if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) {
      return res.status(400).json({ error: "courseId inválido" });
    }

    const json = await TestarFuncaoMoodleAsync(
      connection.moodleBaseUrl,
      connection.moodleToken,
      "local_qforge_moodle_app_get_question_categories",
      { courseid: courseIdNum }
    );

    const categoriesRaw = extractCategoriesFromMoodleResponse(json);
    const categories = categoriesRaw
      .map((c) => {
        const idCandidates = [
          c?.id,
          c?.categoryid,
          c?.category_id,
          c?.questioncategoryid,
          c?.question_category_id,
        ];
        const id = Number(idCandidates.find((v) => v !== undefined && v !== null) ?? 0);

        const name =
          c?.name ||
          c?.fullname ||
          c?.categoryname ||
          c?.categoryName ||
          c?.title ||
          "";

        return {
          id: Number.isFinite(id) && id > 0 ? id : null,
          name: String(name || "").trim(),
        };
      })
      .filter((c) => c.id && c.name);

    return res.json({ categories });
  } catch (err) {
    console.error("Erro em listMoodleQuestionCategoriesHandler:", err);
    return res.status(500).json({ error: err?.message || "Erro no servidor" });
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
      return res.status(400).json({ error: "O Moodle não devolveu moodle XML válido" });
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

