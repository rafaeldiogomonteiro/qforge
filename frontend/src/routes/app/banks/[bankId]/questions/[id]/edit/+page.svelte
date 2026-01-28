<script>
  import { api } from "$lib/api/client";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  export let data;
  const id = data.id;

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

  // Available labels and chapter tags
  let availableLabels = [];
  let availableChapterTags = [];

  let loading = true;
  let saving = false;
  let error = "";

  // Campos editáveis
  let bankId = "";
  let type = "MULTIPLE_CHOICE";
  let stem = "";
  let difficulty = 2;
  let tagsText = "";
  let selectedLabels = []; // array of label IDs
  let selectedChapterTags = []; // array of chapter tag IDs
  let acceptableAnswersText = "";
  let source = "MANUAL";

  let options = [];

  function applyTypeDefaults(nextType) {
    type = nextType;

    if (type === "TRUE_FALSE") {
      options = [
        { text: "Verdadeiro", isCorrect: true },
        { text: "Falso", isCorrect: false }
      ];
    } else if (type === "MULTIPLE_CHOICE") {
      if (!options || options.length < 2) {
        options = [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false }
        ];
      }
    } else {
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
    options = options.map((o, i) => ({ ...o, isCorrect: i === idx }));
  }

  function parseTags() {
    return tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
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
    bankId = q.bank;
    type = q.type;
    stem = q.stem || "";
    difficulty = q.difficulty ?? 2;
    source = q.source || "MANUAL";

    tagsText = (q.tags || []).join(", ");
    
    // Extract label IDs
    selectedLabels = (q.labels || []).map(label => typeof label === 'string' ? label : label._id);
    
    // Extract chapter tag IDs
    selectedChapterTags = (q.chapterTags || []).map(tag => typeof tag === 'string' ? tag : tag._id);
    
    acceptableAnswersText = (q.acceptableAnswers || []).join("\n");

    options = Array.isArray(q.options)
      ? q.options.map((o) => ({ text: o.text ?? "", isCorrect: Boolean(o.isCorrect) }))
      : [];

    // garantir coerência com o tipo
    applyTypeDefaults(type);
  }

  onMount(async () => {
    loading = true;
    error = "";

    try {
      const [questionRes, labelsRes, chapterTagsRes] = await Promise.all([
        api.get(`/questions/${id}`),
        api.get("/labels"),
        api.get("/chapter-tags")
      ]);
      
      availableLabels = labelsRes.data || [];
      availableChapterTags = chapterTagsRes.data || [];
      
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
        type,
        stem: stem.trim(),
        difficulty: Number(difficulty),
        tags: parseTags(),
        labels: selectedLabels,
        chapterTags: selectedChapterTags,
        source
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
        <p style="margin: 6px 0 0; color: var(--muted);">
          ID:
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
            {id}
          </span>
        </p>
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
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
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
      </div>

      <div style="display:grid; grid-template-columns: 1fr; gap: 12px;">
        <div>
          <label style="font-size: 14px;">Origem</label>
          <select bind:value={source} style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;">
            <option value="MANUAL">MANUAL</option>
            <option value="AI">AI</option>
            <option value="IMPORTED">IMPORTED</option>
          </select>
        </div>
      </div>

      <div>
        <label style="font-size: 14px;">Enunciado</label>
        <textarea
          bind:value={stem}
          rows="5"
          style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
        />
      </div>

      <div>
        <label style="font-size: 14px;">Tags (vírgulas)</label>
        <input
          bind:value={tagsText}
          style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
        />
      </div>

      <!-- Labels -->
      <div>
        <label style="font-size: 14px;">Labels</label>
        <div style="margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; max-height: 150px; overflow-y: auto;">
          {#if availableLabels.length === 0}
            <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma label disponível. <a href="/app/labels">Criar labels</a></p>
          {:else}
            {#each availableLabels as label}
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
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
                />
                <span style="font-size: 14px;">{label.name}</span>
              </label>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Chapter Tags -->
      <div>
        <label style="font-size: 14px;">Chapter Tags</label>
        <div style="margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; padding: 10px; max-height: 150px; overflow-y: auto;">
          {#if availableChapterTags.length === 0}
            <p style="color: var(--muted); margin: 0; font-size: 13px;">Nenhuma tag disponível. <a href="/app/chapter-tags">Criar tags</a></p>
          {:else}
            {#each availableChapterTags as tag}
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
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
                />
                <span style="font-size: 14px;">{tag.name}</span>
              </label>
            {/each}
          {/if}
        </div>
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
