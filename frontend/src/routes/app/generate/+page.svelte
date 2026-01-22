<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  // bancos (para escolher destino se quiseres guardar)
  let banks = [];
  let banksLoading = true;

  // form
  let bankId = ""; // opcional
  let topic = "";
  let content = "";
  let numQuestions = 5;

  let types = ["MULTIPLE_CHOICE"];
  let difficulties = [2];

  let chapterTagsText = ""; // ids separados por vírgula (opcional)
  let labelsText = ""; // ids separados por vírgula (opcional)

  let language = "pt-PT";
  let additionalInstructions = "";
  let saveToBank = false;

  // resultado
  let generating = false;
  let error = "";
  let generated = []; // array de Question

  onMount(loadBanks);

  async function loadBanks() {
    banksLoading = true;
    try {
      const res = await api.get("/banks");
      banks = res.data?.data ?? [];
    } catch (e) {
      // não bloqueia a página
      banks = [];
    } finally {
      banksLoading = false;
    }
  }

  function parseIds(text) {
    return text
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function typeLabel(type) {
    return {
      MULTIPLE_CHOICE: "Escolha múltipla",
      TRUE_FALSE: "V/F",
      SHORT_ANSWER: "Resposta curta",
      OPEN: "Aberta"
    }[type] || type;
  }

  function validate() {
    if (!topic.trim() && !content.trim()) {
      return "Indica pelo menos um 'topic' ou 'content' para gerar.";
    }
    if (saveToBank && !bankId) {
      return "Se 'Guardar no banco' estiver ativo, tens de escolher um banco.";
    }
    if (numQuestions < 1 || numQuestions > 50) {
      return "numQuestions deve estar entre 1 e 50.";
    }
    return null;
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
      const payload = {
        bankId: bankId || undefined,
        topic: topic || undefined,
        content: content || undefined,
        numQuestions: Number(numQuestions),
        types,
        difficulties,
        chapterTags: parseIds(chapterTagsText),
        labels: parseIds(labelsText),
        language,
        additionalInstructions,
        saveToBank: Boolean(saveToBank)
      };

      const { data } = await api.post("/ai/generate-questions", payload);

      // não sabemos se vem {data:[...]} ou [...] -> suportar ambos:
      generated = data?.data ?? data ?? [];
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao gerar questões com IA.";
    } finally {
      generating = false;
    }
  }
</script>

<div style="display:flex; align-items:flex-end; justify-content:space-between; gap:16px;">
  <div>
    <h2 style="margin:0;">Geração de Questões (IA)</h2>
    <p style="margin:6px 0 0; color: var(--muted);">
      Gera questões por topic/content, com tipos e dificuldades configuráveis.
    </p>
  </div>
</div>

<div style="margin-top: 16px; display:grid; grid-template-columns: 1fr; gap: 16px;">
  <!-- FORM -->
  <div style="background:white; border:1px solid var(--border); border-radius:14px; padding:16px;">
    <form on:submit|preventDefault={generate} style="display:grid; gap: 12px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="font-size: 13px; color: var(--muted);">Banco (opcional)</label>
          <select
            bind:value={bankId}
            disabled={banksLoading}
            style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
          >
            <option value="">— Não guardar / sem banco —</option>
            {#each banks as b}
              <option value={b._id}>{b.title}</option>
            {/each}
          </select>
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted);">Guardar no banco</label>
          <div style="margin-top:6px; display:flex; align-items:center; gap:10px;">
            <input type="checkbox" bind:checked={saveToBank} />
            <span style="font-size:14px;">saveToBank</span>
          </div>
        </div>
      </div>

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
        <label style="font-size: 13px; color: var(--muted);">Topic (opcional)</label>
        <input
          bind:value={topic}
          placeholder="ex.: Programação Linear — Método Simplex"
          style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
        />
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted);">Content (opcional)</label>
        <textarea
          bind:value={content}
          rows="4"
          placeholder="Cola aqui matéria / resumo / excerto do manual..."
          style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
        />
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="font-size: 13px; color: var(--muted);">Tipos</label>
          <select
            multiple
            size="4"
            bind:value={types}
            style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
          >
            <option value="MULTIPLE_CHOICE">MULTIPLE_CHOICE</option>
            <option value="TRUE_FALSE">TRUE_FALSE</option>
            <option value="SHORT_ANSWER">SHORT_ANSWER</option>
            <option value="OPEN">OPEN</option>
          </select>
          <p style="margin:6px 0 0; font-size:12px; color: var(--muted);">
            Ctrl/Cmd para selecionar múltiplos.
          </p>
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted);">Dificuldades</label>
          <select
            multiple
            size="4"
            bind:value={difficulties}
            style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
          <p style="margin:6px 0 0; font-size:12px; color: var(--muted);">
            Ctrl/Cmd para selecionar múltiplos.
          </p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="font-size: 13px; color: var(--muted);">chapterTags (ObjectId, vírgulas)</label>
          <input
            bind:value={chapterTagsText}
            placeholder="ex.: 65ab..., 65ac..."
            style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
          />
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted);">labels (ObjectId, vírgulas)</label>
          <input
            bind:value={labelsText}
            placeholder="ex.: 65bb..., 65bc..."
            style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
          />
        </div>
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
        <button class="btn" type="submit" disabled={generating} style="padding:10px 14px;">
          {generating ? "A gerar..." : "Gerar"}
        </button>

        {#if saveToBank && bankId}
          <button class="btn" type="button" on:click={() => goto(`/app/banks/${bankId}`)}>
            Ir ao banco
          </button>
        {/if}
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
              <div style="font-size:13px; color: var(--muted);">{q.source || "AI"}</div>
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

      <p style="margin-top: 10
