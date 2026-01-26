<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  let generations = [];
  let loading = true;
  let error = "";

  // Filters
  let filterStatus = "ALL"; // ALL, PENDING, APPLIED, REJECTED

  onMount(loadGenerations);

  async function loadGenerations() {
    loading = true;
    error = "";

    try {
      const { data } = await api.get("/ai/generations");
      generations = Array.isArray(data) ? data : [];
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao carregar gerações.";
    } finally {
      loading = false;
    }
  }

  function statusBadge(status) {
    const base = "display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:500;";
    
    const styles = {
      PENDING: base + "background:#fef3c7; border:1px solid #fde047; color:#92400e;",
      APPLIED: base + "background:#d1fae5; border:1px solid #6ee7b7; color:#065f46;",
      REJECTED: base + "background:#fee2e2; border:1px solid #fecaca; color:#991b1b;"
    };

    return styles[status] || base;
  }

  $: filtered = generations.filter(g => {
    if (filterStatus !== "ALL" && g.status !== filterStatus) return false;
    return true;
  });
</script>

<div style="max-width: 1200px; margin: 0 auto;">
  <!-- Header -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
      <div>
        <h2 style="margin: 0;">Gerações de IA</h2>
        <p style="margin: 6px 0 0; color: var(--muted); font-size: 14px;">
          Visualiza e gere as questões geradas por IA
        </p>
      </div>
      <a class="btn" href="/app/generate">+ Nova Geração</a>
    </div>

    <!-- Filters -->
    <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
      <label style="font-size: 13px; color: var(--muted);">Status:</label>
      <select bind:value={filterStatus} style="padding: 8px; border: 1px solid var(--border); border-radius: 8px;">
        <option value="ALL">Todos</option>
        <option value="PENDING">Pendentes</option>
        <option value="APPLIED">Aplicadas</option>
        <option value="REJECTED">Rejeitadas</option>
      </select>
    </div>
  </div>

  {#if error}
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 16px; margin-bottom: 16px; color: #b91c1c;">
      {error}
    </div>
  {/if}

  <!-- List -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    {#if loading}
      <p style="color: var(--muted); margin: 0;">A carregar gerações...</p>
    {:else if filtered.length === 0}
      <p style="color: var(--muted); margin: 0;">Nenhuma geração encontrada.</p>
    {:else}
      <div style="display: grid; gap: 16px;">
        {#each filtered as gen}
          <div style="border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                  <span style={statusBadge(gen.status)}>{gen.status}</span>
                  <span style="font-size: 13px; color: var(--muted);">
                    {gen.suggestedQuestions?.length || 0} questões
                  </span>
                </div>
                <div style="font-size: 13px; color: var(--muted);">
                  Gerada em {new Date(gen.createdAt).toLocaleString()}
                  {#if gen.bank}
                    • Banco: <a href="/app/banks/{typeof gen.bank === 'string' ? gen.bank : gen.bank._id}">
                      {typeof gen.bank === 'string' ? gen.bank : gen.bank.title || gen.bank._id}
                    </a>
                  {/if}
                </div>
              </div>

              <div style="display: flex; gap: 8px;">
                {#if gen.status === "PENDING"}
                  <a class="btn" href="/app/generations/{gen._id}" style="background: #fef3c7; border-color: #fde047;">
                    Rever & Aprovar
                  </a>
                {:else}
                  <a class="btn" href="/app/generations/{gen._id}">
                    Ver Detalhes
                  </a>
                {/if}
              </div>
            </div>

            <!-- Preview first 2 questions -->
            {#if gen.suggestedQuestions && gen.suggestedQuestions.length > 0}
              <div style="background: #f9fafb; border-radius: 8px; padding: 12px;">
                <div style="font-size: 13px; font-weight: 500; color: var(--muted); margin-bottom: 8px;">
                  Pré-visualização:
                </div>
                {#each gen.suggestedQuestions.slice(0, 2) as q, idx}
                  <div style="margin-bottom: 8px; padding-bottom: 8px; {idx < 1 ? 'border-bottom: 1px solid var(--border);' : ''}">
                    <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">
                      {q.type} • Dificuldade {q.difficulty}
                    </div>
                    <div style="font-size: 14px;">
                      {q.stem?.substring(0, 150)}{q.stem?.length > 150 ? '...' : ''}
                    </div>
                  </div>
                {/each}
                {#if gen.suggestedQuestions.length > 2}
                  <div style="font-size: 13px; color: var(--muted); margin-top: 8px;">
                    + {gen.suggestedQuestions.length - 2} mais...
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .btn {
    padding: 8px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: all 0.15s;
  }

  .btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }
</style>
