<script>
  import { api } from "$lib/api/client";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  export let data;
  const generationId = data.generationId;

  const DIFFICULTY_LABELS = {
    1: "Básico",
    2: "Normal",
    3: "Difícil",
    4: "Muito Difícil"
  };

  let generation = null;
  let loading = true;
  let error = "";
  let approving = false;
  let rejecting = false;
  
  // Confirmation modals
  let showApproveModal = false;
  let showRejectModal = false;

  // For editing questions before approval
  let editedQuestions = [];

  onMount(loadGeneration);

  async function loadGeneration() {
    loading = true;
    error = "";

    try {
      const { data } = await api.get(`/ai/generations/${generationId}`);
      generation = data;
      
      // Clone suggested questions for editing
      editedQuestions = (generation.suggestedQuestions || []).map(q => ({
        ...q,
        include: true, // Whether to include this question in approval
        options: q.options ? [...q.options] : [],
        acceptableAnswers: q.acceptableAnswers ? [...q.acceptableAnswers] : [],
        tags: q.tags ? [...q.tags] : [],
        labels: q.labels ? [...q.labels] : [],
        chapterTags: q.chapterTags ? [...q.chapterTags] : []
      }));
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao carregar geração.";
    } finally {
      loading = false;
    }
  }

  function openApproveModal() {
    const questionsToApprove = editedQuestions.filter(q => q.include);
    if (questionsToApprove.length === 0) {
      error = "Seleciona pelo menos uma questão para aprovar.";
      return;
    }
    showApproveModal = true;
  }
  
  function closeApproveModal() {
    showApproveModal = false;
  }
  
  function openRejectModal() {
    showRejectModal = true;
  }
  
  function closeRejectModal() {
    showRejectModal = false;
  }
  
  async function confirmApprove() {
    showApproveModal = false;
    await approveGeneration();
  }
  
  async function confirmReject() {
    showRejectModal = false;
    await rejectGeneration();
  }
  
  async function approveGeneration() {
    error = "";
    approving = true;

    try {
      // Filter only included questions and prepare edits
      const questionsToApprove = editedQuestions
        .filter(q => q.include)
        .map((q, idx) => ({
          index: idx,
          edits: {
            stem: q.stem,
            type: q.type,
            difficulty: q.difficulty,
            options: q.options,
            acceptableAnswers: q.acceptableAnswers,
            tags: q.tags,
            labels: q.labels,
            chapterTags: q.chapterTags
          }
        }));

      await api.post(`/ai/generations/${generationId}/approve`, {
        edits: questionsToApprove
      });

      // Redirect to generations list or bank
      if (generation.bank) {
        const bankId = typeof generation.bank === 'string' ? generation.bank : generation.bank._id;
        await goto(`/app/banks/${bankId}`);
      } else {
        await goto("/app/generations");
      }
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao aprovar geração.";
    } finally {
      approving = false;
    }
  }

  async function rejectGeneration() {
    error = "";
    rejecting = true;

    try {
      await api.put(`/ai/generations/${generationId}`, { status: "REJECTED" });
      await goto("/app/generations");
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao rejeitar geração.";
    } finally {
      rejecting = false;
    }
  }

  function typeLabel(type) {
    return {
      MULTIPLE_CHOICE: "Escolha múltipla",
      TRUE_FALSE: "Verdadeiro / Falso",
      SHORT_ANSWER: "Resposta curta",
      OPEN: "Resposta aberta"
    }[type] || type;
  }

  function toggleAll(include) {
    editedQuestions = editedQuestions.map(q => ({ ...q, include }));
  }
</script>

<div style="max-width: 1000px; margin: 0 auto;">
  {#if loading}
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
      <p style="color: var(--muted); margin: 0;">A carregar geração...</p>
    </div>
  {:else if !generation}
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
      <p style="color: #b91c1c; margin: 0;">Geração não encontrada.</p>
    </div>
  {:else}
    <!-- Header -->
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div>
          <h2 style="margin: 0;">Rever Geração de IA</h2>
          <p style="margin: 6px 0 0; color: var(--muted); font-size: 14px;">
            Status: <strong>{generation.status}</strong> •
            {editedQuestions.length} questões •
            Gerada em {new Date(generation.createdAt).toLocaleString()}
          </p>
          {#if generation.bank}
            <p style="margin: 6px 0 0; color: var(--muted); font-size: 14px;">
              Banco: {typeof generation.bank === 'string' ? generation.bank : generation.bank.title || generation.bank._id}
            </p>
          {/if}
        </div>
        <a class="btn" href="/app/generations">← Voltar</a>
      </div>
    </div>

    {#if error}
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 16px; margin-bottom: 16px; color: #b91c1c;">
        {error}
      </div>
    {/if}

    <!-- Actions -->
    {#if generation.status === "PENDING"}
      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
          <div>
            <div style="font-weight: 500; margin-bottom: 4px;">Ações</div>
            <p style="margin: 0; color: var(--muted); font-size: 13px;">
              Revê as questões abaixo e aprova ou rejeita a geração
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn" on:click={() => toggleAll(true)} style="font-size: 13px;">
              Selecionar Todas
            </button>
            <button class="btn" on:click={() => toggleAll(false)} style="font-size: 13px;">
              Desselecionar Todas
            </button>
          </div>
        </div>

        <div style="margin-top: 16px; display: flex; gap: 10px;">
          <button
            class="btn"
            on:click={openApproveModal}
            disabled={approving || rejecting}
            style="background: #d1fae5; border-color: #6ee7b7; color: #065f46; font-weight: 500;"
          >
            {approving ? "A aprovar..." : "✓ Aprovar Selecionadas"}
          </button>
          <button
            class="btn"
            on:click={openRejectModal}
            disabled={approving || rejecting}
            style="background: #fee2e2; border-color: #fecaca; color: #991b1b;"
          >
            {rejecting ? "A rejeitar..." : "✗ Rejeitar Tudo"}
          </button>
        </div>
      </div>
    {/if}

    <!-- Questions -->
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
      <h3 style="margin: 0 0 16px 0;">Questões Sugeridas</h3>

      <div style="display: grid; gap: 16px;">
        {#each editedQuestions as q, idx}
          <div style="border: 1px solid var(--border); border-radius: 12px; padding: 16px; {q.include ? '' : 'opacity: 0.5; background: #f9fafb;'}">
            <!-- Checkbox and header -->
            <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px;">
              {#if generation.status === "PENDING"}
                <input
                  type="checkbox"
                  bind:checked={q.include}
                  style="margin-top: 4px;"
                />
              {/if}
              <div style="flex: 1;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                  <span style="display:inline-flex; padding:4px 10px; border-radius:999px; font-size:12px; border:1px solid var(--border); background:#f0f9ff; color:#075985;">
                    {typeLabel(q.type)}
                  </span>
                  <span style="display:inline-flex; padding:4px 10px; border-radius:999px; font-size:12px; border:1px solid var(--border); background:#fef3c7; color:#92400e;">
                    {q.difficulty} - {DIFFICULTY_LABELS[q.difficulty]}
                  </span>
                  {#if q.source}
                    <span style="display:inline-flex; padding:4px 10px; border-radius:999px; font-size:12px; border:1px solid var(--border);">
                      {q.source}
                    </span>
                  {/if}
                </div>

                <!-- Stem -->
                <div style="font-weight: 500; margin-bottom: 8px;">
                  {q.stem}
                </div>

                <!-- Options (for MC/TF) -->
                {#if q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE"}
                  <ul style="margin: 8px 0; padding-left: 20px;">
                    {#each q.options || [] as opt}
                      <li style="color: {opt.isCorrect ? '#15803d' : 'inherit'}; font-weight: {opt.isCorrect ? '500' : 'normal'};">
                        {opt.text}
                      </li>
                    {/each}
                  </ul>
                {/if}

                <!-- Acceptable Answers (for SHORT_ANSWER) -->
                {#if q.type === "SHORT_ANSWER" && q.acceptableAnswers?.length > 0}
                  <div style="margin-top: 8px; color: var(--muted); font-size: 13px;">
                    Respostas aceitáveis: {q.acceptableAnswers.join(", ")}
                  </div>
                {/if}

                <!-- Tags, Labels, ChapterTags -->
                <div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">
                  {#if q.labels?.length > 0}
                    {#each q.labels as label}
                      <span style="display:inline-flex; padding:3px 8px; border-radius:999px; font-size:12px; border:1px solid #a5f3fc; background:#ecfeff; color:#155e75;">
                        📝 {typeof label === 'string' ? label : label.name || label}
                      </span>
                    {/each}
                  {/if}
                  {#if q.chapterTags?.length > 0}
                    {#each q.chapterTags as tag}
                      <span style="display:inline-flex; padding:3px 8px; border-radius:999px; font-size:12px; border:1px solid #c4b5fd; background:#f5f3ff; color:#6b21a8;">
                        📚 {typeof tag === 'string' ? tag : tag.name || tag}
                      </span>
                    {/each}
                  {/if}
                  {#if q.tags?.length > 0}
                    {#each q.tags as tag}
                      <span style="display:inline-flex; padding:3px 8px; border-radius:999px; font-size:12px; border:1px solid var(--border); background:#fff;">
                        #{tag}
                      </span>
                    {/each}
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Approve Confirmation Modal -->
{#if showApproveModal}
  <div class="modal-overlay" on:click={closeApproveModal}>
    <div class="modal-content" on:click|stopPropagation>
      <h3 style="margin: 0 0 16px 0; font-size: 18px;">Confirmar Aprovação</h3>
      <p style="margin: 0 0 24px 0; color: var(--muted); line-height: 1.5;">
        Tem a certeza que deseja aprovar as questões selecionadas?
        <br/><strong style="color: var(--text);">As questões serão adicionadas ao banco.</strong>
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn" type="button" on:click={closeApproveModal}>
          Cancelar
        </button>
        <button class="btn btn-approve" type="button" on:click={confirmApprove}>
          Aprovar
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Reject Confirmation Modal -->
{#if showRejectModal}
  <div class="modal-overlay" on:click={closeRejectModal}>
    <div class="modal-content" on:click|stopPropagation>
      <h3 style="margin: 0 0 16px 0; font-size: 18px;">Confirmar Rejeição</h3>
      <p style="margin: 0 0 24px 0; color: var(--muted); line-height: 1.5;">
        Tem a certeza que deseja rejeitar esta geração?
        <br/><strong style="color: #b91c1c;">Esta ação não pode ser desfeita.</strong>
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn" type="button" on:click={closeRejectModal}>
          Cancelar
        </button>
        <button class="btn btn-delete" type="button" on:click={confirmReject}>
          Rejeitar
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
    text-decoration: none;
    display: inline-flex;
    align-items: center;
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
  
  .btn-approve {
    background: #10b981 !important;
    color: white !important;
    border-color: #10b981 !important;
  }
  
  .btn-approve:hover:not(:disabled) {
    background: #059669 !important;
    border-color: #059669 !important;
  }
  
  .btn-delete {
    background: #dc2626 !important;
    color: white !important;
    border-color: #dc2626 !important;
  }
  
  .btn-delete:hover:not(:disabled) {
    background: #b91c1c !important;
    border-color: #b91c1c !important;
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
</style>
