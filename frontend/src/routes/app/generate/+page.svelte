<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";

  const DIFFICULTY_LABELS = {
    1: "Básico",
    2: "Normal",
    3: "Difícil",
    4: "Muito Difícil"
  };

  // bancos (para escolher destino se quiseres guardar)
  let banks = [];
  let banksLoading = true;

  // Available labels and chapter tags
  let availableLabels = [];
  let groupedChapterTags = [];
  let availableChapterTags = [];
  let chapterFoldersOpen = new Set();

  // form
  let bankId = ""; // opcional
  let topic = "";
  let content = "";
  let numQuestions = 5;

  let types = ["MULTIPLE_CHOICE"];
  let difficulties = [2];

  let selectedLabels = []; // array of label IDs
  let selectedChapterTags = []; // array of chapter tag IDs
  let showLabelsBox = false;
  let showChapterTagsBox = false;

  let language = "pt-PT";
  let additionalInstructions = "";

  // resultado
  let generating = false;
  let error = "";
  let generated = []; // array de Question
  
  // confirmation modal
  let showConfirmModal = false;
  
  // save to bank modal
  let showSaveToBankModal = false;
  let savingToBank = false;
  let selectedBankForSave = "";

  // autosave
  const storageKey = "ai-generate-draft";
  let autosaveReady = false;

  function loadDraft() {
    if (!browser) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const draft = JSON.parse(raw);

      bankId = draft.bankId ?? "";
      topic = draft.topic ?? "";
      content = draft.content ?? "";
      numQuestions = Number(draft.numQuestions) || 5;
      types = Array.isArray(draft.types) && draft.types.length ? draft.types : ["MULTIPLE_CHOICE"];
      difficulties = Array.isArray(draft.difficulties) && draft.difficulties.length ? draft.difficulties : [2];
      selectedLabels = draft.selectedLabels ?? [];
      selectedChapterTags = draft.selectedChapterTags ?? [];
      language = draft.language ?? "pt-PT";
      additionalInstructions = draft.additionalInstructions ?? "";
    } catch (e) {
      console.warn("Falha ao carregar rascunho da geração de questões.", e);
    }
  }

  function saveDraft(draftData) {
    if (!browser || !autosaveReady) return;

    const draft =
      draftData ||
      {
        bankId,
        topic,
        content,
        numQuestions,
        types,
        difficulties,
        selectedLabels,
        selectedChapterTags,
        language,
        additionalInstructions
      };

    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (e) {
      console.warn("Falha ao guardar rascunho da geração de questões.", e);
    }
  }

  onMount(() => {
    loadDraft();
    autosaveReady = true;
    loadBanks();
  });

  $: autosaveReady &&
    saveDraft({
      bankId,
      topic,
      content,
      numQuestions,
      types,
      difficulties,
      selectedLabels,
      selectedChapterTags,
      language,
      additionalInstructions
    });

  async function loadBanks() {
    banksLoading = true;
    try {
      const [banksRes, labelsRes, chapterTagsRes] = await Promise.all([
        api.get("/banks"),
        api.get("/labels"),
        api.get("/chapter-tags/grouped")
      ]);
      
      banks = banksRes.data?.data ?? [];
      availableLabels = labelsRes.data || [];
      groupedChapterTags = Array.isArray(chapterTagsRes.data) ? chapterTagsRes.data : [];
      availableChapterTags = groupedChapterTags.flatMap((g) => g.tags || []);

      // Se o bankId guardado não está na lista atual (pode ter sido de outra conta ou removido), limpa-o para evitar 403 inesperados
      const bankStillExists = banks.some((b) => String(b._id) === String(bankId));
      if (bankId && !bankStillExists) {
        bankId = "";
        selectedBankForSave = "";
      }
    } catch (e) {
      // não bloqueia a página
      banks = [];
    } finally {
      banksLoading = false;
    }
  }

  function toggleChapterFolder(folderId) {
    const key = folderId ? String(folderId) : "__none__";
    const next = new Set(chapterFoldersOpen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    chapterFoldersOpen = next;
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

  function validate() {
    if (!topic.trim() && !content.trim()) {
      return "Indica pelo menos um tema ou conteúdo para gerar.";
    }
    if (numQuestions < 1 || numQuestions > 50) {
      return "O número de questões deve estar entre 1 e 50.";
    }
    return null;
  }

  function openConfirmModal() {
    const v = validate();
    if (v) {
      error = v;
      return;
    }
    showConfirmModal = true;
  }
  
  function closeConfirmModal() {
    showConfirmModal = false;
  }
  
  async function confirmAndGenerate() {
    showConfirmModal = false;
    await generate();
  }
  
  async function generate() {
    error = "";
    generated = [];

    const v = validate();
    if (v) {
      error = v;
      return;
    }

    generating = true;

    try {
      const chapterTagNames = selectedChapterTags
        .map((id) => availableChapterTags.find((t) => String(t._id) === String(id))?.name)
        .filter(Boolean);

      const payload = {
        bankId: bankId || undefined,
        topic: topic || undefined,
        content: content || undefined,
        numQuestions: Number(numQuestions),
        types,
        difficulties,
        chapterTags: chapterTagNames,
        labels: selectedLabels,
        language,
        additionalInstructions,
        saveToBank: Boolean(bankId) // Se tiver banco selecionado, guarda automaticamente
      };

      const { data } = await api.post("/ai/generate-questions", payload);

      // Backend retorna { success: true, questions: [...] }
      generated = data?.questions || [];
      
      console.log('Questões geradas:', generated);
  } catch (e) {
    error =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      "Erro ao gerar questões com IA.";
  } finally {
    generating = false;
  }
}
  
  function openSaveToBankModal() {
    selectedBankForSave = bankId || "";
    showSaveToBankModal = true;
  }
  
  function closeSaveToBankModal() {
    showSaveToBankModal = false;
    selectedBankForSave = "";
  }
  
  async function saveQuestionsToBank() {
    if (!selectedBankForSave) {
      error = "Seleciona um banco.";
      return;
    }
    
    savingToBank = true;
    error = "";
    
    try {
      // Criar cada questão no banco
      for (const q of generated) {
        await api.post(`/banks/${selectedBankForSave}/questions`, {
          ...q
        });
      }
      
      showSaveToBankModal = false;
      bankId = selectedBankForSave; // Atualizar bankId para refletir que foi guardado
      alert(`${generated.length} questões guardadas com sucesso!`);
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao guardar questões.";
    } finally {
      savingToBank = false;
    }
  }
</script>

<div style="display:flex; align-items:flex-end; justify-content:space-between; gap:16px;">
  <div>
    <h2 style="margin:0;">Geração de questões (IA)</h2>
    <p style="margin:6px 0 0; color: var(--muted);">
      Gera questões por tema/conteúdo, com tipos e dificuldades configuráveis.
    </p>
  </div>
</div>

<div style="margin-top: 16px; display:grid; grid-template-columns: 1fr; gap: 16px;">
  <!-- FORM -->
  <div style="background:white; border:1px solid var(--border); border-radius:14px; padding:16px;">
    <form on:submit|preventDefault={generate} style="display:grid; gap: 12px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="font-size: 13px; color: var(--muted);">Nº questões</label>
          <input
            type="number"
            min="1"
            max="50"
            bind:value={numQuestions}
            style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
          />
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted);">Idioma</label>
          <select bind:value={language} style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;">
            <option value="pt-PT">pt-PT</option>
            <option value="en">en</option>
            <option value="pt-BR">pt-BR</option>
          </select>
        </div>
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted);">Tema</label>
        <input
          bind:value={topic}
          placeholder="ex.: Programação Linear — Método Simplex"
          style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
        />
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted);">Conteúdo (opcional)</label>
        <textarea
          bind:value={content}
          rows="4"
          placeholder="Cola aqui matéria / resumo / excerto do manual..."
          style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
        />
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="font-size: 13px; color: var(--muted); margin-bottom: 6px; display: block;">Tipos de Questões</label>
          <div style="border: 1px solid var(--border); border-radius: 10px; padding: 12px; background: white;">
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
              <input
                type="checkbox"
                value="MULTIPLE_CHOICE"
                checked={types.includes("MULTIPLE_CHOICE")}
                on:change={(e) => {
                  if (e.target.checked) {
                    types = [...types, "MULTIPLE_CHOICE"];
                  } else {
                    types = types.filter(t => t !== "MULTIPLE_CHOICE");
                  }
                }}
                style="width: 16px; height: 16px;"
              />
              <span style="font-size: 14px;">📝 Escolha múltipla</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
              <input
                type="checkbox"
                value="TRUE_FALSE"
                checked={types.includes("TRUE_FALSE")}
                on:change={(e) => {
                  if (e.target.checked) {
                    types = [...types, "TRUE_FALSE"];
                  } else {
                    types = types.filter(t => t !== "TRUE_FALSE");
                  }
                }}
                style="width: 16px; height: 16px;"
              />
              <span style="font-size: 14px;">✓✗ Verdadeiro/Falso</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
              <input
                type="checkbox"
                value="SHORT_ANSWER"
                checked={types.includes("SHORT_ANSWER")}
                on:change={(e) => {
                  if (e.target.checked) {
                    types = [...types, "SHORT_ANSWER"];
                  } else {
                    types = types.filter(t => t !== "SHORT_ANSWER");
                  }
                }}
                style="width: 16px; height: 16px;"
              />
              <span style="font-size: 14px;">✍️ Resposta curta</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input
                type="checkbox"
                value="OPEN"
                checked={types.includes("OPEN")}
                on:change={(e) => {
                  if (e.target.checked) {
                    types = [...types, "OPEN"];
                  } else {
                    types = types.filter(t => t !== "OPEN");
                  }
                }}
                style="width: 16px; height: 16px;"
              />
              <span style="font-size: 14px;">📄 Aberta</span>
            </label>
          </div>
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted); margin-bottom: 6px; display: block;">Níveis de Dificuldade</label>
          <div style="border: 1px solid var(--border); border-radius: 10px; padding: 12px; background: white;">
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
              <input
                type="checkbox"
                value={1}
                checked={difficulties.includes(1)}
                on:change={(e) => {
                  if (e.target.checked) {
                    difficulties = [...difficulties, 1];
                  } else {
                    difficulties = difficulties.filter(d => d !== 1);
                  }
                }}
                style="width: 16px; height: 16px;"
              />
              <span style="font-size: 14px; padding: 4px 10px; border-radius: 999px; background: #ecfeff; border: 1px solid #a5f3fc;">1 - Básico</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
              <input
                type="checkbox"
                value={2}
                checked={difficulties.includes(2)}
                on:change={(e) => {
                  if (e.target.checked) {
                    difficulties = [...difficulties, 2];
                  } else {
                    difficulties = difficulties.filter(d => d !== 2);
                  }
                }}
                style="width: 16px; height: 16px;"
              />
              <span style="font-size: 14px; padding: 4px 10px; border-radius: 999px; background: #f0fdf4; border: 1px solid #bbf7d0;">2 - Normal</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
              <input
                type="checkbox"
                value={3}
                checked={difficulties.includes(3)}
                on:change={(e) => {
                  if (e.target.checked) {
                    difficulties = [...difficulties, 3];
                  } else {
                    difficulties = difficulties.filter(d => d !== 3);
                  }
                }}
                style="width: 16px; height: 16px;"
              />
              <span style="font-size: 14px; padding: 4px 10px; border-radius: 999px; background: #fffbeb; border: 1px solid #fde68a;">3 - Difícil</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input
                type="checkbox"
                value={4}
                checked={difficulties.includes(4)}
                on:change={(e) => {
                  if (e.target.checked) {
                    difficulties = [...difficulties, 4];
                  } else {
                    difficulties = difficulties.filter(d => d !== 4);
                  }
                }}
                style="width: 16px; height: 16px;"
              />
              <span style="font-size: 14px; padding: 4px 10px; border-radius: 999px; background: #fef2f2; border: 1px solid #fecaca;">4 - Muito Difícil</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Etiquetas -->
      <div>
        <button
          type="button"
          class="btn"
          on:click={() => (showLabelsBox = !showLabelsBox)}
          style="width: 100%; justify-content: space-between; display: flex; align-items: center;"
        >
          <span>Etiquetas (opcional){#if selectedLabels.length > 0} — {selectedLabels.length} selecionada(s){/if}</span>
          <span style="font-size: 12px; color: var(--muted);">{showLabelsBox ? "Esconder ▲" : "Mostrar ▼"}</span>
        </button>

        {#if showLabelsBox}
          <div style="border: 1px solid var(--border); border-radius: 10px; padding: 12px; max-height: 180px; overflow-y: auto; background: white; margin-top: 6px;">
            {#if availableLabels.length === 0}
              <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma etiqueta disponível. <a href="/app/labels" style="color: #1d4ed8;">Criar etiquetas</a></p>
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
                      📝 {label.name}
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
          on:click={() => (showChapterTagsBox = !showChapterTagsBox)}
          style="width: 100%; justify-content: space-between; display: flex; align-items: center;"
        >
          <span>Capítulos (opcional){#if selectedChapterTags.length > 0} — {selectedChapterTags.length} selecionada(s){/if}</span>
          <span style="font-size: 12px; color: var(--muted);">{showChapterTagsBox ? "Esconder ▲" : "Mostrar ▼"}</span>
        </button>

        {#if showChapterTagsBox}
          <div style="border: 1px solid var(--border); border-radius: 10px; padding: 12px; max-height: 220px; overflow-y: auto; background: white; margin-top: 6px; display: grid; gap: 10px;">
            {#if availableChapterTags.length === 0}
              <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma capítulo disponível. <a href="/app/chapter-tags" style="color: #7c3aed;">Criar etiquetas</a></p>
            {:else}
              {#each groupedChapterTags as group}
                {#if group}
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
                        <div style="color: var(--muted); font-size: 13px; margin-top:6px;">Sem etiquetas nesta pasta.</div>
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
                {/if}
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted);">Instruções adicionais</label>
        <textarea
          bind:value={additionalInstructions}
          rows="3"
          placeholder="ex.: evita perguntas demasiado teóricas; inclui 1 exemplo numérico..."
          style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
        />
      </div>

      {#if error}
        <div style="color:#b91c1c; font-size:14px;">{error}</div>
      {/if}

      <div style="display:flex; gap:10px;">
        <button class="btn" type="button" on:click={openConfirmModal} disabled={generating} style="padding:10px 14px;">
          {generating ? "A gerar..." : "Gerar"}
        </button>

      </div>
    </form>
  </div>

  <!-- PREVIEW -->
  <div style="background:white; border:1px solid var(--border); border-radius:14px; padding:16px;">
    <h3 style="margin:0 0 10px 0;">Pré-visualização</h3>

    {#if generated.length === 0}
      <p style="margin:0; color: var(--muted);">Ainda não geraste questões.</p>
    {:else}
      <div style="display:grid; gap: 12px;">
        {#each generated as q}
          <div style="border:1px solid var(--border); border-radius:12px; padding:14px;">
            <div style="display:flex; justify-content:space-between; gap: 12px;">
              <div style="font-weight:600;">{typeLabel(q.type)} • D {q.difficulty}/4</div>
              <div style="font-size:13px; color: var(--muted);">{sourceLabel(q.source || "AI")}</div>
            </div>

            <div style="margin-top:8px;">{q.stem}</div>

            {#if q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE"}
              <ul style="margin-top:8px; padding-left: 18px;">
                {#each (q.options || []) as opt}
                  <li style="color: {opt.isCorrect ? '#15803d' : 'inherit'};">
                    {opt.text}
                  </li>
                {/each}
              </ul>
            {/if}

            {#if q.type === "SHORT_ANSWER"}
              <div style="margin-top:8px; color: var(--muted); font-size: 13px;">
                Respostas aceitáveis: {(q.acceptableAnswers || []).join(", ")}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
        <button class="btn btn-confirm" type="button" on:click={openSaveToBankModal}>
          💾 Guardar no banco
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- Confirmation Modal -->
{#if showConfirmModal}
  <div class="modal-overlay" on:click={closeConfirmModal}>
    <div class="modal-content" on:click|stopPropagation>
      <h3 style="margin: 0 0 16px 0; font-size: 18px;">Confirmar Geração</h3>
      <p style="margin: 0 0 24px 0; color: var(--muted); line-height: 1.5;">
        Tem a certeza que deseja gerar {numQuestions} {numQuestions === 1 ? 'questão' : 'questões'} com IA?
        {#if bankId}
          <br/><strong style="color: var(--text);">As questões serão guardadas no banco selecionado.</strong>
        {/if}
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn" type="button" on:click={closeConfirmModal}>
          Cancelar
        </button>
        <button 
          class="btn btn-confirm" 
          type="button" 
          on:click={confirmAndGenerate}
        >
          Confirmar
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Save to Bank Modal -->
{#if showSaveToBankModal}
  <div class="modal-overlay" on:click={closeSaveToBankModal}>
    <div class="modal-content" on:click|stopPropagation>
      <h3 style="margin: 0 0 16px 0; font-size: 18px;">Guardar no banco</h3>
      <p style="margin: 0 0 12px 0; color: var(--muted); line-height: 1.5;">
        Seleciona o banco onde pretendes guardar as {generated.length} {generated.length === 1 ? 'questão' : 'questões'}:
      </p>
      
      <select 
        bind:value={selectedBankForSave}
        style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 20px;"
      >
        <option value="">-- Selecionar banco --</option>
        {#each banks as bank}
          <option value={bank._id}>{bank.title}</option>
        {/each}
      </select>
      
      {#if error}
        <div style="color: #b91c1c; font-size: 14px; margin-bottom: 16px;">{error}</div>
      {/if}
      
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn" type="button" on:click={closeSaveToBankModal} disabled={savingToBank}>
          Cancelar
        </button>
        <button 
          class="btn btn-confirm" 
          type="button" 
          on:click={saveQuestionsToBank}
          disabled={savingToBank || !selectedBankForSave}
        >
          {savingToBank ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .btn {
    padding: 10px 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;
  }

  .btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-confirm {
    background: #3b82f6 !important;
    color: white !important;
    border-color: #3b82f6 !important;
  }
  
  .btn-confirm:hover:not(:disabled) {
    background: #2563eb !important;
    border-color: #2563eb !important;
  }
  
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }
  
  .modal-content {
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    animation: modalFadeIn 0.2s ease-out;
  }
  
  @keyframes modalFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .checkbox-hover:hover {
    background: #f3f4f6;
  }
</style>
