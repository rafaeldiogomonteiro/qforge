<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  let banks = [];
  let selectedBank = "";
  let moodleBaseUrl = "http://localhost";
  let moodleToken = "";
  let moodleCourseId = "";
  let moodleCourses = [];
  let moodleCoursesLoading = false;

  let moodleConnectionExists = false;
  let moodleConnectionEditMode = false;
  let moodleSetupLoading = false;
  let moodleSetupError = "";

  let moodleQuestionCategories = [];
  let moodleQuestionCategoriesLoading = false;
  let moodleQuestionCategoryId = "";

  let autoImporting = false;
  let autoImportSuccess = false;
  let autoImportError = "";
  let autoImportResult = null;

  let moodleCategoryName =
    "QForge Export - " + new Date().toLocaleDateString("pt-PT");
  let exporting = false;
  let exportSuccess = false;
  let exportError = "";

  let moodleFunctionName = "core_webservice_get_site_info";
  let moodleTestLoading = false;
  let moodleTestError = "";
  let moodleTestResult = "";
  
  let importFile = null;
  let importing = false;
  let importSuccess = false;
  let importError = "";
  let importResult = null;
  let fileInput = null;

  let recentExports = [];

  async function loadMoodleConnection() {
    try {
      const res = await api.get("/moodle/connection");
      moodleConnectionExists = Boolean(res.data?.exists);

      // Apenas baseUrl é devolvido; o token fica guardado no backend.
      if (moodleConnectionExists) {
        moodleBaseUrl = res.data?.moodleBaseUrl || "http://localhost";
      }
    } catch (e) {
      console.error("Erro ao carregar ligação Moodle:", e);
      moodleConnectionExists = false;
    }
  }

  async function loadMoodleCourses() {
    if (!moodleConnectionExists) return;

    try {
      moodleCoursesLoading = true;
      const res = await api.get("/moodle/courses");
      moodleCourses = res.data?.courses || [];

      if ((res.data?.courses || []).length === 0 && res.data?.debug) {
        console.error(
          "Debug /moodle/courses:",
          JSON.stringify(res.data.debug, null, 2)
        );
      }

      // Se ainda não foi escolhido, tenta selecionar o primeiro curso.
      if (!moodleCourseId && moodleCourses.length > 0) {
        moodleCourseId = String(moodleCourses[0].id);
      }
    } catch (e) {
      console.error("Erro ao carregar cursos Moodle:", e);
      moodleCourses = [];
    } finally {
      moodleCoursesLoading = false;
    }
  }

  async function loadMoodleQuestionCategories() {
    if (!moodleConnectionExists) return;

    const courseIdNum = Number(moodleCourseId);
    if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) return;

    try {
      moodleQuestionCategoriesLoading = true;
      autoImportError = "";

      const res = await api.get(
        `/moodle/question-categories?courseId=${courseIdNum}`
      );
      moodleQuestionCategories = res.data?.categories || [];

      if (
        !moodleQuestionCategoryId &&
        moodleQuestionCategories.length > 0
      ) {
        moodleQuestionCategoryId = String(moodleQuestionCategories[0].id);
      }
    } catch (e) {
      console.error("Erro ao carregar categorias Moodle:", e);
      moodleQuestionCategories = [];
    } finally {
      moodleQuestionCategoriesLoading = false;
    }
  }

  async function saveMoodleConnection() {
    moodleSetupError = "";
    moodleSetupLoading = true;

    try {
      const moodleBaseUrlStr = String(moodleBaseUrl ?? "").trim();
      const moodleTokenStr = String(moodleToken ?? "").trim();

      if (!moodleBaseUrlStr) {
        moodleSetupError = "URL do Moodle é obrigatória";
        return;
      }
      if (!moodleTokenStr) {
        moodleSetupError = "Token de API é obrigatório";
        return;
      }

      await api.put("/moodle/connection", {
        moodleBaseUrl: moodleBaseUrlStr,
        token: moodleTokenStr,
      });

      // Limpa o token do formulário (fica no backend).
      moodleToken = "";
      moodleConnectionEditMode = false;
      await loadMoodleConnection();
      await loadMoodleCourses();
      await loadMoodleQuestionCategories();
    } catch (e) {
      const status = e?.response?.status;
      const backendError = e?.response?.data?.error;
      if (status === 404) {
        moodleSetupError =
          "Endpoint Moodle não encontrado (404). Verifica se `VITE_API_URL` aponta para o teu backend local (ex.: http://localhost:4000) e reinicia o backend/frontend.";
      } else {
        moodleSetupError =
          backendError || e.message || "Erro ao guardar ligação Moodle";
      }
    } finally {
      moodleSetupLoading = false;
    }
  }

  async function loadBanks() {
    try {
      const res = await api.get("/banks");
      banks = res.data?.data || [];
    } catch (e) {
      console.error("Erro ao carregar bancos:", e);
    }
  }

  function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleString("pt-PT");
  }

  async function loadRecentMoodleExports() {
    try {
      // Verdade fonte: Auditoria (per utilizador). Apenas exportações para Moodle.
      const res = await api.get(`/audit-logs?page=1&limit=5&action=Exportação`);
      const logs = res.data?.data || [];
      const moodleLogs = logs.filter((l) => l.targetType === "Moodle");

      recentExports = moodleLogs.map((l) => ({
        date: formatDate(l.createdAt),
        user: l.userId?.email || "desconhecido",
        action: l.action,
        target: l.targetName || "Moodle",
        status: l.result === "Sucesso" ? "Sucesso" : "Falha",
      }));
    } catch (e) {
      console.error("Erro ao carregar exportações recentes (Moodle):", e);
      recentExports = [];
    }
  }

  onMount(async () => {
    await loadBanks();
    await loadRecentMoodleExports();

    await loadMoodleConnection();
    await loadMoodleCourses();
    await loadMoodleQuestionCategories();
  });

  async function handleMoodleTest() {
    const moodleFunctionNameStr = String(moodleFunctionName ?? "");

    if (!moodleFunctionNameStr.trim()) {
      moodleTestError = "Nome da funcao Moodle e obrigatorio";
      return;
    }

    moodleTestLoading = true;
    moodleTestError = "";
    moodleTestResult = "";

    try {
      const response = await api.post("/moodle/test-function", {
        functionName: moodleFunctionNameStr,
      });

      moodleTestResult = JSON.stringify(response.data?.json ?? null, null, 2);
    } catch (e) {
      const backendError = e?.response?.data?.error;
      moodleTestError =
        backendError || e.message || "Erro ao testar Moodle";
    } finally {
      moodleTestLoading = false;
    }
  }

  async function handleExport() {
    if (!selectedBank) {
      exportError = "Seleciona um banco para exportar";
      return;
    }
    const moodleCourseIdStr = String(moodleCourseId ?? "");
    const moodleCategoryNameStr = String(moodleCategoryName ?? "");

    if (!String(moodleCourseIdStr).trim()) {
      exportError = "Seleciona um curso Moodle";
      return;
    }
    if (!moodleCategoryNameStr.trim()) {
      exportError = "Categoria de destino (Question Bank) é obrigatória";
      return;
    }

    exportError = "";
    exporting = true;
    exportSuccess = false;

    try {
      // 1) Exporta o banco do QForge em Moodle XML
      const response = await api.get(
        `/banks/${selectedBank}/export?format=moodle`,
        { responseType: "text" }
      );
      const moodleXml = response.data;

      // 2) Importa no Moodle (plugin custom)
      const importRes = await api.post("/moodle/import-question-bank", {
        courseId: Number(moodleCourseIdStr),
        categoryName: moodleCategoryNameStr,
        moodleXml,
      });

      exportSuccess = Boolean(importRes.data?.success);
      await loadRecentMoodleExports();

      setTimeout(() => {
        exportSuccess = false;
      }, 3000);
    } catch (e) {
      const backendError = e?.response?.data?.error;
      exportError =
        "Erro ao exportar: " +
        (backendError || e.message || "Erro desconhecido");
    } finally {
      exporting = false;
    }
  }

  async function handleImport() {
    if (!importFile) {
      importError = "Seleciona um ficheiro XML para importar";
      return;
    }

    importError = "";
    importing = true;
    importSuccess = false;

    try {
      const fileContent = await importFile.text();
      const bankTitle = importFile.name.replace(".xml", "").replace(".mxml", "");

      const response = await api.post("/banks/import", {
        format: "moodle",
        content: fileContent,
        title: bankTitle,
      });

      importResult = response.data;
      importSuccess = true;
      importFile = null;

      // Recarrega bancos
      await loadBanks();

      setTimeout(() => {
        importSuccess = false;
      }, 3000);
    } catch (e) {
      importError = "Erro ao importar: " + (e.response?.data?.error || e.message || "Erro desconhecido");
    } finally {
      importing = false;
    }
  }

  async function handleAutoImportFromCategory() {
    autoImportError = "";
    autoImportSuccess = false;
    autoImportResult = null;

    const courseIdNum = Number(moodleCourseId);
    const categoryIdNum = Number(moodleQuestionCategoryId);

    if (!Number.isFinite(courseIdNum) || courseIdNum <= 0) {
      autoImportError = "Seleciona um curso Moodle";
      return;
    }

    if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) {
      autoImportError = "Seleciona uma categoria de Question Bank";
      return;
    }

    autoImporting = true;
    try {
      const response = await api.post(
        "/moodle/import-question-bank-from-category",
        {
          courseId: courseIdNum,
          categoryId: categoryIdNum,
        }
      );

      autoImportResult = response.data;
      autoImportSuccess = true;

      await loadBanks();
      await loadRecentMoodleExports();

      setTimeout(() => {
        autoImportSuccess = false;
      }, 3000);
    } catch (e) {
      const backendError = e?.response?.data?.error;
      autoImportError =
        backendError ||
        e.message ||
        "Erro ao importar automaticamente a partir da categoria";
      autoImportSuccess = false;
    } finally {
      autoImporting = false;
    }
  }
</script>

<div style="padding: 0;">
  <h1 style="margin: 0 0 8px 0; font-size: 28px;">Integração Moodle</h1>
  <p style="color: var(--muted); margin-top: 0;">Exporta bancos para Moodle e importa ficheiros Moodle XML</p>
</div>

<!-- TESTE REST MOODLE -->
<div style="margin-top: 24px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
    <span style="font-size: 13px; font-weight: 700; color: #2563eb;">REST</span>
    <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Teste simples da API REST</h2>
  </div>

  <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
    <div>
      <label for="moodle-test-function" style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
        Funcao Moodle
      </label>
      <input
        id="moodle-test-function"
        type="text"
        bind:value={moodleFunctionName}
        placeholder="core_webservice_get_site_info"
        style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;"
      />
    </div>
  </div>

  <button
    on:click={handleMoodleTest}
    disabled={moodleTestLoading || !moodleConnectionExists}
    style="margin-top: 14px; padding: 12px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: {moodleTestLoading ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: {moodleTestLoading ? 0.6 : 1};"
  >
    {moodleTestLoading ? "A testar..." : "Testar funcao Moodle"}
  </button>

  {#if moodleTestError}
    <div style="margin-top: 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c; font-size: 13px;">
      {moodleTestError}
    </div>
  {/if}

  {#if moodleTestResult}
    <pre style="margin-top: 14px; max-height: 360px; overflow: auto; background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; line-height: 1.5; white-space: pre-wrap;">{moodleTestResult}</pre>
  {/if}
</div>

<div style="margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
  <!-- EXPORTAR PARA MOODLE -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
      <span style="font-size: 20px;">📤</span>
      <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Exportar para Moodle</h2>
    </div>

    <div style="display: grid; gap: 12px;">
      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          Banco de Questões
        </label>
        <select
          bind:value={selectedBank}
          style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 14px;"
        >
          <option value="">Selecionar banco...</option>
          {#each banks as bank}
            <option value={bank._id}>{bank.title}</option>
          {/each}
        </select>
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          Formato de Exportação
        </label>
        <select
          disabled
          style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: #f9fafb; font-size: 14px; color: #666;"
        >
          <option>Moodle XML</option>
        </select>
      </div>

      {#if !moodleConnectionExists || moodleConnectionEditMode}
        <div style="grid-column: 1 / -1; background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 14px;">
          <div style="font-weight: 600; margin-bottom: 6px;">Ligação Moodle (1 vez)</div>
          <div style="display: grid; gap: 12px;">
            <div>
              <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
                URL do site Moodle
              </label>
              <input
                type="text"
                bind:value={moodleBaseUrl}
                placeholder="http://localhost"
                style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;"
              />
            </div>

            <div>
              <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
                Token de API
              </label>
              <input
                type="password"
                bind:value={moodleToken}
                placeholder="••••••••••••"
                style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;"
              />
              <div style="font-size: 12px; color: var(--muted); margin-top: 6px;">
                Obtém o token em: Administração → Segurança → Serviços Web
              </div>
            </div>

            {#if moodleSetupError}
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c; font-size: 13px;">
                {moodleSetupError}
              </div>
            {/if}

            <button
              on:click={saveMoodleConnection}
              disabled={moodleSetupLoading}
              style="width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: {moodleSetupLoading ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: {moodleSetupLoading ? 0.6 : 1};"
            >
              {moodleSetupLoading ? "A guardar..." : "Guardar ligação"}
            </button>
          </div>
        </div>
      {:else}
        <div>
          <div style="display:flex; justify-content:flex-end; margin-bottom: 10px;">
            <button
              type="button"
              on:click={() => {
                moodleConnectionEditMode = true;
                moodleSetupError = "";
                moodleToken = "";
              }}
              style="padding: 8px 12px; background: #fff; border: 1px solid var(--border); border-radius: 10px; color: #334155; cursor:pointer; font-size: 13px;"
            >
              Alterar ligação Moodle
            </button>
          </div>

          <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
            Curso (Moodle)
          </label>
          <select
            bind:value={moodleCourseId}
            disabled={moodleCoursesLoading || moodleCourses.length === 0}
            style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 14px;"
          >
            <option value="">{moodleCoursesLoading ? "A carregar..." : moodleCourses.length ? "Selecionar curso..." : "Sem cursos"}</option>
            {#each moodleCourses as c}
              <option value={c.id}>{c.fullname}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          Categoria de destino (Question Bank)
        </label>
        <input
          type="text"
          bind:value={moodleCategoryName}
          placeholder="QForge Export - 2026-06-10"
          style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;"
        />
      </div>

      {#if exportError}
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c; font-size: 13px;">
          {exportError}
        </div>
      {/if}

      {#if exportSuccess}
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; color: #166534; font-size: 13px;">
          ✓ Exportado com sucesso!
        </div>
      {/if}

      <button
        on:click={handleExport}
        disabled={exporting || !selectedBank || !moodleConnectionExists || !moodleCourseId}
        style="width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: {exporting || !selectedBank ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: {exporting || !selectedBank ? 0.6 : 1};"
      >
        {#if exporting}
          ⏳ Exportando...
        {:else}
          📤 Enviar para Moodle
        {/if}
      </button>
    </div>
  </div>

  <!-- IMPORTAR DE MOODLE -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
      <span style="font-size: 20px;">📥</span>
      <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Importar de Moodle</h2>
    </div>

    <div style="display: grid; gap: 12px;">
      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          Ficheiro Moodle XML
        </label>
        <label
          style="display: flex; align-items: center; justify-content: center; width: 100%; padding: 40px; border: 2px dashed var(--border); border-radius: 8px; background: #fafafa; cursor: pointer; transition: all 0.15s;"
          on:click={() => fileInput?.click()}
        >
          <input
            type="file"
            accept=".xml,.mxml"
            bind:this={fileInput}
            style="display: none;"
            on:change={(e) => {
              importFile = e.target.files?.[0] || null;
            }}
          />
          {#if importFile}
            <span style="text-align: center; font-size: 14px; color: #059669;">
              ✓ {importFile.name}
            </span>
          {:else}
            <span style="text-align: center;">
              <div style="font-size: 24px;">📄</div>
              <div style="font-size: 13px; color: var(--muted); margin-top: 8px;">
                Clique para selecionar ou arraste um ficheiro XML
              </div>
            </span>
          {/if}
        </label>
      </div>

      {#if importError}
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c; font-size: 13px;">
          {importError}
        </div>
      {/if}

      {#if importSuccess && importResult}
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; color: #166534; font-size: 13px;">
          ✓ Importado com sucesso!<br/>
          Questões: {importResult.imported || 0} • Etiquetas: {importResult.createdLabels || 0}
        </div>
      {/if}

      <button
        on:click={handleImport}
        disabled={importing || !importFile}
        style="width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: {importing || !importFile ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: {importing || !importFile ? 0.6 : 1};"
      >
        {#if importing}
          ⏳ Importando...
        {:else}
          📥 Importar Questões
        {/if}
      </button>
    </div>
  </div>
</div>

<!-- IMPORTAR AUTOMATICAMENTE DA MOODLE LOCAL PARA A APP -->
<div style="margin-top: 24px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
    <span style="font-size: 20px;">📥</span>
    <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Importar automaticamente para a app</h2>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    <div>
      <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
        Curso (Moodle)
      </label>
      <select
        bind:value={moodleCourseId}
        on:change={() => loadMoodleQuestionCategories()}
        style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 14px;"
        disabled={!moodleConnectionExists || moodleCoursesLoading}
      >
        {#each moodleCourses as c}
          <option value={String(c.id)}>{c.fullname || c.shortname}</option>
        {/each}
      </select>
    </div>

    <div>
      <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
        Categoria (Question Bank)
      </label>
      <select
        bind:value={moodleQuestionCategoryId}
        style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 14px;"
        disabled={
          !moodleConnectionExists ||
          moodleQuestionCategoriesLoading ||
          moodleQuestionCategories.length === 0
        }
      >
        {#each moodleQuestionCategories as cat}
          <option value={String(cat.id)}>{cat.name}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if autoImportError}
    <div style="margin-top: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c; font-size: 13px;">
      {autoImportError}
    </div>
  {/if}

  {#if autoImportSuccess && autoImportResult}
    <div style="margin-top: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; color: #166534; font-size: 13px;">
      ✓ Importação concluída!
      <div style="margin-top: 6px; color: #065f46;">
        Banco: {autoImportResult.bankId} • Importadas: {autoImportResult.imported} • Ignoradas: {autoImportResult.skipped}
      </div>
    </div>
  {/if}

  <button
    on:click={handleAutoImportFromCategory}
    disabled={autoImporting || !moodleConnectionExists || !moodleQuestionCategoryId}
    style="margin-top: 14px; width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: {autoImporting ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: {autoImporting ? 0.6 : 1};"
  >
    {#if autoImporting}
      ⏳ A importar...
    {:else}
      📥 Importar categoria do Moodle para a app
    {/if}
  </button>
</div>

<!-- EXPORTAÇÕES RECENTES -->
<div style="margin-top: 24px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Exportações Recentes</h2>

  <div style="overflow-x: auto;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border);">
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Data</th>
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Utilizador</th>
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Ação</th>
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Alvo</th>
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Resultado</th>
        </tr>
      </thead>
      <tbody>
        {#each recentExports as item}
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 8px 0;">{item.date}</td>
            <td style="padding: 8px 0;">{item.user}</td>
            <td style="padding: 8px 0;">{item.action}</td>
            <td style="padding: 8px 0;">{item.target}</td>
            <td style="padding: 8px 0;">
              <span style="background: {item.status === 'Sucesso' ? '#dcfce7' : '#fee2e2'}; color: {item.status === 'Sucesso' ? '#166534' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                {item.status}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
