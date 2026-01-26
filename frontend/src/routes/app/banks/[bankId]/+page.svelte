<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  export let data;

  let bank = null;
  let questions = [];
  let loading = true;
  let error = "";

  // Available labels and chapter tags for filters
  let availableLabels = [];
  let availableChapterTags = [];

  // filtros
  let fType = "ALL";
  let fStatus = "ALL";
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

  function typeLabel(type) {
    return {
      MULTIPLE_CHOICE: "Escolha múltipla",
      TRUE_FALSE: "V/F",
      SHORT_ANSWER: "Resposta curta",
      OPEN: "Aberta"
    }[type] || type;
  }

  function badgeStyle(kind, value) {
    // estilos simples e consistentes
    const base = "display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:12px; border:1px solid var(--border); background:#fff;";

    if (kind === "status") {
      const map = {
        DRAFT: "background:#fff7ed; border-color:#fed7aa;",
        IN_REVIEW: "background:#eff6ff; border-color:#bfdbfe;",
        APPROVED: "background:#ecfdf5; border-color:#bbf7d0;"
      };
      return base + (map[value] || "");
    }

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

  $: filtered = questions.filter((q) => {
    if (fType !== "ALL" && q.type !== fType) return false;
    if (fStatus !== "ALL" && q.status !== fStatus) return false;
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

    <div style="margin-top: 14px; display: flex; gap: 10px;">
      <a class="btn" href={`/app/banks/${bank._id}/questions/new`}>+ Nova questão</a>
      <a class="btn" href="/app/banks">Voltar aos bancos</a>
    </div>
  </div>

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
        <label style="font-size: 13px; color: var(--muted);">Status</label>
        <select bind:value={fStatus} style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;">
          <option value="ALL">Todos</option>
          <option value="DRAFT">DRAFT</option>
          <option value="IN_REVIEW">IN_REVIEW</option>
          <option value="APPROVED">APPROVED</option>
        </select>
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted);">Origem</label>
        <select bind:value={fSource} style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;">
          <option value="ALL">Todas</option>
          <option value="MANUAL">MANUAL</option>
          <option value="AI">AI</option>
          <option value="IMPORTED">IMPORTED</option>
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
      <label style="font-size: 13px; color: var(--muted);">Pesquisa (stem/tags)</label>
      <input
        bind:value={search}
        placeholder="ex.: simplex, restrições, dualidade..."
        style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
      />
    </div>

    <!-- Labels Filter -->
    <div style="margin-top: 10px;">
      <label style="font-size: 13px; color: var(--muted);">Filtrar por Labels</label>
      <div style="margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; max-height: 120px; overflow-y: auto; background: white;">
        {#if availableLabels.length === 0}
          <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma label disponível</p>
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
      <label style="font-size: 13px; color: var(--muted);">Filtrar por Chapter Tags</label>
      <div style="margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; max-height: 120px; overflow-y: auto; background: white;">
        {#if availableChapterTags.length === 0}
          <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma tag disponível</p>
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
              <div style="display:flex; gap: 8px; flex-wrap: wrap;">
                <span style={badgeStyle("type", q.type)}>{typeLabel(q.type)}</span>
                <span style={badgeStyle("status", q.status)}>{q.status}</span>
                <span style={badgeStyle("source", q.source)}>{q.source}</span>
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
            {#if (q.labels || []).length > 0}
              <div style="margin-top: 10px; display:flex; gap:6px; flex-wrap: wrap;">
                {#each q.labels as label}
                  <span style="display:inline-flex; padding:3px 8px; border-radius:999px; font-size:12px; border:1px solid #a5f3fc; background:#ecfeff; color:#155e75;">
                    📝 {typeof label === 'string' ? label : label.name}
                  </span>
                {/each}
              </div>
            {/if}

            <!-- Chapter Tags -->
            {#if (q.chapterTags || []).length > 0}
              <div style="margin-top: 10px; display:flex; gap:6px; flex-wrap: wrap;">
                {#each q.chapterTags as tag}
                  <span style="display:inline-flex; padding:3px 8px; border-radius:999px; font-size:12px; border:1px solid #c4b5fd; background:#f5f3ff; color:#6b21a8;">
                    📚 {typeof tag === 'string' ? tag : tag.name}
                  </span>
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
