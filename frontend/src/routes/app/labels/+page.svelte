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
  let deleteMode = "deactivate"; // deactivate | delete

  onMount(loadLabels);

  async function loadLabels() {
    loading = true;
    error = "";
    try {
      const params = showInactive ? "?includeInactive=1" : "";
      const { data } = await api.get(`/labels${params}`);
      labels = Array.isArray(data) ? data : [];
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao carregar etiquetas";
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
      formError = e?.response?.data?.error || "Erro ao guardar etiqueta";
    } finally {
      formLoading = false;
    }
  }

  async function toggleActive(label) {
    try {
      await api.put(`/labels/${label._id}`, { isActive: !label.isActive });
      await loadLabels();
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao atualizar etiqueta";
    }
  }

  function openDeleteModal(label, mode = "deactivate") {
    labelToDelete = label;
    showDeleteModal = true;
    deleteMode = mode;
  }
  
  function closeDeleteModal() {
    showDeleteModal = false;
    labelToDelete = null;
  }
  
  async function confirmDelete() {
    if (!labelToDelete) return;
    
    try {
      const url = deleteMode === "delete"
        ? `/labels/${labelToDelete._id}?force=1`
        : `/labels/${labelToDelete._id}`;

      await api.delete(url);
      showDeleteModal = false;
      labelToDelete = null;
      await loadLabels();
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao eliminar etiqueta";
      showDeleteModal = false;
    }
  }

  $: filteredLabels = labels;
</script>

<div style="display: flex; flex-direction: column; gap: 24px;">
  <!-- Header -->
  <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1e293b;">Etiquetas</h1>
      <p style="margin: 6px 0 0; font-size: 14px; color: #64748b;">
        Gerir etiquetas para categorizar questões
      </p>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 12px;">
      <button
        style="padding: 10px 16px; background: {showInactive ? '#2563eb' : 'white'}; color: {showInactive ? 'white' : '#1e293b'}; border: 1px solid {showInactive ? '#2563eb' : '#e2e8f0'}; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s;"
        on:click={() => { showInactive = !showInactive; loadLabels(); }}
      >
        Mostrar Inativas
      </button>
      <button
        class="btn"
        on:click={startCreate}
        disabled={isCreating || editingId}
        style="padding: 10px 16px; background: #2563eb; color: white; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; transition: background 0.2s; display: flex; align-items: center; gap: 6px;"
      >
        ➕ Criar Etiqueta
      </button>
    </div>
  </div>

  {#if error}
    <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; color: #991b1b; font-size: 14px;">
      {error}
    </div>
  {/if}

  <!-- List de Etiquetas -->
  <div style="display: flex; flex-direction: column; gap: 12px;">

  <!-- Create/Edit Form -->
  {#if isCreating || editingId}
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
      <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
        {editingId ? "Editar Etiqueta" : "Criar Nova Etiqueta"}
      </h2>

      <form on:submit|preventDefault={submitForm}>
        <div style="display: grid; gap: 12px;">
          <div>
            <label style="font-size: 14px; color: #1e293b; display: block; margin-bottom: 6px; font-weight: 500;">
              Nome *
            </label>
            <input
              bind:value={formName}
              type="text"
              placeholder="ex: Época Normal"
              disabled={formLoading}
              style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;"
            />
          </div>

          {#if formError}
            <div style="background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; font-size: 13px;">
              {formError}
            </div>
          {/if}

          <div style="display: flex; gap: 10px; padding-top: 8px;">
            <button type="submit" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
              {formLoading ? "A guardar..." : "Guardar"}
            </button>
            <button type="button" on:click={cancelForm} disabled={formLoading} style="padding: 10px 20px; background: white; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px;">
              Cancelar
            </button>
          </div>
        </div>
      </form>
    </div>
  {/if}

  {#if loading}
    <p style="color: #64748b; text-align: center; padding: 32px;">A carregar etiquetas…</p>
  {:else if filteredLabels.length === 0}
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 48px 24px; text-align: center;">
      <p style="font-size: 16px; color: #1e293b; margin: 0 0 8px 0;">Nenhuma etiqueta encontrada</p>
      <p style="font-size: 14px; color: #64748b; margin: 0;">
        {#if filteredLabels.length === 0 && !showInactive}
          Crie a sua primeira etiqueta para começar
        {:else}
          Tente outra pesquisa
        {/if}
      </p>
    </div>
  {:else}
    {#each filteredLabels as label}
      <div
        style="
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          {!label.isActive ? 'opacity: 0.6; background: #f8fafc;' : ''}
        "
      >
        <div style="flex: 1;">
          <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1e293b;">
            🏷️ {label.name}
          </h3>
          {#if !label.isActive}
            <div style="font-size: 12px; color: #ef4444; margin-top: 4px;">Inativa</div>
          {/if}
        </div>

        <div style="display: flex; gap: 8px;">
          {#if label.isActive}
            <button
              on:click={() => startEdit(label)}
              disabled={isCreating || editingId}
              style="padding: 8px 12px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
            >
              ✏️ Editar
            </button>
            <button
              on:click={() => openDeleteModal(label, "deactivate")}
              style="padding: 8px 12px; background: #fee2e2; color: #991b1b; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
            >
              × Desativar
            </button>
          {:else}
            <button
              on:click={() => toggleActive(label)}
              style="padding: 8px 12px; background: #ecfdf5; color: #166534; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
            >
              ↺ Reativar
            </button>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && labelToDelete}
  <div class="modal-overlay" on:click={closeDeleteModal}>
    <div class="modal-content" on:click|stopPropagation>
      <h3 style="margin: 0 0 14px 0; font-size: 18px;">Gestão da etiqueta</h3>
      <p style="margin: 0 0 14px 0; color: var(--muted); line-height: 1.5;">
        O que pretendes fazer com <strong style="color: var(--text);">"{labelToDelete.name}"</strong>?
      </p>

      <div style="display: grid; gap: 8px; margin-bottom: 18px;">
        <label class="option-row">
          <input type="radio" name="deleteMode" value="deactivate" bind:group={deleteMode} />
          <div>
            <div style="font-weight: 600;">Desativar</div>
            <div class="option-help">Fica inativa e pode ser reativada depois.</div>
          </div>
        </label>

        <label class="option-row">
          <input type="radio" name="deleteMode" value="delete" bind:group={deleteMode} />
          <div>
            <div style="font-weight: 600; color: #b91c1c;">Eliminar definitivamente</div>
            <div class="option-help">Remove a etiqueta e limpa as referências nas questões.</div>
          </div>
        </label>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn" type="button" on:click={closeDeleteModal}>
          Cancelar
        </button>
        <button class="btn btn-delete" type="button" on:click={confirmDelete}>
          {deleteMode === "delete" ? "Eliminar" : "Desativar"}
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
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .option-row {
    display: flex;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .option-row:hover {
    background: var(--muted-bg);
    border-color: #d1d5db;
  }
  
  .option-row input[type="radio"] {
    margin-top: 2px;
  }
  
  .option-help {
    font-size: 12px;
    color: var(--muted);
    margin-top: 2px;
  }
</style>
