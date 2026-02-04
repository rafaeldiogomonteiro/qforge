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

<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;">
  <div>
    <h2 style="margin: 0;">Bancos de Questões</h2>
    <p style="margin: 6px 0 0; color: var(--muted);">
      Lista de bancos disponíveis no sistema.
    </p>
  </div>
  <div style="display:flex; gap:8px;">
    <button class="btn btn-secondary" type="button" on:click={() => showImportModal = true}>📥 Importar banco</button>
    <a class="btn" href="/app/banks/new">+ Novo banco</a>
  </div>
</div>

{#if loading}
  <p style="margin-top: 16px; color: var(--muted);">A carregar bancos…</p>
{:else if error}
  <p style="margin-top: 16px; color: #b91c1c;">{error}</p>
{:else if banks.length === 0}
  <p style="margin-top: 16px; color: var(--muted);">Ainda não existem bancos.</p>
{:else}
  <div
    style="
      margin-top: 16px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    "
  >
    {#each banks as bank}
      <a
        href={`/app/banks/${bank._id}`}
        style="text-decoration: none; color: inherit;"
      >
        <div
          style="
            background: white;
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 16px;
          "
        >
          <div style="font-weight: 600;">
            {bank.title}
          </div>

          {#if bank.description}
            <div style="margin-top: 6px; color: var(--muted); font-size: 14px;">
              {bank.description}
            </div>
          {/if}
        </div>
      </a>
    {/each}
  </div>
{/if}

<!-- Modal de Importação de Banco -->
{#if showImportModal}
  <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
    <div style="background: white; border-radius: 14px; padding: 24px; width: 100%; max-width: 520px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Importar banco</h3>
        <button
          on:click={() => { showImportModal = false; importError = ""; importResult = null; importContent = ""; importFileName = ""; importTitle = ""; importLabels = ""; importChapterTags = ""; importFormat = "aiken"; }}
          style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--muted);"
        >×</button>
      </div>

      <p style="margin: 0 0 16px 0; color: var(--muted); font-size: 14px;">
        Formatos suportados: Aiken (.txt), Gift (.gift) e Moodle XML (.xml).
      </p>

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
            <label style="font-size: 13px; color: var(--muted);">Etiquetas de capítulo (opcional)</label>
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
