<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  const DIFFICULTY_LABELS = {
    1: "Básico",
    2: "Normal",
    3: "Difícil",
    4: "Muito Difícil",
  };

  const QUESTION_TYPE_LABELS = {
    MULTIPLE_CHOICE: "Escolha múltipla",
    TRUE_FALSE: "V/F",
    SHORT_ANSWER: "Resposta curta",
    OPEN: "Aberta",
  };

  function typeLabel(type) {
    return QUESTION_TYPE_LABELS[type] || type;
  }

  function difficultyLabel(d) {
    const num = Number(d);
    if (!Number.isFinite(num)) return "";
    return DIFFICULTY_LABELS[num] || `D ${num}`;
  }

  // Banks (para guardar questões)
  let banks = [];
  let banksLoading = true;
  async function loadBanks() {
    try {
      const res = await api.get("/banks");
      banks = res.data?.data || [];
    } catch (e) {
      banks = [];
    } finally {
      banksLoading = false;
    }
  }

  // PDFs / documentos
  let isExtracting = false;
  let extractError = "";
  let documents = []; // [{id, filename, extractedTextLength}]
  let uploadInput = null;

  async function handleExtractPdfs(e) {
    extractError = "";
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      isExtracting = true;
      const form = new FormData();
      for (const f of files) {
        // campo esperado no backend: `pdfs`
        form.append("pdfs", f, f.name);
      }

      const res = await api.post("/ai/pdf/extract", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      documents = res.data?.documents || [];
      if (!documents.length) {
        extractError =
          "Não foi possível extrair texto dos PDFs (verifica se são PDFs com texto selecionável).";
      }
    } catch (err) {
      extractError =
        err?.response?.data?.error || err.message || "Erro ao extrair PDF(s)";
    } finally {
      isExtracting = false;
      if (uploadInput) uploadInput.value = "";
    }
  }

  function documentIds() {
    return documents.map((d) => d.id);
  }

  // Critérios (mesma ideia da página Gerar por IA)
  let numQuestions = 5;
  let language = "pt-PT";
  let types = ["MULTIPLE_CHOICE"];
  let difficulties = [2];
  let additionalInstructions = "";

  function toggleType(type) {
    if (types.includes(type)) types = types.filter((t) => t !== type);
    else types = [...types, type];
  }

  function toggleDifficulty(difficulty) {
    const d = Number(difficulty);
    if (difficulties.includes(d)) {
      difficulties = difficulties.filter((x) => x !== d);
    } else {
      difficulties = [...difficulties, d];
    }
  }

  // Chat
  let messages = []; // [{role:'user'|'assistant', content:string}]
  let chatMessage = "";
  let generating = false;
  let error = "";

  let generated = []; // questions

  // Improve with IA
  let improveMessage = "";
  let improving = false;
  let improveError = "";

  // Save to bank modal (reutiliza o endpoint já existente)
  let showSaveToBankModal = false;
  let selectedBankForSave = "";
  let savingToBank = false;
  let saveError = "";

  function openSaveToBankModal() {
    selectedBankForSave = banks?.[0]?._id || "";
    saveError = "";
    showSaveToBankModal = true;
  }

  function closeSaveToBankModal() {
    showSaveToBankModal = false;
    selectedBankForSave = "";
    saveError = "";
  }

  async function saveQuestionsToBank() {
    if (!selectedBankForSave) {
      saveError = "Seleciona um banco.";
      return;
    }
    savingToBank = true;
    saveError = "";
    try {
      for (const q of generated) {
        await api.post(`/banks/${selectedBankForSave}/questions`, { ...q });
      }
      showSaveToBankModal = false;
      selectedBankForSave = "";
      alert(`${generated.length} questões guardadas com sucesso!`);
    } catch (e) {
      saveError = e?.response?.data?.message || e?.response?.data?.error || "Erro ao guardar.";
    } finally {
      savingToBank = false;
    }
  }

  async function generateFromChat() {
    error = "";
    generated = [];

    const ids = documentIds();
    if (!ids.length) {
      error = "Faz upload de pelo menos 1 PDF antes de gerar questões.";
      return;
    }
    const msg = String(chatMessage || "").trim();
    if (!msg) {
      error = "Escreve o teu pedido na caixa de chat.";
      return;
    }
    if (!types.length) {
      error = "Seleciona pelo menos 1 tipo de questão.";
      return;
    }
    if (!difficulties.length) {
      error = "Seleciona pelo menos 1 dificuldade.";
      return;
    }

    generating = true;
    try {
      messages = [...messages, { role: "user", content: msg }];

      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post("/ai/pdf-chat/generate", {
        documentIds: ids,
        chatMessage: msg,
        chatHistory,
        numQuestions: Number(numQuestions),
        types,
        difficulties,
        language,
        additionalInstructions,
        saveToBank: false,
      });

      const questions = res.data?.questions || [];
      generated = questions;

      messages = [
        ...messages,
        {
          role: "assistant",
          content:
            questions.length > 0
              ? `Geradas ${questions.length} questões com base nos PDFs.`
              : "Não consegui gerar questões com base no conteúdo extraído.",
        },
      ];

      chatMessage = "";
    } catch (e) {
      error =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e.message ||
        "Erro ao gerar questões a partir dos PDFs.";
    } finally {
      generating = false;
    }
  }

  async function improveGeneratedQuestions() {
    improveError = "";
    if (!generated.length) {
      improveError = "Gera questões primeiro.";
      return;
    }
    const ids = documentIds();
    if (!ids.length) {
      improveError = "Faz upload de PDFs antes de melhorar.";
      return;
    }
    const msg = String(improveMessage || "").trim();
    if (!msg) {
      improveError = "Escreve um pedido de melhoria (ex.: tornar mais difíceis / corrigir enunciados).";
      return;
    }

    improving = true;
    try {
      const res = await api.post("/ai/pdf-chat/improve", {
        documentIds: ids,
        existingQuestions: generated,
        chatMessage: msg,
        numQuestions: generated.length,
        types,
        difficulties,
        language,
      });

      generated = res.data?.questions || [];

      messages = [
        ...messages,
        {
          role: "assistant",
          content:
            generated.length > 0
              ? `Questões melhoradas com base no teu pedido.`
              : "Não consegui melhorar as questões com base no contexto dos PDFs.",
        },
      ];
      improveMessage = "";
    } catch (e) {
      improveError =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e.message ||
        "Erro ao melhorar as questões.";
    } finally {
      improving = false;
    }
  }

  onMount(async () => {
    await loadBanks();
  });
</script>

<div style="display:flex; flex-direction:column; gap:24px;">
  <div>
    <h1 style="margin:0; font-size:24px; font-weight:600; color:#1e293b;">IA conversacional com PDFs</h1>
    <p style="margin:6px 0 0; font-size:14px; color:#64748b;">
      Faz upload de PDF(s), escreve o que queres, e a app gera questões com base no conteúdo extraído.
    </p>
  </div>

  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
    <!-- Left: Upload + Criteria + Chat -->
    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:16px;">
      <div>
        <h3 style="margin:0 0 8px 0; font-size:16px; font-weight:600; color:#1e293b;">1) Upload de PDFs</h3>
        <input
          bind:this={uploadInput}
          type="file"
          accept=".pdf"
          multiple
          style="width: 100%;"
          on:change={handleExtractPdfs}
          disabled={isExtracting}
        />
        {#if isExtracting}
          <div style="margin-top:8px; color:#2563eb; font-size:13px;">A extrair texto...</div>
        {/if}
        {#if extractError}
          <div style="margin-top:8px; color:#991b1b; background:#fee2e2; border:1px solid #fecaca; border-radius:8px; padding:10px; font-size:13px;">
            {extractError}
          </div>
        {/if}
      </div>

      {#if documents.length > 0}
        <div style="border:1px solid #e2e8f0; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="font-weight:600; font-size:13px; color:#1e293b;">Documentos extraídos</div>
          {#each documents as d}
            <div style="display:flex; justify-content:space-between; gap:12px; font-size:13px; color:#334155;">
              <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{d.filename}</span>
              <span style="color:#64748b;">{d.extractedTextLength} chars</span>
            </div>
          {/each}
        </div>
      {/if}

      <div style="border:1px solid #e2e8f0; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:12px;">
        <div style="font-weight:600; font-size:14px; color:#1e293b;">2) Critérios</div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:13px; color:#64748b; display:block; margin-bottom:6px;">Nº questões</label>
            <input type="number" min="1" max="50" bind:value={numQuestions} style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px;" />
          </div>
          <div>
            <label style="font-size:13px; color:#64748b; display:block; margin-bottom:6px;">Idioma</label>
            <select bind:value={language} style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; background:white;">
              <option value="pt-PT">pt-PT</option>
              <option value="en">en</option>
              <option value="pt-BR">pt-BR</option>
            </select>
          </div>
        </div>

        <div>
          <div style="font-size:13px; color:#64748b; margin-bottom:6px; font-weight:600;">Tipos de Questões</div>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            {#each ["MULTIPLE_CHOICE","TRUE_FALSE","SHORT_ANSWER","OPEN"] as t}
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:#334155;">
                <input type="checkbox" value={t} checked={types.includes(t)} on:change={() => toggleType(t)} />
                <span style="padding:2px 8px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">{typeLabel(t)}</span>
              </label>
            {/each}
          </div>
        </div>

        <div>
          <div style="font-size:13px; color:#64748b; margin-bottom:6px; font-weight:600;">Dificuldades</div>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            {#each [1,2,3,4] as d}
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:#334155;">
                <input type="checkbox" value={d} checked={difficulties.includes(d)} on:change={() => toggleDifficulty(d)} />
                <span style="padding:2px 8px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">{difficultyLabel(d)}</span>
              </label>
            {/each}
          </div>
        </div>

        <div>
          <label style="font-size:13px; color:#64748b; display:block; margin-bottom:6px;">Instruções adicionais (opcional)</label>
          <textarea rows="3" bind:value={additionalInstructions} placeholder="Ex.: cria questões focadas em exemplos e definições." style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; font-family:inherit;"></textarea>
        </div>
      </div>

      <div style="border:1px solid #e2e8f0; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:12px;">
        <div style="font-weight:600; font-size:14px; color:#1e293b;">3) Chat</div>

        <div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow:auto; padding-right:6px;">
          {#each messages as m}
            <div style="display:flex; justify-content:{m.role === 'user' ? 'flex-end' : 'flex-start'};">
              <div style="max-width: 85%; padding:10px 12px; border-radius:12px; border:1px solid #e2e8f0; background:{m.role === 'user' ? '#eff6ff' : '#f8fafc'}; font-size:13px; color:#0f172a; white-space:pre-wrap;">
                <div style="font-weight:600; margin-bottom:4px; color:#334155;">{m.role === 'user' ? 'Tu' : 'IA'}</div>
                {m.content}
              </div>
            </div>
          {/each}
          {#if messages.length === 0}
            <div style="color:#64748b; font-size:13px;">Escreve o teu pedido abaixo para gerar questões.</div>
          {/if}
        </div>

        <textarea
          rows="3"
          bind:value={chatMessage}
          placeholder="Ex.: com base nos PDFs, cria 5 perguntas de escolha múltipla e V/F sobre os conceitos-chave."
          style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; font-family:inherit;"
        />

        {#if error}
          <div style="background:#fee2e2; border:1px solid #fecaca; border-radius:8px; padding:10px; color:#991b1b; font-size:13px;">
            {error}
          </div>
        {/if}

        <button
          type="button"
          on:click={generateFromChat}
          disabled={generating}
          style="padding:12px 16px; background:#2563eb; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; transition:all 0.15s; opacity:{generating ? 0.6 : 1};"
        >
          {generating ? "A gerar..." : "Gerar questões"}
        </button>
      </div>
    </div>

    <!-- Right: Results -->
    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:14px;">
      <h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">📋 Resultados</h3>

      {#if generated.length === 0}
        <p style="margin:0; color:#64748b; font-size:14px;">Gera questões para ver a pré-visualização aqui...</p>
      {:else}
        <div style="display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-height:560px; padding-right:6px;">
          {#each generated as q}
            <div style="border:1px solid #e2e8f0; border-radius:8px; padding:12px; background:#f8fafc;">
              <div style="font-weight:600; font-size:13px; color:#1e293b; margin-bottom:8px;">
                {typeLabel(q.type)} • D {q.difficulty}/4
              </div>
              <div style="font-size:13px; color:#1e293b; line-height:1.5; white-space:pre-wrap;">{q.stem}</div>

              {#if q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE"}
                <ul style="margin:8px 0 0; padding-left:18px; font-size:12px;">
                  {#each (q.options || []) as opt}
                    <li style="color:{opt.isCorrect ? '#10b981' : '#334155'}; margin:4px 0;">{opt.text}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/each}
        </div>

        <div style="margin-top:12px; border:1px solid #e2e8f0; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px;">
          <div style="font-weight:600; font-size:14px; color:#1e293b;">Melhorar com IA</div>
          <textarea
            rows="3"
            bind:value={improveMessage}
            placeholder="Ex.: torna as questões mais difíceis, ajusta as explicações, e remove ambiguidades."
            style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; font-family:inherit;"
            disabled={improving}
          />
          {#if improveError}
            <div style="background:#fee2e2; border:1px solid #fecaca; border-radius:8px; padding:10px; color:#991b1b; font-size:13px;">
              {improveError}
            </div>
          {/if}
          <button
            type="button"
            on:click={improveGeneratedQuestions}
            disabled={improving}
            style="padding:12px 16px; background:white; border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; opacity:{improving ? 0.6 : 1};"
          >
            {improving ? "A melhorar..." : "✨ Melhorar questões"}
          </button>
        </div>

        <div style="display:flex; gap:12px; margin-top:14px;">
          <button
            type="button"
            on:click={() => (generated = [])}
            style="flex:1; padding:12px 16px; background:white; border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:14px;"
          >
            Limpar
          </button>
          <button
            type="button"
            on:click={openSaveToBankModal}
            disabled={banksLoading || generated.length === 0}
            style="flex:1; padding:12px 16px; background:#2563eb; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; opacity:{banksLoading || generated.length === 0 ? 0.6 : 1};"
          >
            💾 Guardar
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showSaveToBankModal}
  <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;" on:click={closeSaveToBankModal}>
    <div style="background:white; border-radius:12px; padding:24px; max-width:500px; width:90%; box-shadow:0 20px 25px rgba(0,0,0,0.1);" on:click|stopPropagation>
      <h3 style="margin:0 0 16px 0; font-size:18px; font-weight:600; color:#1e293b;">Guardar no banco</h3>
      <p style="margin:0 0 12px 0; color:#64748b; line-height:1.5; font-size:14px;">
        Seleciona o banco onde queres guardar as {generated.length} {generated.length === 1 ? "questão" : "questões"}.
      </p>

      <select
        bind:value={selectedBankForSave}
        style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:16px; font-size:14px; background:white;"
        disabled={banksLoading}
      >
        <option value="">-- Selecionar banco --</option>
        {#each banks as bank}
          <option value={bank._id}>{bank.title}</option>
        {/each}
      </select>

      {#if saveError}
        <div style="color:#991b1b; background:#fee2e2; border:1px solid #fecaca; border-radius:8px; padding:10px; font-size:13px; margin-bottom:16px;">
          {saveError}
        </div>
      {/if}

      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button style="padding:10px 16px; background:white; border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:14px;" type="button" on:click={closeSaveToBankModal} disabled={savingToBank}>
          Cancelar
        </button>
        <button style="padding:10px 16px; background:#2563eb; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; opacity:{savingToBank ? 0.6 : 1};" type="button" on:click={saveQuestionsToBank} disabled={savingToBank || !selectedBankForSave}>
          {savingToBank ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </div>
  </div>
{/if}

