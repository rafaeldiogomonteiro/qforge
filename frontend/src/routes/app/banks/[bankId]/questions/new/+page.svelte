<script>
  import { api } from "$lib/api/client";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  export let data;
  const bankId = data.bankId;
  const storageKey = `question-draft-${bankId}`;

  const TYPES = [
    { value: "MULTIPLE_CHOICE", label: "Escolha múltipla" },
    { value: "TRUE_FALSE", label: "Verdadeiro / Falso" },
    { value: "SHORT_ANSWER", label: "Resposta curta" },
    { value: "OPEN", label: "Resposta aberta" }
  ];

  const DIFFICULTY_LABELS = {
    1: "Básico",
    2: "Normal",
    3: "Difícil",
    4: "Muito Difícil"
  };

  // Available labels and capítulos
  let availableLabels = [];
  let groupedChapterTags = [];
  let availableChapterTags = [];
  let chapterFoldersOpen = new Set();

  // Estado do formulário
  let type = "MULTIPLE_CHOICE";
  let stem = "";
  let difficulty = 2; // 1-4
  let selectedLabels = []; // array of label IDs
  let selectedChapterTags = []; // array of chapter tag IDs
  let acceptableAnswersText = ""; // linhas (para SHORT_ANSWER)
  let autosaveReady = false;
  let showLabelsPanel = false;
  let showChapterTagsPanel = false;

  function loadDraft() {
    if (!browser) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const draft = JSON.parse(raw);

      type = draft.type ?? type;
      stem = draft.stem ?? "";
      difficulty = draft.difficulty ?? 2;
      selectedLabels = draft.selectedLabels ?? [];
      selectedChapterTags = draft.selectedChapterTags ?? [];
      acceptableAnswersText = draft.acceptableAnswersText ?? "";

      if (Array.isArray(draft.options)) {
        options = draft.options;
      } else if (draft.type) {
        applyTypeDefaults(draft.type);
      }
    } catch (e) {
      console.warn("Falha ao carregar rascunho da questão.", e);
    }
  }

  function toggleChapterFolder(folderId) {
    const key = folderId ? String(folderId) : "__none__";
    const next = new Set(chapterFoldersOpen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    chapterFoldersOpen = next;
  }
  function saveDraft(draftData) {
    if (!browser || !autosaveReady) return;

    const draft =
      draftData ||
      {
        type,
        stem,
        difficulty,
        selectedLabels,
        selectedChapterTags,
        acceptableAnswersText,
        options
      };

    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (e) {
      console.warn("Falha ao guardar rascunho da questão.", e);
    }
  }

  function clearDraftStorage() {
    if (!browser) return;
    localStorage.removeItem(storageKey);
  }

  onMount(async () => {
    loadDraft();
    autosaveReady = true;

    // Load available labels and chapter tags
    try {
      const [labelsRes, chapterTagsRes] = await Promise.all([
        api.get("/labels"),
        api.get("/chapter-tags/grouped")
      ]);
      availableLabels = labelsRes.data || [];
      groupedChapterTags = Array.isArray(chapterTagsRes.data) ? chapterTagsRes.data : [];
      availableChapterTags = groupedChapterTags.flatMap((g) => g.tags || []);
    } catch (e) {
      console.error("Erro ao carregar labels/tags:", e);
    }
  });

  $: autosaveReady &&
    saveDraft({
      type,
      stem,
      difficulty,
      selectedLabels,
      selectedChapterTags,
      acceptableAnswersText,
      options
    });

  // options[] (para MULTIPLE_CHOICE e TRUE_FALSE)
  let options = [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false }
  ];

  // TRUE_FALSE: por defeito já metemos 2 opções editáveis
  function applyTypeDefaults(nextType) {
    type = nextType;

    if (type === "TRUE_FALSE") {
      options = [
        { text: "Verdadeiro", isCorrect: true },
        { text: "Falso", isCorrect: false }
      ];
    } else if (type === "MULTIPLE_CHOICE") {
      options = [
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false }
      ];
    } else {
      // SHORT_ANSWER e OPEN não precisam de options
      options = [];
    }
  }

  function addOption() {
    options = [...options, { text: "", isCorrect: false }];
  }

  function removeOption(idx) {
    options = options.filter((_, i) => i !== idx);
  }

  function setCorrectSingle(idx) {
    // manter "uma correta" por simplicidade e consistência no UI
    options = options.map((o, i) => ({ ...o, isCorrect: i === idx }));
  }

  function parseAcceptableAnswers() {
    return acceptableAnswersText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function validate() {
    if (!stem.trim()) return "O enunciado (stem) é obrigatório.";

    if (difficulty < 1 || difficulty > 4) return "A dificuldade tem de ser entre 1 e 4.";

    if (type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE") {
      if (!options || options.length < 2) return "Tens de ter pelo menos 2 opções.";

      const cleaned = options.map((o) => ({ ...o, text: (o.text || "").trim() }));
      if (cleaned.some((o) => !o.text)) return "Todas as opções têm de ter texto.";

      const correctCount = cleaned.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) return "Escolhe exatamente 1 opção correta.";

      if (type === "TRUE_FALSE" && options.length !== 2) return "TRUE_FALSE deve ter exatamente 2 opções.";
    }

    if (type === "SHORT_ANSWER") {
      const aa = parseAcceptableAnswers();
      if (aa.length === 0) return "Em SHORT_ANSWER, indica pelo menos 1 resposta aceitável.";
    }

    return null;
  }

  let loading = false;
  let error = "";

  async function submit() {
    error = "";
    const validationError = validate();
    if (validationError) {
      error = validationError;
      return;
    }

    loading = true;

    try {
      const payload = {
        type,
        stem: stem.trim(),
        difficulty: Number(difficulty),
        labels: selectedLabels,
        chapterTags: selectedChapterTags,
        source: "MANUAL",
      };

      if (type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE") {
        payload.options = options.map((o) => ({
          text: o.text.trim(),
          isCorrect: Boolean(o.isCorrect)
        }));
      }

      if (type === "SHORT_ANSWER") {
        payload.acceptableAnswers = parseAcceptableAnswers();
      }

      await api.post(`/banks/${bankId}/questions`, payload);

      clearDraftStorage();
      await goto(`/app/banks/${bankId}`);
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao criar questão.";
    } finally {
      loading = false;
    }
  }
</script>

<div style="max-width: 820px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <div style="display:flex; align-items:flex-end; justify-content:space-between; gap: 16px;">
    <div>
      <h2 style="margin: 0;">Nova Questão</h2>
      <p style="margin: 6px 0 0; color: var(--muted);">
        Banco:
        <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
          {bankId}
        </span>
      </p>
    </div>

    <a class="btn" href={`/app/banks/${bankId}`}>Voltar</a>
  </div>

  <form on:submit|preventDefault={submit} style="margin-top: 16px; display: grid; gap: 12px;">
    <!-- Tipo -->
    <div>
      <label style="font-size: 14px;">Tipo</label>
      <select
        value={type}
        on:change={(e) => applyTypeDefaults(e.target.value)}
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
      >
        {#each TYPES as t}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
    </div>

    <!-- Dificuldade -->
    <div>
      <label style="font-size: 14px;">Dificuldade</label>
      <select
        bind:value={difficulty}
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
      >
        {#each Object.entries(DIFFICULTY_LABELS) as [value, label]}
          <option value={Number(value)}>{value} - {label}</option>
        {/each}
      </select>
    </div>

    <!-- Stem -->
    <div>
      <label style="font-size: 14px;">Enunciado</label>
      <textarea
        bind:value={stem}
        rows="5"
        placeholder="Escreve o enunciado da questão..."
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
      />
    </div>

    <!-- Labels -->
    <div>
      <button
        type="button"
        class="btn"
        on:click={() => (showLabelsPanel = !showLabelsPanel)}
        style="width: 100%; justify-content: space-between; display: flex; align-items: center;"
      >
        <span>Labels (opcional){#if selectedLabels.length > 0} — {selectedLabels.length} selecionada(s){/if}</span>
        <span style="font-size: 12px; color: var(--muted);">{showLabelsPanel ? "Esconder ▲" : "Mostrar ▼"}</span>
      </button>

      {#if showLabelsPanel}
        <div style="margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; max-height: 180px; overflow-y: auto; background: white;">
          {#if availableLabels.length === 0}
            <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma label disponível. <a href="/app/labels">Criar labels</a></p>
          {:else}
            <div style="display: grid; gap: 8px;">
              {#each availableLabels as label}
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px; border-radius: 8px; transition: background 0.2s;" class="checkbox-hover">
                  <input
                    type="checkbox"
                    value={label._id}
                    checked={selectedLabels.includes(label._id)}
                    on:change={(e) => {
                      if (e.target.checked) {
                        selectedLabels = [...selectedLabels, label._id];
                      } else {
                        selectedLabels = selectedLabels.filter(id => id !== label._id);
                      }
                    }}
                    style="width: 16px; height: 16px;"
                  />
                  <span style="font-size: 14px; padding: 4px 10px; border-radius: 999px; background: #ecfeff; border: 1px solid #a5f3fc;">
                    🏷️ {label.name}
                  </span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Capítulos -->
    <div>
      <button
        type="button"
        class="btn"
        on:click={() => (showChapterTagsPanel = !showChapterTagsPanel)}
        style="width: 100%; justify-content: space-between; display: flex; align-items: center;"
      >
        <span>Capítulos (opcional){#if selectedChapterTags.length > 0} — {selectedChapterTags.length} selecionado(s){/if}</span>
        <span style="font-size: 12px; color: var(--muted);">{showChapterTagsPanel ? "Esconder ▲" : "Mostrar ▼"}</span>
      </button>

      {#if showChapterTagsPanel}
        <div style="margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; max-height: 220px; overflow-y: auto; display: grid; gap: 10px;">
          {#if availableChapterTags.length === 0}
            <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhum capítulo disponível. <a href="/app/chapter-tags">Criar capítulos</a></p>
          {:else}
            {#each groupedChapterTags as group}
              <div style="border: 1px solid var(--border); border-radius: 10px; padding: 10px;">
                <button
                  type="button"
                  on:click={() => toggleChapterFolder(group.folder?._id || "")}
                  style="width:100%; display:flex; justify-content: space-between; align-items:center; gap:8px; background:none; border:none; cursor:pointer;"
                >
                  <strong style="font-size: 14px; display:flex; align-items:center; gap:6px;">
                    {group.folder ? "📂" : "📁"} {group.folder ? group.folder.name : "Sem pasta"} ({(group.tags || []).length})
                  </strong>
                  <span style="font-size:12px; color: var(--muted);">{chapterFoldersOpen.has(group.folder?._id || "__none__") ? "▲" : "▼"}</span>
                </button>

                {#if chapterFoldersOpen.has(group.folder?._id || "__none__")}
                  {#if (group.tags || []).length === 0}
                    <div style="color: var(--muted); font-size: 13px; margin-top:6px;">Sem capítulos nesta pasta.</div>
                  {:else}
                    <div style="display: grid; gap: 6px; margin-top:8px;">
                      {#each group.tags as tag}
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px; border-radius: 8px; transition: background 0.2s;" class="checkbox-hover">
                          <input
                            type="checkbox"
                            value={tag._id}
                            checked={selectedChapterTags.includes(tag._id)}
                            on:change={(e) => {
                              if (e.target.checked) {
                                selectedChapterTags = [...selectedChapterTags, tag._id];
                              } else {
                                selectedChapterTags = selectedChapterTags.filter(id => id !== tag._id);
                              }
                            }}
                            style="width: 16px; height: 16px;"
                          />
                          <span style="font-size: 14px; padding: 4px 10px; border-radius: 999px; background: #f5f3ff; border: 1px solid #c4b5fd;">
                            📑 {tag.name}
                          </span>
                        </label>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Options -->
    {#if type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE"}
      <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="font-weight: 600;">Opções</div>

          {#if type === "MULTIPLE_CHOICE"}
            <button class="btn" type="button" on:click={addOption}>
              + Adicionar opção
            </button>
          {/if}
        </div>

        <p style="margin: 8px 0 0; color: var(--muted); font-size: 13px;">
          Marca exatamente <b>1</b> opção correta.
        </p>

        <div style="margin-top: 10px; display:grid; gap: 10px;">
          {#each options as opt, idx (idx)}
            <div style="display:grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items:center;">
              <input
                type="radio"
                name="correct"
                checked={opt.isCorrect}
                on:change={() => setCorrectSingle(idx)}
              />

              <input
                value={opt.text}
                placeholder={`Opção ${idx + 1}`}
                on:input={(e) => {
                  const next = [...options];
                  next[idx] = { ...next[idx], text: e.target.value };
                  options = next;
                }}
                style="padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
              />

              {#if type === "MULTIPLE_CHOICE" && options.length > 2}
                <button class="btn" type="button" on:click={() => removeOption(idx)}>
                  Remover
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Acceptable answers -->
    {#if type === "SHORT_ANSWER"}
      <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px;">
        <div style="font-weight: 600;">Respostas aceitáveis</div>
        <p style="margin: 8px 0 0; color: var(--muted); font-size: 13px;">
          Uma resposta por linha.
        </p>

        <textarea
          bind:value={acceptableAnswersText}
          rows="4"
          placeholder="ex.: 20&#10;vinte"
          style="width: 100%; margin-top: 10px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
        />
      </div>
    {/if}

    {#if error}
      <div style="color: #b91c1c; font-size: 14px;">{error}</div>
    {/if}

    <div style="display:flex; gap: 10px; margin-top: 4px;">
      <button class="btn" type="submit" disabled={loading} style="padding: 10px 14px;">
        {loading ? "A guardar..." : "Guardar"}
      </button>

      <a
        class="btn"
        href={`/app/banks/${bankId}`}
        on:click={clearDraftStorage}
        style="padding: 10px 14px; text-decoration:none; display:inline-flex; align-items:center;"
      >
        Cancelar
      </a>
    </div>
  </form>
</div>
