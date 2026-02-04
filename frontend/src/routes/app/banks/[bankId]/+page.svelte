<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  export let data;

  let bank = null;
  let questions = [];
  let loading = true;
  let error = "";
  let selected = new Set();

  // Available labels and chapter tags for filters
  let availableLabels = [];
  let availableChapterTags = [];

  // Export modal
  let showExportModal = false;
  let exportLoading = false;
  let exportError = "";

  // filtros
  let fType = "ALL";
  let fSource = "ALL";
  let fDifficulty = "ALL";
  let fLabels = []; // Array of selected label IDs
  let fChapterTags = []; // Array of selected chapter tag IDs
  let search = "";

  // colapsar opções por questão
  let expanded = new Set(); // guarda ids expandidos

  onMount(loadAll);

  async function loadAll() {
    loading = true;
    error = "";

    try {
      const bankId = data.bankId;

      const [bankRes, qRes, labelsRes, tagsRes] = await Promise.all([
        api.get(`/banks/${bankId}`),
        api.get(`/banks/${bankId}/questions`),
        api.get("/labels"),
        api.get("/chapter-tags")
      ]);

      bank = bankRes.data;
      questions = Array.isArray(qRes.data) ? qRes.data : [];
      availableLabels = labelsRes.data || [];
      availableChapterTags = tagsRes.data || [];
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao carregar banco.";
    } finally {
      loading = false;
    }
  }

  async function exportBank(format) {
    exportLoading = true;
    exportError = "";

    try {
      const ids = Array.from(selected);
      const idsParam = ids.length ? `&ids=${ids.join(",")}` : "";
      const response = await api.get(`/banks/${bank._id}/export?format=${format}${idsParam}`, {
        responseType: 'blob'
      });

      // Determinar extensão e tipo de ficheiro
      const extensions = {
        gift: '.gift',
        aiken: '.txt',
        moodle: '.xml'
      };

      const mimeTypes = {
        gift: 'text/plain',
        aiken: 'text/plain',
        moodle: 'application/xml'
      };

      // Criar blob e fazer download
      const blob = new Blob([response.data], { type: mimeTypes[format] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filename = (bank.title || 'banco').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `${filename}${extensions[format]}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showExportModal = false;
    } catch (e) {
      console.error("Erro ao exportar:", e);
      exportError = e?.response?.data?.error || "Erro ao exportar banco.";
    } finally {
      exportLoading = false;
    }
  }

  async function importBank() {
    if (!importContent.trim()) {
      importError = "Carrega um ficheiro ou cola o conteúdo.";
      return;
    }

    importLoading = true;
    importError = "";
    importResult = null;

    try {
      const { data } = await api.post(`/banks/${bank._id}/import`, {
        format: importFormat,
        content: importContent,
      });

      importResult = data;
      await loadAll();
      showImportModal = false;
      importContent = "";
      importFileName = "";
    } catch (e) {
      importError =
        e?.response?.data?.error || e?.response?.data?.message || "Erro ao importar.";
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
    } catch (err) {
      importError = "Não foi possível ler o ficheiro.";
    }
  }

  function typeLabel(type) {
    return {
      MULTIPLE_CHOICE: "Escolha múltipla",
      TRUE_FALSE: "V/F",
      SHORT_ANSWER: "Resposta curta",
      OPEN: "Aberta"
    }[type] || type;
  }

  function sourceLabel(source) {
    return {
      MANUAL: "Manual",
      AI: "IA",
      IMPORTED: "Importada"
    }[source] || source;
  }

  function badgeStyle(kind, value) {
    // estilos simples e consistentes
    const base = "display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:12px; border:1px solid var(--border); background:#fff;";

    if (kind === "source") {
      const map = {
        MANUAL: "background:#f8fafc; border-color:#e2e8f0;",
        AI: "background:#f5f3ff; border-color:#ddd6fe;",
        IMPORTED: "background:#fdf2f8; border-color:#fbcfe8;"
      };
      return base + (map[value] || "");
    }

    if (kind === "difficulty") {
      const difficultyLabels = {
        1: "Básico",
        2: "Normal",
        3: "Difícil",
        4: "Muito Difícil"
      };
      const map = {
        1: "background:#ecfeff; border-color:#a5f3fc;",
        2: "background:#f0fdf4; border-color:#bbf7d0;",
        3: "background:#fffbeb; border-color:#fde68a;",
        4: "background:#fef2f2; border-color:#fecaca;"
      };
      return base + (map[value] || "");
    }

    return base;
  }

  function difficultyLabel(value) {
    const labels = {
      1: "Básico",
      2: "Normal",
      3: "Difícil",
      4: "Muito Difícil"
    };
    return `${value} - ${labels[value] || ""}`;
  }

  function toggleExpanded(id) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
  }

  function toggleSelect(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function selectFilteredAll() {
    const next = new Set(selected);
    filtered.forEach((q) => next.add(q._id));
    selected = next;
  }

  function clearSelection() {
    selected = new Set();
  }

  $: filtered = questions.filter((q) => {
    if (fType !== "ALL" && q.type !== fType) return false;
    if (fSource !== "ALL" && q.source !== fSource) return false;
    if (fDifficulty !== "ALL" && String(q.difficulty) !== fDifficulty) return false;

    // Filter by labels
    if (fLabels.length > 0) {
      const questionLabelIds = (q.labels || []).map(l => typeof l === 'string' ? l : l._id);
      const hasSelectedLabel = fLabels.some(labelId => questionLabelIds.includes(labelId));
      if (!hasSelectedLabel) return false;
    }

    // Filter by chapter tags
    if (fChapterTags.length > 0) {
      const questionTagIds = (q.chapterTags || []).map(t => typeof t === 'string' ? t : t._id);
      const hasSelectedTag = fChapterTags.some(tagId => questionTagIds.includes(tagId));
      if (!hasSelectedTag) return false;
    }

    const s = search.trim().toLowerCase();
    if (s) {
      const hay = `${q.stem || ""} ${(q.tags || []).join(" ")}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }

    return true;
  });
</script>

{#if loading}
  <p style="color: var(--muted);">A carregar banco…</p>
{:else if error}
  <p style="color: #b91c1c;">{error}</p>
{:else}
  <!-- Cabeçalho -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
    <h2 style="margin: 0;">{bank.title}</h2>

    {#if bank.description}
      <p style="margin: 6px 0 0; color: var(--muted);">{bank.description}</p>
    {/if}

    <div style="margin-top: 10px; font-size: 14px; color: var(--muted);">
      {bank.discipline} • {bank.academicYear} • {bank.language}
    </div>

    <div style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
      <a class="btn" href={`/app/banks/${bank._id}/questions/new`}>+ Nova questão</a>
      <button class="btn btn-secondary" on:click={() => showExportModal = true} disabled={questions.length === 0}>
        📤 Exportar
      </button>
      <a class="btn" href="/app/banks">Voltar aos bancos</a>
    </div>
  </div>

  <!-- Modal de Exportação -->
  {#if showExportModal}
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div style="background: white; border-radius: 14px; padding: 24px; width: 100%; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Exportar banco</h3>
          <button 
            on:click={() => showExportModal = false} 
            style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--muted);"
          >×</button>
        </div>

        <p style="margin: 0 0 16px 0; color: var(--muted); font-size: 14px;">
          Seleciona o formato de exportação para o banco <strong>{bank.title}</strong>.
          {#if selected.size > 0}
            <br />Exportar {selected.size} questão(ões) selecionadas.
          {:else}
            <br />Sem seleção → exporta todas ({questions.length}) do banco.
          {/if}
        </p>

        {#if exportError}
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; margin-bottom: 16px; color: #b91c1c; font-size: 14px;">
            {exportError}
          </div>
        {/if}

        <div style="display: grid; gap: 12px;">
          <button 
            class="export-option"
            on:click={() => exportBank('gift')}
            disabled={exportLoading}
          >
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 24px;">📝</span>
              <div style="text-align: left;">
                <div style="font-weight: 600;">Formato GIFT</div>
                <div style="font-size: 13px; color: var(--muted);">Formato nativo do Moodle para importação rápida</div>
              </div>
            </div>
          </button>

          <button 
            class="export-option"
            on:click={() => exportBank('aiken')}
            disabled={exportLoading}
          >
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 24px;">📋</span>
              <div style="text-align: left;">
                <div style="font-weight: 600;">Formato Aiken</div>
                <div style="font-size: 13px; color: var(--muted);">Formato simples para escolha múltipla (.txt)</div>
              </div>
            </div>
          </button>

          <button 
            class="export-option"
            on:click={() => exportBank('moodle')}
            disabled={exportLoading}
          >
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 24px;">🎓</span>
              <div style="text-align: left;">
                <div style="font-weight: 600;">Moodle XML</div>
                <div style="font-size: 13px; color: var(--muted);">Formato XML completo com todos os metadados</div>
              </div>
            </div>
          </button>
        </div>

        {#if exportLoading}
          <div style="margin-top: 16px; text-align: center; color: var(--muted); font-size: 14px;">
            A exportar...
          </div>
        {/if}

        <button 
          class="btn" 
          style="width: 100%; margin-top: 16px; background: #f3f4f6; color: #374151;"
          on:click={() => showExportModal = false}
        >
          Cancelar
        </button>
      </div>
    </div>
  {/if}


  <!-- Filtros -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px;">
      <div>
        <label style="font-size: 13px; color: var(--muted);">Tipo</label>
        <select bind:value={fType} style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;">
          <option value="ALL">Todos</option>
          <option value="MULTIPLE_CHOICE">Escolha múltipla</option>
          <option value="TRUE_FALSE">V/F</option>
          <option value="SHORT_ANSWER">Resposta curta</option>
          <option value="OPEN">Aberta</option>
        </select>
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted);">Origem</label>
        <select bind:value={fSource} style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;">
          <option value="ALL">Todas</option>
          <option value="MANUAL">Manual</option>
          <option value="AI">IA</option>
          <option value="IMPORTED">Importadas</option>
        </select>
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted);">Dificuldade</label>
        <select bind:value={fDifficulty} style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;">
          <option value="ALL">Todas</option>
          <option value="1">1 - Básico</option>
          <option value="2">2 - Normal</option>
          <option value="3">3 - Difícil</option>
          <option value="4">4 - Muito Difícil</option>
        </select>
      </div>
    </div>

    <div style="margin-top: 10px;">
      <label style="font-size: 13px; color: var(--muted);">Pesquisa (enunciado/etiquetas)</label>
      <input
        bind:value={search}
        placeholder="ex.: simplex, restrições, dualidade..."
        style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
      />
    </div>

    <!-- Labels Filter -->
    <div style="margin-top: 10px;">
      <label style="font-size: 13px; color: var(--muted);">Filtrar por etiquetas</label>
      <div style="margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; max-height: 120px; overflow-y: auto; background: white;">
        {#if availableLabels.length === 0}
          <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma etiqueta disponível</p>
        {:else}
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            {#each availableLabels as label}
              <label style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: {fLabels.includes(label._id) ? '#ecfeff' : 'white'}; cursor: pointer; font-size: 13px;">
                <input
                  type="checkbox"
                  value={label._id}
                  checked={fLabels.includes(label._id)}
                  on:change={(e) => {
                    if (e.target.checked) {
                      fLabels = [...fLabels, label._id];
                    } else {
                      fLabels = fLabels.filter(id => id !== label._id);
                    }
                  }}
                  style="margin: 0;"
                />
                <span>{label.name}</span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Chapter Tags Filter -->
    <div style="margin-top: 10px;">
      <label style="font-size: 13px; color: var(--muted);">Filtrar por etiquetas de capítulo</label>
      <div style="margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; max-height: 120px; overflow-y: auto; background: white;">
        {#if availableChapterTags.length === 0}
          <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma etiqueta de capítulo disponível</p>
        {:else}
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            {#each availableChapterTags as tag}
              <label style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: {fChapterTags.includes(tag._id) ? '#f5f3ff' : 'white'}; cursor: pointer; font-size: 13px;">
                <input
                  type="checkbox"
                  value={tag._id}
                  checked={fChapterTags.includes(tag._id)}
                  on:change={(e) => {
                    if (e.target.checked) {
                      fChapterTags = [...fChapterTags, tag._id];
                    } else {
                      fChapterTags = fChapterTags.filter(id => id !== tag._id);
                    }
                  }}
                  style="margin: 0;"
                />
                <span>{tag.name}</span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div style="margin-top: 10px; color: var(--muted); font-size: 13px;">
      A mostrar <b>{filtered.length}</b> de <b>{questions.length}</b> questões.
      <button class="btn" type="button" style="margin-left: 10px; padding: 6px 10px;" on:click={selectFilteredAll}>
        Selecionar estas
      </button>
      <button class="btn" type="button" style="margin-left: 6px; padding: 6px 10px;" on:click={clearSelection}>
        Limpar seleção
      </button>
      {#if selected.size > 0}
        <span style="margin-left: 8px; color: var(--muted);">Selecionadas: {selected.size}</span>
      {/if}
    </div>
  </div>

  <!-- Lista -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    <h3 style="margin: 0 0 12px 0;">Questões</h3>

    {#if filtered.length === 0}
      <p style="color: var(--muted); margin: 0;">Sem resultados com estes filtros.</p>
    {:else}
      <div style="display: grid; gap: 12px;">
        {#each filtered as q}
          <div style="border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
            <!-- Top row -->
            <div style="display:flex; justify-content:space-between; gap: 12px; align-items:flex-start;">
              <div style="display:flex; gap: 8px; flex-wrap: wrap; align-items:center;">
                <input
                  type="checkbox"
                  checked={selected.has(q._id)}
                  on:change={() => toggleSelect(q._id)}
                  style="width:16px; height:16px;"
                />
                <span style={badgeStyle("type", q.type)}>{typeLabel(q.type)}</span>
                <span style={badgeStyle("source", q.source)}>{sourceLabel(q.source)}</span>
                <span style={badgeStyle("difficulty", q.difficulty)}>{difficultyLabel(q.difficulty)}</span>
                {#if q.usageCount > 0}
                  <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:12px; border:1px solid var(--border); background:#fef3c7; border-color:#fde047;">
                    Usada {q.usageCount}x
                  </span>
                {/if}
              </div>

              <div style="display:flex; gap: 8px;">
                <a class="btn" href={`/app/banks/${bank._id}/questions/${q._id}/edit`}>Editar</a>
              </div>
            </div>

            <!-- Stem -->
            <div style="margin-top: 10px;">
              {q.stem}
            </div>

            <!-- Options collapsed -->
            {#if q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE"}
              <div style="margin-top: 10px;">
                {#if (q.options || []).length > 0}
                  <ul style="margin: 0; padding-left: 18px;">
                    {#each (expanded.has(q._id) ? q.options : q.options.slice(0, 2)) as opt}
                      <li style="color: {opt.isCorrect ? '#15803d' : 'inherit'};">
                        {opt.text}
                      </li>
                    {/each}
                  </ul>

                  {#if q.options.length > 2}
                    <button class="btn" type="button" style="margin-top: 8px;" on:click={() => toggleExpanded(q._id)}>
                      {expanded.has(q._id) ? "Mostrar menos" : `Mostrar mais (${q.options.length - 2})`}
                    </button>
                  {/if}
                {/if}
              </div>
            {/if}

            <!-- Short answer preview -->
            {#if q.type === "SHORT_ANSWER"}
              <div style="margin-top: 10px; color: var(--muted); font-size: 13px;">
                Respostas aceitáveis: {(q.acceptableAnswers || []).slice(0, 3).join(", ")}{(q.acceptableAnswers || []).length > 3 ? "…" : ""}
              </div>
            {/if}

            <!-- Tags -->
            {#if (q.tags || []).length > 0}
              <div style="margin-top: 10px; display:flex; gap:6px; flex-wrap: wrap;">
                {#each q.tags as t}
                  <span style="display:inline-flex; padding:3px 8px; border-radius:999px; font-size:12px; border:1px solid var(--border); background:#fff;">
                    #{t}
                  </span>
                {/each}
              </div>
            {/if}

            <!-- Labels -->
            {#if (q.labels || []).some(l => typeof l !== 'string' && l?.name)}
              <div style="margin-top: 10px; display:flex; gap:6px; flex-wrap: wrap;">
                {#each q.labels as label}
                  {#if typeof label !== 'string' && label?.name}
                  <span style="display:inline-flex; padding:3px 8px; border-radius:999px; font-size:12px; border:1px solid #a5f3fc; background:#ecfeff; color:#155e75;">
                    📝 {label.name}
                  </span>
                  {/if}
                {/each}
              </div>
            {/if}

            <!-- Chapter Tags -->
            {#if (q.chapterTags || []).some(t => typeof t !== 'string' && t?.name)}
              <div style="margin-top: 10px; display:flex; gap:6px; flex-wrap: wrap;">
                {#each q.chapterTags as tag}
                  {#if typeof tag !== 'string' && tag?.name}
                  <span style="display:inline-flex; padding:3px 8px; border-radius:999px; font-size:12px; border:1px solid #c4b5fd; background:#f5f3ff; color:#6b21a8;">
                    📚 {tag.name}
                  </span>
                  {/if}
                {/each}
              </div>
            {/if}

            <div style="margin-top: 10px; font-size: 13px; color: var(--muted);">
              Criada em {new Date(q.createdAt).toLocaleDateString()} • Atualizada em {new Date(q.updatedAt).toLocaleDateString()}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    background: #1d4ed8;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.2s;
  }

  .btn:hover {
    background: #1e40af;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #059669;
  }

  .btn-secondary:hover {
    background: #047857;
  }

  .export-option {
    width: 100%;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .export-option:hover {
    border-color: #1d4ed8;
    background: #eff6ff;
  }

  .export-option:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
