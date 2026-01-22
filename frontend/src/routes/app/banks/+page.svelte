<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  let banks = [];
  let loading = true;
  let error = "";

  onMount(loadBanks);

  async function loadBanks() {
    loading = true;
    error = "";

    try {
      const response = await api.get("/banks");

      /**
       * Backend response:
       * {
       *   data: [ { _id, title, ... } ],
       *   pagination: { ... }
       * }
       */
      banks = response.data?.data ?? [];
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao carregar bancos.";
    } finally {
      loading = false;
    }
  }
</script>

<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;">
  <div>
    <h2 style="margin: 0;">Bancos de Questões</h2>
    <p style="margin: 6px 0 0; color: var(--muted);">
      Lista de bancos disponíveis no sistema.
    </p>
  </div>

  <a class="btn" href="/app/banks/new">+ Novo banco</a>
</div>

{#if loading}
  <p style="margin-top: 16px; color: var(--muted);">A carregar bancos…</p>
{:else if error}
  <p style="margin-top: 16px; color: #b91c1c;">{error}</p>
{:else if banks.length === 0}
  <p style="margin-top: 16px; color: var(--muted);">Ainda não existem bancos.</p>
{:else}
  <div
    style="
      margin-top: 16px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    "
  >
    {#each banks as bank}
      <a
        href={`/app/banks/${bank._id}`}
        style="text-decoration: none; color: inherit;"
      >
        <div
          style="
            background: white;
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 16px;
          "
        >
          <div style="font-weight: 600;">
            {bank.title}
          </div>

          {#if bank.description}
            <div style="margin-top: 6px; color: var(--muted); font-size: 14px;">
              {bank.description}
            </div>
          {/if}
        </div>
      </a>
    {/each}
  </div>
{/if}
