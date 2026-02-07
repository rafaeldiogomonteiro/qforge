<script>
  import { api } from "$lib/api/client";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  export let data;
  const id = data.id;

  const DIFFICULTY_LABELS = {
    1: "Básico",
    2: "Normal",
    3: "Difícil",
    4: "Muito Difícil"
  };

  // Available labels e capítulos
  let availableLabels = [];
  let groupedChapterTags = [];
  let availableChapterTags = [];
  let chapterFoldersOpen = new Set();

  let loading = true;
  let saving = false;
  let error = "";

  // Campos editáveis
  let bankId = "";
  let type = "MULTIPLE_CHOICE";
  let stem = "";
  let difficulty = 2;
  let selectedLabels = []; // array de IDs
  let selectedChapterTags = []; // array de IDs
  let acceptableAnswersText = "";
  let source = "MANUAL";
  let showLabelsPanel = false;
  let showChapterTagsPanel = false;

  let options = [];

  // Tipos e origem não são editáveis

  function addOption() {
    options = [...options, { text: "", isCorrect: false }];
  }
  function removeOption(idx) {
    options = options.filter((_, i) => i !== idx);
  }
  function setCorrectSingle(idx) {
    options = options.map((o, i) => ({ ...o, isCorrect: i === idx }));
  }

  function toggleChapterFolder(folderId) {
    const key = folderId ? String(folderId) : "__none__";
    const next = new Set(chapterFoldersOpen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    chapterFoldersOpen = next;
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
      if (options.some((o) => !(o.text || "").trim())) return "Todas as opções têm de ter texto.";
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) return "Escolhe exatamente 1 opção correta.";
      if (type === "TRUE_FALSE" && options.length !== 2) return "TRUE_FALSE deve ter exatamente 2 opções.";
    }

    if (type === "SHORT_ANSWER") {
      if (parseAcceptableAnswers().length === 0) return "Em SHORT_ANSWER, indica pelo menos 1 resposta aceitável.";
    }

    return null;
  }

  function hydrate(q) {
    // garantir que bankId fica como string de ID
    bankId = typeof q.bank === "string" ? q.bank : q.bank?._id || "";
    type = q.type;
    stem = q.stem || "";
    difficulty = q.difficulty ?? 2;
    source = q.source || "MANUAL";

    // Extract label IDs
    selectedLabels = (q.labels || []).map(label => typeof label === 'string' ? label : label._id);
    
    // Extract chapter tag IDs
    selectedChapterTags = (q.chapterTags || []).map(tag => typeof tag === 'string' ? tag : tag._id);
    
    acceptableAnswersText = (q.acceptableAnswers || []).join("\n");

    options = Array.isArray(q.options)
      ? q.options.map((o) => ({ text: o.text ?? "", isCorrect: Boolean(o.isCorrect) }))
      : [];

    // garantir coerência com o tipo
    // opções ficam como vieram (sem permitir mudar tipo)
  }

  onMount(async () => {
    loading = true;
    error = "";

    try {
      const [questionRes, labelsRes, chapterTagsRes] = await Promise.all([
        api.get(`/questions/${id}`),
        api.get("/labels"),
        api.get("/chapter-tags/grouped")
      ]);
      
      availableLabels = labelsRes.data || [];
      groupedChapterTags = Array.isArray(chapterTagsRes.data) ? chapterTagsRes.data : [];
      availableChapterTags = groupedChapterTags.flatMap((g) => g.tags || []);
      
      hydrate(questionRes.data);
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao carregar a questão.";
    } finally {
      loading = false;
    }
  });

  async function save() {
    error = "";
    const validationError = validate();
    if (validationError) {
      error = validationError;
      return;
    }

    saving = true;

    try {
      const payload = {
        stem: stem.trim(),
        difficulty: Number(difficulty),
        labels: selectedLabels,
        chapterTags: selectedChapterTags
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

      await api.put(`/questions/${id}`, payload);

      if (bankId) await goto(`/app/banks/${bankId}`);
      else await goto("/app/banks");
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao guardar alterações.";
    } finally {
      saving = false;
    }
  }
</script>

{#if loading}
  <p style="color: var(--muted);">A carregar questão…</p>
{:else}
  <div style="max-width: 820px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    <div style="display:flex; align-items:flex-end; justify-content:space-between; gap: 16px;">
      <div>
        <h2 style="margin: 0;">Editar Questão</h2>
      </div>

      {#if bankId}
        <a class="btn" href={`/app/banks/${bankId}`}>Voltar</a>
      {:else}
        <a class="btn" href="/app/banks">Voltar</a>
      {/if}
    </div>

    {#if error}
      <div style="margin-top: 12px; color: #b91c1c; font-size: 14px;">{error}</div>
    {/if}

    <form on:submit|preventDefault={save} style="margin-top: 16px; display: grid; gap: 12px;">
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

      <div>
        <label style="font-size: 14px;">Enunciado</label>
        <textarea
          bind:value={stem}
          rows="5"
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
          <span>Etiquetas (opcional){#if selectedLabels.length > 0} — {selectedLabels.length} selecionada(s){/if}</span>
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
                              📌 {tag.name}
                          </span>
                          <span style="font-size: 12px; color: var(--muted);">
                            {group.folder ? group.folder.name : "Sem pasta"}
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

      {#if type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE"}
        <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="font-weight: 600;">Opções</div>
            {#if type === "MULTIPLE_CHOICE"}
              <button class="btn" type="button" on:click={addOption}>+ Adicionar opção</button>
            {/if}
          </div>

          <p style="margin: 8px 0 0; color: var(--muted); font-size: 13px;">
            Marca exatamente <b>1</b> opção correta.
          </p>

          <div style="margin-top: 10px; display:grid; gap: 10px;">
            {#each options as opt, idx (idx)}
              <div style="display:grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items:center;">
                <input type="radio" name="correct" checked={opt.isCorrect} on:change={() => setCorrectSingle(idx)} />

                <input
                  value={opt.text}
                  on:input={(e) => {
                    const next = [...options];
                    next[idx] = { ...next[idx], text: e.target.value };
                    options = next;
                  }}
                  style="padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
                />

                {#if type === "MULTIPLE_CHOICE" && options.length > 2}
                  <button class="btn" type="button" on:click={() => removeOption(idx)}>Remover</button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if type === "SHORT_ANSWER"}
        <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px;">
          <div style="font-weight: 600;">Respostas aceitáveis</div>
          <p style="margin: 8px 0 0; color: var(--muted); font-size: 13px;">
            Uma resposta por linha.
          </p>

          <textarea
            bind:value={acceptableAnswersText}
            rows="4"
            style="width: 100%; margin-top: 10px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
          />
        </div>
      {/if}

      <div style="display:flex; gap: 10px;">
        <button class="btn" type="submit" disabled={saving} style="padding: 10px 14px;">
          {saving ? "A guardar..." : "Guardar alterações"}
        </button>
      </div>
    </form>
  </div>
{/if}
