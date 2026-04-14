<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  let banks = [];
  let loading = true;
  let error = "";

  // Import modal
  let showImportModal = false;
  let importTitle = "";
  let importFormat = "aiken";
  let importContent = "";
  let importFileName = "";
  let importLabels = "";
  let importChapterTags = "";
  let importLoading = false;
  let importError = "";
  let importResult = null;

  onMount(loadBanks);

  async function loadBanks() {
    loading = true;
    error = "";

    try {
      const response = await api.get("/banks");

      /**
       * Backend response:
       * {
       *   data: [ { _id, title, ... } ],
       *   pagination: { ... }
       * }
       */
      banks = response.data?.data ?? [];
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao carregar bancos.";
    } finally {
      loading = false;
    }
  }

  async function importBank() {
    if (!importTitle.trim()) {
      importError = "Indica um título para o banco.";
      return;
    }

    if (!importContent.trim()) {
      importError = "Carrega um ficheiro ou cola o conteúdo.";
      return;
    }

    importLoading = true;
    importError = "";
    importResult = null;

    try {
      const payload = {
        title: importTitle.trim(),
        format: importFormat,
        content: importContent,
        labels: importLabels
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        chapterTags: importChapterTags
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };

      const { data } = await api.post("/banks/import", payload);

      importResult = data;
      await loadBanks();
      showImportModal = false;
      importTitle = "";
      importContent = "";
      importFileName = "";
      importLabels = "";
      importChapterTags = "";
      importFormat = "aiken";

      if (data?.bankId) {
        window.location.href = `/app/banks/${data.bankId}`;
      }
    } catch (e) {
      importError = e?.response?.data?.error || e?.response?.data?.message || "Erro ao importar banco.";
    } finally {
      importLoading = false;
    }
  }

  async function handleImportFile(event) {
    importError = "";
    importResult = null;
    const file = event.target.files?.[0];
    if (!file) return;
    importFileName = file.name;
    try {
      const text = await file.text();
      importContent = text;
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ext === "gift") importFormat = "gift";
      else if (ext === "xml") importFormat = "moodle";
      else importFormat = "aiken";
      if (!importTitle.trim()) {
        importTitle = file.name.replace(/\.[^.]+$/, "");
      }
    } catch (err) {
      importError = "Não foi possível ler o ficheiro.";
    }
  }
</script>

<div style="display: flex; flex-direction: column; gap: 24px;">
  <!-- Header -->
  <div style="display: flex; flex-direction: column; gap: 4px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
      <div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1e293b;">Banco de Questões</h1>
        <p style="margin: 6px 0 0; font-size: 14px; color: #64748b;">Gerir e organizar os seus bancos de questões</p>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 12px;">
        <button class="btn btn-secondary" type="button" on:click={() => showImportModal = true} style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b; cursor: pointer; transition: background 0.2s;">
          📥 Importar Banco
        </button>
        <a class="btn" href="/app/banks/new" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: #2563eb; color: white; border-radius: 8px; text-decoration: none; cursor: pointer; transition: background 0.2s;">
          ➕ Novo Banco
        </a>
      </div>
    </div>
  </div>

  <!-- Content -->
  {#if loading}
    <p style="color: #64748b;">A carregar bancos…</p>
  {:else if error}
    <p style="color: #ef4444;">{error}</p>
  {:else if banks.length === 0}
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 48px 24px; text-align: center;">
      <p style="font-size: 18px; color: #1e293b; margin: 0 0 8px 0;">Sem bancos ainda</p>
      <p style="font-size: 14px; color: #64748b; margin: 0;">Crie o seu primeiro banco de questões para começar</p>
    </div>
  {:else}
    <div
      style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
      "
    >
    {#each banks as bank}
      <div
        style="
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 12px;
        "
      >
        <!-- Title -->
        <div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">
            🗂️ {bank.title}
          </h3>
          {#if bank.description}
            <p style="margin: 6px 0 0; font-size: 14px; color: #64748b; line-height: 1.4;">
              {bank.description.substring(0, 100)}...
            </p>
          {/if}
        </div>

        <!-- Metadata -->
        <div style="display: flex; gap: 16px; font-size: 12px; color: #64748b; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 4px;">
            👤 {bank.owner?.name || "Sistema"}
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            📅 {new Date(bank.createdAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>

        <!-- Stats in 3 columns -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; text-align: center;">
          <div>
            <div style="font-size: 18px; font-weight: 600; color: #1e293b;">
              {bank._questions?.length || 0}
            </div>
            <div style="font-size: 11px; color: #64748b;">Questões</div>
          </div>
          <div style="border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
            <div style="font-size: 18px; font-weight: 600; color: #1e293b;">
              {bank._tags?.length || 0}
            </div>
            <div style="font-size: 11px; color: #64748b;">Tags</div>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 600; color: #1e293b;">
              {bank._folders?.length || 0}
            </div>
            <div style="font-size: 11px; color: #64748b;">Pastas</div>
          </div>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 8px;">
          <a
            href={`/app/banks/${bank._id}`}
            style="
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
              padding: 10px;
              background: #2563eb;
              color: white;
              text-decoration: none;
              font-size: 13px;
              border-radius: 8px;
              transition: background 0.2s;
              border: none;
              cursor: pointer;
            "
          >
            👁️ Ver
          </a>
          <button
            style="
              padding: 10px;
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              cursor: pointer;
              font-size: 13px;
              transition: background 0.2s;
            "
          >
            📥
          </button>
          <button
            style="
              padding: 10px;
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              cursor: pointer;
              font-size: 13px;
              transition: background 0.2s;
            "
          >
            ⋯
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}
</div>

<!-- Modal de Importação de Banco -->
{#if showImportModal}
  <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
    <div style="background: white; border-radius: 12px; padding: 24px; width: 100%; max-width: 600px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #1e293b;">Importar Banco de Questões</h2>
        <button
          on:click={() => { showImportModal = false; importError = ""; importResult = null; importContent = ""; importFileName = ""; importTitle = ""; importLabels = ""; importChapterTags = ""; importFormat = "aiken"; }}
          style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;"
        >×</button>
      </div>

      {#if importError}
        <div style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
          {importError}
        </div>
      {/if}

      <div style="display: grid; gap: 12px;">
        <div>
          <label style="font-size: 13px; color: var(--muted);">Título do banco</label>
          <input
            type="text"
            bind:value={importTitle}
            placeholder="Ex.: Banco de exemplo"
            style="margin-top:6px; width:100%; padding:10px; border:1px solid var(--border); border-radius:10px;"
          />
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted);">Formato</label>
          <select
            bind:value={importFormat}
            style="margin-top:6px; width:100%; padding:10px; border:1px solid var(--border); border-radius:10px; background:white;"
          >
            <option value="aiken">Aiken (.txt)</option>
            <option value="gift">Gift (.gift)</option>
            <option value="moodle">Moodle XML (.xml)</option>
          </select>
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted);">Ficheiro</label>
          <input type="file" accept=".txt,.gift,.xml" on:change={handleImportFile} style="margin-top:6px;" />
          {#if importFileName}
            <div style="margin-top:4px; font-size:12px; color: var(--muted);">{importFileName}</div>
          {/if}
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted);">Conteúdo</label>
          <textarea
            bind:value={importContent}
            rows="12"
            placeholder="Cola aqui o conteúdo Aiken/Gift/XML..."
            style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; font-family: var(--font-mono, monospace);"
          />
        </div>

        <div style="display:grid; gap:10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
          <div>
            <label style="font-size: 13px; color: var(--muted);">Etiquetas (opcional)</label>
            <input
              type="text"
              bind:value={importLabels}
              placeholder="Ex.: difícil,exame"
              style="margin-top:6px; width:100%; padding:10px; border:1px solid var(--border); border-radius:10px;"
            />
          </div>
          <div>
          <label style="font-size: 13px; color: var(--muted);">Capítulos (opcional)</label>
            <input
              type="text"
              bind:value={importChapterTags}
              placeholder="Ex.: arrays,loops"
              style="margin-top:6px; width:100%; padding:10px; border:1px solid var(--border); border-radius:10px;"
            />
          </div>
        </div>

        {#if importError}
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; color: #b91c1c; font-size: 14px;">
            {importError}
          </div>
        {/if}

        {#if importResult}
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; color: #166534; font-size: 14px;">
            Banco criado • Questões importadas: {importResult.imported || 0} • Ignoradas: {importResult.skipped || 0}<br />
            Etiquetas criadas: {importResult.createdLabels || 0} • Etiquetas de capítulo criadas: {importResult.createdChapterTags || 0}
          </div>
        {/if}

        <div style="display: flex; gap: 10px;">
          <button class="btn" type="button" on:click={importBank} disabled={importLoading}>
            {importLoading ? "A importar..." : "Importar"}
          </button>
          <button class="btn" type="button" style="background: #f3f4f6; color: #374151;" on:click={() => { showImportModal = false; importError = ""; importResult = null; importContent = ""; importFileName = ""; }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
