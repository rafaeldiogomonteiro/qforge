import { fetch } from "undici";

function validarCampoObrigatorio(valor, nome) {
  if (!valor || typeof valor !== "string" || !valor.trim()) {
    throw new Error(`${nome} vazio`);
  }
}

function validarBaseUrlMoodle(moodleBaseUrl) {
  try {
    const url = new URL(moodleBaseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("URL do Moodle deve usar http ou https");
    }
    // Mantém path base caso Moodle esteja instalado num sub-directório.
    const withoutTrailingSlash = moodleBaseUrl.trim().replace(/\/$/, "");
    return withoutTrailingSlash;
  } catch {
    throw new Error("URL do Moodle invalido");
  }
}

function appendMoodleParam(params, key, value) {
  if (value === undefined || value === null) {
    params.append(key, "");
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => appendMoodleParam(params, `${key}[${index}]`, item));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      appendMoodleParam(params, `${key}[${nestedKey}]`, nestedValue);
    });
    return;
  }

  params.append(key, String(value));
}

/**
 * Chama uma função (wsfunction) via Moodle Web Services REST.
 * - Envia POST para /webservice/rest/server.php
 * - wstoken, wsfunction, moodlewsrestformat=json + params extra
 * - Devolve o JSON já parseado.
 */
export async function TestarFuncaoMoodleAsync(
  moodleBaseUrl,
  token,
  functionName,
  extraParams = {}
) {
  validarCampoObrigatorio(moodleBaseUrl, "BaseUrl");
  validarCampoObrigatorio(token, "Token");
  validarCampoObrigatorio(functionName, "Funcao");

  const baseUrl = validarBaseUrlMoodle(moodleBaseUrl.trim());
  const url = `${baseUrl}/webservice/rest/server.php`;

  if (extraParams && typeof extraParams !== "object") {
    throw new Error("Parâmetros extra inválidos (deve ser um objeto)");
  }

  const body = new URLSearchParams({
    wstoken: token.trim(),
    wsfunction: functionName.trim(),
    moodlewsrestformat: "json",
  });
  Object.entries(extraParams).forEach(([key, value]) => {
    appendMoodleParam(body, key, value);
  });

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (err) {
    throw new Error(`Falha de ligacao ao Moodle: ${err.message}`);
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Resposta HTTP sem sucesso (${response.status}): ${responseText}`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // Algumas chamadas podem devolver output HTML antes do JSON (ex.: import).
    const firstBrace = responseText.indexOf("{");
    const lastBrace = responseText.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = responseText.slice(firstBrace, lastBrace + 1);
      parsed = JSON.parse(candidate);
    } else {
      throw new Error(`Resposta do Moodle nao e JSON valido: ${responseText}`);
    }
  }

  if (parsed?.exception || parsed?.errorcode) {
    const message = parsed.message || parsed.error || "Erro devolvido pelo Moodle";
    throw new Error(
      `Erro Moodle${parsed.errorcode ? ` (${parsed.errorcode})` : ""}: ${message}`
    );
  }

  console.log(`[MoodleWS] wsfunction=${functionName.trim()} ok`);
  return parsed;
}

