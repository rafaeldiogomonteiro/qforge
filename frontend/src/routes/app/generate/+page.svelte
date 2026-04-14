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

  onMount(async () => {
    loadDraft();
    autosaveReady = true;
    try {
      await loadBanks();
    } catch (err) {
      console.error("Erro ao carregar dados iniciais:", err);
      error = "Falha ao carregar dados. Por favor, verifique se está autenticado.";
    }
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
      const labelNames = selectedLabels
        .map((id) => availableLabels.find((label) => String(label._id) === String(id))?.name)
        .filter(Boolean);

      const payload = {
        bankId: bankId || undefined,
        topic: topic || undefined,
        content: content || undefined,
        numQuestions: Number(numQuestions),
        types,
        difficulties,
        chapterTags: chapterTagNames,
        labels: labelNames,
        language,
        additionalInstructions,
        saveToBank: Boolean(bankId) // Se tiver banco selecionado, guarda automaticamente
      };

      const { data } = await api.post("/ai/generate-questions", payload);

      // Backend retorna { success: true, questions: [...] }
      generated = data?.questions || [];
      
      console.log('Questões geradas:', generated);
  } catch (e) {
    const status = e?.response?.status;

    if (status === 504) {
      error =
        "A geração de IA excedeu o tempo limite do servidor. Tenta novamente com menos questões ou menos conteúdo.";
    } else if (!e?.response && /network error/i.test(String(e?.message || ""))) {
      error =
        "Falha de ligação ao servidor (possível timeout/proxy). Tenta novamente dentro de instantes.";
    } else {
      error =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Erro ao gerar questões com IA.";
    }
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

<div style="display: flex; flex-direction: column; gap: 24px;">
  <!-- Header -->
  <div>
    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1e293b;">Gerar Questões com IA</h1>
    <p style="margin: 6px 0 0; font-size: 14px; color: #64748b;">
      Utilize inteligência artificial para criar questões personalizadas
    </p>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
    <!-- Left Column: Form -->
    <div style={generated.length > 0 ? "display: none;" : "display: flex; flex-direction: column;"}>
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 18px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">✨ Configuração</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px;">Nº questões</label>
            <input
              type="number"
              min="1"
              max="50"
              bind:value={numQuestions}
              style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;"
            />
          </div>

          <div>
            <label style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px;">Idioma</label>
            <select bind:value={language} style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; background: white;">
              <option value="pt-PT">pt-PT</option>
              <option value="en">en</option>
              <option value="pt-BR">pt-BR</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px;">Tema</label>
          <input
            bind:value={topic}
            placeholder="ex.: Programação Linear — Método Simplex"
            style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;"
          />
        </div>

        <div>
          <label style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px;">Conteúdo (opcional)</label>
          <textarea
            bind:value={content}
            rows="4"
            placeholder="Cola aqui matéria / resumo / excerto do manual..."
            style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: inherit;"
          />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-size: 13px; color: #64748b; margin-bottom: 8px; display: block;">Tipos de Questões</label>
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: white; display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
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
                  style="width: 16px; height: 16px; cursor: pointer;"
                />
                <span>📝 Escolha múltipla</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
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
                  style="width: 16px; height: 16px; cursor: pointer;"
                />
                <span>✓✗ V/F</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
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
                  style="width: 16px; height: 16px; cursor: pointer;"
                />
                <span>✍️ Resposta curta</span>
              </label>
            </div>
          </div>

          <div>
            <label style="font-size: 13px; color: #64748b; margin-bottom: 8px; display: block;">Dificuldade</label>
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: white; display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
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
                  style="width: 16px; height: 16px; cursor: pointer;"
                />
                <span style="padding: 2px 8px; border-radius: 12px; background: #ecfeff; border: 1px solid #a5f3fc;">Básico</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
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
                  style="width: 16px; height: 16px; cursor: pointer;"
                />
                <span style="padding: 2px 8px; border-radius: 12px; background: #f0fdf4; border: 1px solid #bbf7d0;">Normal</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
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
                  style="width: 16px; height: 16px; cursor: pointer;"
                />
                <span style="padding: 2px 8px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a;">Difícil</span>
              </label>
            </div>
          </div>
        </div>

        {#if error}
          <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; color: #991b1b; font-size: 13px;">
            {error}
          </div>
        {/if}

        <button
          style="padding: 12px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s;"
          type="button"
          on:click={openConfirmModal}
          disabled={generating}
        >
          {generating ? "A gerar..." : "✨ Gerar"}
        </button>
      </div>
    </div>

    <!-- Right Column: Results -->
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
      <h3 style="margin: 0 0 18px 0; font-size: 16px; font-weight: 600; color: #1e293b;">📋 Resultados</h3>

      {#if generated.length === 0}
        <p style="margin: 0; color: #64748b; font-size: 14px;">Gera questões para ver a pré-visualização aqui...</p>
      {:else}
        <div style="display: flex; flex-direction: column; gap: 12px; flex: 1; overflow-y: auto; max-height: 600px;">
          {#each generated as q}
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc;">
              <div style="font-weight: 600; font-size: 13px; color: #1e293b; margin-bottom: 8px;">
                {typeLabel(q.type)} • D {q.difficulty}/4
              </div>
              <div style="font-size: 13px; color: #1e293b; line-height: 1.5;">{q.stem}</div>

              {#if q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE"}
                <ul style="margin: 8px 0 0; padding-left: 18px; font-size: 12px;">
                  {#each (q.options || []) as opt}
                    <li style="color: {opt.isCorrect ? '#10b981' : '#1e293b'}; margin: 4px 0;">
                      {opt.text}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/each}
        </div>

        <div style="margin-top: 16px; display: flex; gap: 10px;">
          <button
            style="flex: 1; padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.15s;"
            type="button"
            on:click={() => (generated = [])}
          >
            ← Voltar
          </button>
          <button
            style="flex: 1; padding: 12px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s;"
            type="button"
            on:click={openSaveToBankModal}
          >
            💾 Guardar
          </button>
        </div>
      {/if}
    </div>
  </div>

<!-- Confirmation Modal -->
{#if showConfirmModal}
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" on:click={closeConfirmModal}>
    <div style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);" on:click|stopPropagation>
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1e293b;">Confirmar Geração</h3>
      <p style="margin: 0 0 24px 0; color: #64748b; line-height: 1.5; font-size: 14px;">
        Tem a certeza que deseja gerar {numQuestions} {numQuestions === 1 ? 'questão' : 'questões'} com IA?
        {#if bankId}
          <br/><strong style="color: #1e293b;">As questões serão guardadas no banco selecionado.</strong>
        {/if}
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button style="padding: 10px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px;" type="button" on:click={closeConfirmModal}>
          Cancelar
        </button>
        <button
          style="padding: 10px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;"
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
  <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" on:click={closeSaveToBankModal}>
    <div style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);" on:click|stopPropagation>
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1e293b;">Guardar no banco</h3>
      <p style="margin: 0 0 12px 0; color: #64748b; line-height: 1.5; font-size: 14px;">
        Seleciona o banco onde pretendes guardar as {generated.length} {generated.length === 1 ? 'questão' : 'questões'}:
      </p>

      <select
        bind:value={selectedBankForSave}
        style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; font-size: 14px; background: white;"
      >
        <option value="">-- Selecionar banco --</option>
        {#each banks as bank}
          <option value={bank._id}>{bank.title}</option>
        {/each}
      </select>

      {#if error}
        <div style="color: #991b1b; background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; font-size: 14px; margin-bottom: 16px;">{error}</div>
      {/if}

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button style="padding: 10px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px;" type="button" on:click={closeSaveToBankModal} disabled={savingToBank}>
          Cancelar
        </button>
        <button
          style="padding: 10px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; opacity: {savingToBank || !selectedBankForSave ? '0.5' : '1'};"
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

</div>

<style>
  .checkbox-hover:hover {
    background: #f8fafc;
  }
</style>
