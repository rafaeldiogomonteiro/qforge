<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  let labels = [];
  let loading = true;
  let error = "";

  // Form state
  let isCreating = false;
  let editingId = null;
  let formName = "";
  let formError = "";
  let formLoading = false;

  // Filters
  let showInactive = false;
  
  // Confirmation modal
  let showDeleteModal = false;
  let labelToDelete = null;

  onMount(loadLabels);

  async function loadLabels() {
    loading = true;
    error = "";
    try {
      const params = showInactive ? "?includeInactive=1" : "";
      const { data } = await api.get(`/labels${params}`);
      labels = Array.isArray(data) ? data : [];
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao carregar labels";
    } finally {
      loading = false;
    }
  }

  function startCreate() {
    isCreating = true;
    editingId = null;
    formName = "";
    formError = "";
  }

  function startEdit(label) {
    isCreating = false;
    editingId = label._id;
    formName = label.name;
    formError = "";
  }

  function cancelForm() {
    isCreating = false;
    editingId = null;
    formName = "";
    formError = "";
  }

  async function submitForm() {
    formError = "";
    const trimmed = formName.trim();

    if (!trimmed) {
      formError = "Nome é obrigatório";
      return;
    }

    formLoading = true;

    try {
      if (editingId) {
        // Update
        await api.put(`/labels/${editingId}`, { name: trimmed });
      } else {
        // Create
        await api.post("/labels", { name: trimmed });
      }

      cancelForm();
      await loadLabels();
    } catch (e) {
      formError = e?.response?.data?.error || "Erro ao guardar label";
    } finally {
      formLoading = false;
    }
  }

  async function toggleActive(label) {
    try {
      await api.put(`/labels/${label._id}`, { isActive: !label.isActive });
      await loadLabels();
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao atualizar label";
    }
  }

  function openDeleteModal(label) {
    labelToDelete = label;
    showDeleteModal = true;
  }
  
  function closeDeleteModal() {
    showDeleteModal = false;
    labelToDelete = null;
  }
  
  async function confirmDelete() {
    if (!labelToDelete) return;
    
    try {
      await api.delete(`/labels/${labelToDelete._id}`);
      showDeleteModal = false;
      labelToDelete = null;
      await loadLabels();
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao eliminar label";
      showDeleteModal = false;
    }
  }

  $: filteredLabels = labels;
</script>

<div style="max-width: 1000px; margin: 0 auto;">
  <!-- Header -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
      <div>
        <h2 style="margin: 0;">Gestão de Labels</h2>
        <p style="margin: 6px 0 0; color: var(--muted); font-size: 14px;">
          Cria e gere labels para organizar questões (ex: "Época Normal", "Exame Final")
        </p>
      </div>
      <button class="btn" on:click={startCreate} disabled={isCreating || editingId}>
        + Nova Label
      </button>
    </div>

    <!-- Filter -->
    <div style="margin-top: 16px; display: flex; align-items: center; gap: 10px;">
      <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;">
        <input type="checkbox" bind:checked={showInactive} on:change={loadLabels} />
        Mostrar inativas
      </label>
    </div>
  </div>

  {#if error}
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 16px; margin-bottom: 16px; color: #b91c1c;">
      {error}
    </div>
  {/if}

  <!-- Create/Edit Form -->
  {#if isCreating || editingId}
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 16px 0;">{editingId ? "Editar Label" : "Nova Label"}</h3>

      <form on:submit|preventDefault={submitForm}>
        <div style="margin-bottom: 16px;">
          <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
            Nome da Label
          </label>
          <input
            bind:value={formName}
            type="text"
            placeholder="ex: Época Normal"
            disabled={formLoading}
            style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
          />
        </div>

        {#if formError}
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px; color: #b91c1c; font-size: 14px;">
            {formError}
          </div>
        {/if}

        <div style="display: flex; gap: 10px;">
          <button type="submit" class="btn" disabled={formLoading}>
            {formLoading ? "A guardar..." : "Guardar"}
          </button>
          <button type="button" class="btn" on:click={cancelForm} disabled={formLoading}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- List -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    <h3 style="margin: 0 0 16px 0;">
      Labels ({filteredLabels.length})
    </h3>

    {#if loading}
      <p style="color: var(--muted); margin: 0;">A carregar...</p>
    {:else if filteredLabels.length === 0}
      <p style="color: var(--muted); margin: 0;">Nenhuma label encontrada.</p>
    {:else}
      <div style="display: grid; gap: 12px;">
        {#each filteredLabels as label}
          <div
            style="
              border: 1px solid var(--border);
              border-radius: 10px;
              padding: 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 16px;
              {label.isActive ? '' : 'opacity: 0.5; background: #f9fafb;'}
            "
          >
            <div style="flex: 1;">
              <div style="font-weight: 500; font-size: 15px;">
                {label.name}
              </div>
              <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">
                ID: {label._id}
                {#if !label.isActive}
                  <span style="color: #b91c1c; margin-left: 8px;">● Inativa</span>
                {/if}
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-shrink: 0;">
              {#if label.isActive}
                <button
                  class="btn"
                  on:click={() => startEdit(label)}
                  disabled={isCreating || editingId}
                  style="padding: 8px 12px; font-size: 13px;"
                >
                  Editar
                </button>
                <button
                  class="btn"
                  on:click={() => openDeleteModal(label)}
                  style="padding: 8px 12px; font-size: 13px; background: #fef2f2; border-color: #fecaca; color: #b91c1c;"
                >
                  Desativar
                </button>
              {:else}
                <button
                  class="btn"
                  on:click={() => toggleActive(label)}
                  style="padding: 8px 12px; font-size: 13px; background: #ecfdf5; border-color: #bbf7d0; color: #166534;"
                >
                  Reativar
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && labelToDelete}
  <div class="modal-overlay" on:click={closeDeleteModal}>
    <div class="modal-content" on:click|stopPropagation>
      <h3 style="margin: 0 0 16px 0; font-size: 18px;">Desativar Label</h3>
      <p style="margin: 0 0 24px 0; color: var(--muted); line-height: 1.5;">
        Tem a certeza que deseja desativar a label <strong style="color: var(--text);">"{labelToDelete.name}"</strong>?
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn" type="button" on:click={closeDeleteModal}>
          Cancelar
        </button>
        <button class="btn btn-delete" type="button" on:click={confirmDelete}>
          Desativar
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
