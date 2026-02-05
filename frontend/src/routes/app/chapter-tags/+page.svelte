<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";
  import FolderAccordion from "$lib/components/FolderAccordion.svelte";

  let groups = [];
  let loading = true;
  let error = "";

  let showInactive = false;
  let searchTerm = "";
  let openFolderIds = [];
  let didInitOpenState = false;

  // Tag form
  let tagFormMode = "none"; // create | edit | none
  let tagForm = { id: null, name: "", folderId: "" };
  let tagFormError = "";
  let tagFormLoading = false;

  // Folder form
  let folderFormMode = "none"; // create | edit | none
  let folderForm = { id: null, name: "", description: "", isActive: true };
  let folderFormError = "";
  let folderFormLoading = false;

  // Deletes
  let deletingTag = null;
  let deletingFolder = null;
  let moveFolderContents = false;

  // Move existing tags into a folder (no drag-and-drop)
  let moveTagsModalOpen = false;
  let moveTagsTargetFolderId = ""; // "" = Sem pasta
  let moveTagsSearch = "";
  let moveTagsSelected = new Set();
  let moveTagsSelectAllEl;
  let moveTagsLoading = false;
  let moveTagsError = "";

  onMount(loadData);

  $: selectableFolders = groups
    .filter((g) => g.folder && g.folder.isActive)
    .map((g) => g.folder);

  $: normalizedSearch = searchTerm.trim().toLowerCase();
  $: filteredGroups = groups
    .map((g) => {
      const filteredTags = g.tags.filter((tag) =>
        normalizedSearch ? tag.name.toLowerCase().includes(normalizedSearch) : true
      );
      return { ...g, tags: filteredTags };
    })
    .filter((g) => (normalizedSearch ? g.tags.length > 0 : true));

  $: totalTags = groups.reduce((sum, g) => sum + (g.tags?.length || 0), 0);
  $: totalFolders = groups.filter((g) => g.folder).length;

  $: sortableFolders = filteredGroups.filter((g) => g.folder);

  function folderKey(folder) {
    return folder ? String(folder._id) : "__none__";
  }

  function isFolderOpen(folder) {
    return openFolderIds.includes(folderKey(folder));
  }

  function toggleFolderOpen(folder) {
    const key = folderKey(folder);
    openFolderIds = openFolderIds.includes(key)
      ? openFolderIds.filter((k) => k !== key)
      : [...openFolderIds, key];
  }

  async function persistReorder(ids, onError) {
    try {
      await api.patch("/folders/reorder", { orderedIds: ids });
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao reordenar pastas";
      if (onError) onError();
    }
  }

  function allTagsFlat() {
    return groups.flatMap((g) => g.tags || []);
  }

  function openMoveTagsModal(targetFolderId) {
    moveTagsModalOpen = true;
    moveTagsTargetFolderId = targetFolderId ? String(targetFolderId) : "";
    moveTagsSearch = "";
    moveTagsSelected = new Set();
    moveTagsError = "";
  }

  function closeMoveTagsModal() {
    moveTagsModalOpen = false;
    moveTagsTargetFolderId = "";
    moveTagsSearch = "";
    moveTagsSelected = new Set();
    moveTagsError = "";
    moveTagsLoading = false;
  }

  function handleWindowKeydown(e) {
    if (e.key !== "Escape") return;

    if (moveTagsModalOpen) closeMoveTagsModal();
    if (deletingTag) closeDeleteTag();
    if (deletingFolder) closeDeleteFolder();
  }

  function toggleMoveTagSelection(tagId) {
    const next = new Set(moveTagsSelected);
    const key = String(tagId);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    moveTagsSelected = next;
  }

  $: moveTargetNormalized = moveTagsTargetFolderId ? String(moveTagsTargetFolderId) : "";
  $: moveCandidates = allTagsFlat()
    .filter((t) => {
      const currentFolder = t.folder ? String(t.folder) : "";
      // hide tags already in the target folder
      return currentFolder !== moveTargetNormalized;
    })
    .filter((t) => {
      const q = moveTagsSearch.trim().toLowerCase();
      return q ? String(t.name || "").toLowerCase().includes(q) : true;
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  $: moveVisibleIds = moveCandidates.map((t) => String(t._id));
  $: moveVisibleSelectedCount = moveVisibleIds.reduce(
    (sum, id) => sum + (moveTagsSelected.has(id) ? 1 : 0),
    0
  );
  $: moveAllVisibleSelected = moveVisibleIds.length > 0 && moveVisibleSelectedCount === moveVisibleIds.length;
  $: moveSomeVisibleSelected = moveVisibleSelectedCount > 0 && !moveAllVisibleSelected;
  $: if (moveTagsSelectAllEl) moveTagsSelectAllEl.indeterminate = moveSomeVisibleSelected;

  function setSelectAllVisible(checked) {
    const next = new Set(moveTagsSelected);
    if (checked) {
      moveVisibleIds.forEach((id) => next.add(id));
    } else {
      moveVisibleIds.forEach((id) => next.delete(id));
    }
    moveTagsSelected = next;
  }

  function clearMoveSelection() {
    moveTagsSelected = new Set();
  }

  async function submitMoveTags() {
    moveTagsError = "";
    const ids = Array.from(moveTagsSelected);
    if (ids.length === 0) {
      moveTagsError = "Seleciona pelo menos uma etiqueta";
      return;
    }

    moveTagsLoading = true;
    try {
      const payload = { folderId: moveTagsTargetFolderId || null };
      await Promise.all(ids.map((id) => api.put(`/chapter-tags/${id}`, payload)));
      closeMoveTagsModal();
      await loadData();
    } catch (e) {
      moveTagsError = e?.response?.data?.error || "Erro ao mover etiquetas";
    } finally {
      moveTagsLoading = false;
    }
  }

  async function loadData() {
    loading = true;
    error = "";
    try {
      const params = showInactive ? "?includeInactive=1" : "";
      const { data } = await api.get(`/chapter-tags/grouped${params}`);
      groups = Array.isArray(data) ? data : [];
      const availableKeys = new Set(groups.map((g) => folderKey(g.folder)));

      if (!didInitOpenState) {
        // Start collapsed by default (dropdown behavior)
        openFolderIds = [];
        didInitOpenState = true;
      } else {
        // Keep user's open/closed state; drop keys that no longer exist
        openFolderIds = openFolderIds.filter((k) => availableKeys.has(k));
      }
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao carregar etiquetas e pastas";
    } finally {
      loading = false;
    }
  }

  // Tag form helpers
  function startCreateTag(folderId = "") {
    tagFormMode = "create";
    tagForm = { id: null, name: "", folderId: folderId ? String(folderId) : "" };
    tagFormError = "";
  }

  function startEditTag(tag) {
    tagFormMode = "edit";
    tagForm = { id: tag._id, name: tag.name, folderId: tag.folder ? String(tag.folder) : "" };
    tagFormError = "";
  }

  function cancelTagForm() {
    tagFormMode = "none";
    tagForm = { id: null, name: "", folderId: "" };
    tagFormError = "";
  }

  async function submitTagForm() {
    tagFormError = "";
    const trimmed = tagForm.name.trim();
    if (!trimmed) {
      tagFormError = "Nome é obrigatório";
      return;
    }

    tagFormLoading = true;
    const payload = {
      name: trimmed,
      folderId: tagForm.folderId || null,
    };

    try {
      if (tagFormMode === "edit" && tagForm.id) {
        await api.put(`/chapter-tags/${tagForm.id}`, payload);
      } else {
        await api.post("/chapter-tags", payload);
      }

      cancelTagForm();
      await loadData();
    } catch (e) {
      tagFormError = e?.response?.data?.error || "Erro ao guardar etiqueta";
    } finally {
      tagFormLoading = false;
    }
  }

  async function toggleTag(tag) {
    try {
      await api.put(`/chapter-tags/${tag._id}`, { isActive: !tag.isActive });
      await loadData();
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao atualizar etiqueta";
    }
  }

  function confirmDeleteTag(tag) {
    deletingTag = tag;
  }

  function closeDeleteTag() {
    deletingTag = null;
  }

  async function deleteTag() {
    if (!deletingTag) return;
    try {
      await api.delete(`/chapter-tags/${deletingTag._id}`);
      deletingTag = null;
      await loadData();
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao eliminar etiqueta";
      deletingTag = null;
    }
  }

  // (Drag-and-drop de ordenação/movimento removido)

  // Folder form helpers
  function startCreateFolder() {
    folderFormMode = "create";
    folderForm = { id: null, name: "", description: "", isActive: true };
    folderFormError = "";
  }

  function startEditFolder(folder) {
    folderFormMode = "edit";
    folderForm = {
      id: folder._id,
      name: folder.name,
      description: folder.description || "",
      isActive: folder.isActive,
    };
    folderFormError = "";
  }

  function cancelFolderForm() {
    folderFormMode = "none";
    folderForm = { id: null, name: "", description: "", isActive: true };
    folderFormError = "";
  }

  async function submitFolderForm() {
    folderFormError = "";
    const trimmed = folderForm.name.trim();
    if (!trimmed) {
      folderFormError = "Nome da pasta é obrigatório";
      return;
    }

    folderFormLoading = true;
    const payload = {
      name: trimmed,
      description: folderForm.description,
      isActive: folderForm.isActive,
    };

    try {
      if (folderFormMode === "edit" && folderForm.id) {
        await api.patch(`/folders/${folderForm.id}`, payload);
      } else {
        await api.post("/folders", payload);
      }

      cancelFolderForm();
      await loadData();
    } catch (e) {
      folderFormError = e?.response?.data?.error || "Erro ao guardar pasta";
    } finally {
      folderFormLoading = false;
    }
  }

  async function toggleFolder(folder) {
    try {
      await api.patch(`/folders/${folder._id}`, { isActive: !folder.isActive });
      await loadData();
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao atualizar pasta";
    }
  }

  function confirmDeleteFolder(folder) {
    deletingFolder = folder;
    moveFolderContents = false;
  }

  function closeDeleteFolder() {
    deletingFolder = null;
    moveFolderContents = false;
  }

  async function deleteFolder(moveToNone = false) {
    if (!deletingFolder) return;
    try {
      const suffix = moveToNone ? "?moveToNone=1" : "";
      await api.delete(`/folders/${deletingFolder._id}${suffix}`);
      deletingFolder = null;
      moveFolderContents = false;
      await loadData();
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao apagar pasta";
      deletingFolder = null;
      moveFolderContents = false;
    }
  }
</script>

<div style="max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; display: grid; gap: 12px;">
    <div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;">
      <div>
        <h2 style="margin: 0;">Gestão de etiquetas de capítulo</h2>
        <p style="margin: 6px 0 0; color: var(--muted); font-size: 14px;">
          Organiza etiquetas por pastas para navegar mais rápido. Usa pesquisa global ou filtra inativas.
        </p>
        <div style="margin-top: 8px; color: var(--muted); font-size: 13px; display: flex; gap: 12px;">
          <span>{totalFolders} pastas</span>
          <span>{totalTags} etiquetas</span>
        </div>
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn" on:click={startCreateFolder}>+ Nova pasta</button>
        <button class="btn primary" on:click={() => startCreateTag("")}>+ Nova etiqueta</button>
      </div>
    </div>

    <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
      <input
        placeholder="Procurar etiqueta..."
        value={searchTerm}
        on:input={(e) => (searchTerm = e.target.value)}
        style="flex: 1; min-width: 260px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px;"
      />
      <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;">
        <input type="checkbox" bind:checked={showInactive} on:change={loadData} />
        Mostrar inativas
      </label>
    </div>
  </div>

  {#if error}
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px; color: #b91c1c;">
      {error}
    </div>
  {/if}

  {#if tagFormMode !== "none"}
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: grid; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0;">{tagFormMode === "edit" ? "Editar etiqueta" : "Nova etiqueta"}</h3>
        <button class="btn" on:click={cancelTagForm} disabled={tagFormLoading}>Fechar</button>
      </div>

      <div style="display: grid; gap: 12px;">
        <div>
          <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">Nome</label>
          <input
            value={tagForm.name}
            on:input={(e) => (tagForm.name = e.target.value)}
            placeholder="ex: HTML"
            disabled={tagFormLoading}
            style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
          />
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">Pasta</label>
          <select
            bind:value={tagForm.folderId}
            disabled={tagFormLoading}
            style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: white;"
          >
            <option value="">Sem pasta</option>
            {#each selectableFolders as folder}
              <option value={folder._id}>{folder.name}</option>
            {/each}
          </select>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Apenas pastas ativas aparecem aqui.</div>
        </div>

        {#if tagFormError}
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c;">{tagFormError}</div>
        {/if}

        <div style="display: flex; gap: 10px;">
          <button class="btn primary" on:click|preventDefault={submitTagForm} disabled={tagFormLoading}>
            {tagFormLoading ? "A guardar..." : "Guardar"}
          </button>
          <button class="btn" type="button" on:click={cancelTagForm} disabled={tagFormLoading}>Cancelar</button>
        </div>
      </div>
    </div>
  {/if}

  {#if folderFormMode !== "none"}
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: grid; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0;">{folderFormMode === "edit" ? "Editar pasta" : "Nova pasta"}</h3>
        <button class="btn" on:click={cancelFolderForm} disabled={folderFormLoading}>Fechar</button>
      </div>

      <div style="display: grid; gap: 12px;">
        <div>
          <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">Nome</label>
          <input
            value={folderForm.name}
            on:input={(e) => (folderForm.name = e.target.value)}
            placeholder="ex: Programação I"
            disabled={folderFormLoading}
            style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
          />
        </div>

        <div>
          <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">Descrição (opcional)</label>
          <textarea
            value={folderForm.description}
            on:input={(e) => (folderForm.description = e.target.value)}
            rows="2"
            disabled={folderFormLoading}
            style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
          ></textarea>
        </div>

        <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; width: fit-content;">
          <input type="checkbox" bind:checked={folderForm.isActive} disabled={folderFormLoading} />
          Pasta ativa
        </label>

        {#if folderFormError}
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c;">{folderFormError}</div>
        {/if}

        <div style="display: flex; gap: 10px;">
          <button class="btn primary" on:click|preventDefault={submitFolderForm} disabled={folderFormLoading}>
            {folderFormLoading ? "A guardar..." : "Guardar"}
          </button>
          <button class="btn" type="button" on:click={cancelFolderForm} disabled={folderFormLoading}>Cancelar</button>
        </div>
      </div>
    </div>
  {/if}

  <div style="display: grid; gap: 12px;">
    {#if loading}
      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 16px; color: var(--muted);">A carregar...</div>
    {:else if filteredGroups.length === 0}
      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 16px; color: var(--muted);">Nenhuma etiqueta encontrada.</div>
    {:else}
      <div style="display: grid; gap: 12px;">
        {#each sortableFolders as group (group.folder._id)}
          <FolderAccordion
            folder={group.folder}
            tags={group.tags}
            open={isFolderOpen(group.folder)}
            on:toggle={() => toggleFolderOpen(group.folder)}
            isEditingTag={tagFormMode !== "none"}
            onEditTag={startEditTag}
            onToggleTag={toggleTag}
            onDeleteTag={confirmDeleteTag}
            onEditFolder={startEditFolder}
            onToggleFolder={toggleFolder}
            onDeleteFolder={confirmDeleteFolder}
              onCreateTagInFolder={startCreateTag}
              onMoveExistingToFolder={openMoveTagsModal}
          />
        {/each}
      </div>

      {#each filteredGroups.filter((g) => !g.folder) as group}
        <FolderAccordion
          folder={group.folder}
          tags={group.tags}
          open={isFolderOpen(group.folder)}
          on:toggle={() => toggleFolderOpen(group.folder)}
          isEditingTag={tagFormMode !== "none"}
          onEditTag={startEditTag}
          onToggleTag={toggleTag}
          onDeleteTag={confirmDeleteTag}
          onCreateTagInFolder={startCreateTag}
          onMoveExistingToFolder={openMoveTagsModal}
        />
      {/each}
    {/if}
  </div>
</div>

<svelte:window on:keydown={handleWindowKeydown} />

{#if moveTagsModalOpen}
  <div class="modal-overlay" role="presentation">
    <button
      type="button"
      class="modal-overlay-click"
      aria-label="Fechar modal"
      on:click={closeMoveTagsModal}
    ></button>

    <div class="modal-content" role="dialog" aria-modal="true" tabindex="-1">
      <div style="display:flex; justify-content: space-between; align-items:center; gap: 12px;">
        <h3 style="margin: 0;">Mover etiquetas existentes</h3>
        <button class="btn" on:click={closeMoveTagsModal} disabled={moveTagsLoading}>Fechar</button>
      </div>

      <p style="margin: 8px 0 14px 0; color: var(--muted);">
        Destino: <strong>{moveTagsTargetFolderId ? selectableFolders.find((f) => String(f._id) === String(moveTagsTargetFolderId))?.name || "(Pasta)" : "Sem pasta"}</strong>
      </p>

      <input
        placeholder="Procurar etiqueta..."
        value={moveTagsSearch}
        on:input={(e) => (moveTagsSearch = e.target.value)}
        style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px;"
        disabled={moveTagsLoading}
      />

      <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;">
          <input
            type="checkbox"
            bind:this={moveTagsSelectAllEl}
            checked={moveAllVisibleSelected}
            on:change={(e) => setSelectAllVisible(e.target.checked)}
            disabled={moveTagsLoading || moveCandidates.length === 0}
          />
          Selecionar todas ({moveCandidates.length})
        </label>
        <button
          class="btn"
          type="button"
          on:click={clearMoveSelection}
          disabled={moveTagsLoading || moveTagsSelected.size === 0}
        >
          Limpar seleção
        </button>
      </div>

      {#if moveTagsError}
        <div style="margin-top: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 10px; color: #b91c1c;">
          {moveTagsError}
        </div>
      {/if}

      <div style="margin-top: 12px; border: 1px solid var(--border); border-radius: 12px; background: white; max-height: 320px; overflow: auto;">
        {#if moveCandidates.length === 0}
          <div style="padding: 12px; color: var(--muted);">Sem etiquetas disponíveis para mover.</div>
        {:else}
          {#each moveCandidates as tag (tag._id)}
            <label style="display:flex; align-items:center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #f3f4f6; cursor: pointer;">
              <input
                type="checkbox"
                checked={moveTagsSelected.has(String(tag._id))}
                on:change={() => toggleMoveTagSelection(tag._id)}
                disabled={moveTagsLoading}
              />
              <span style="flex: 1;">{tag.name}</span>
              <span style="color: var(--muted); font-size: 12px;">
                {tag.folder ? "📂" : "📁"}
              </span>
            </label>
          {/each}
        {/if}
      </div>

      <div style="margin-top: 14px; display:flex; justify-content: flex-end; gap: 10px;">
        <button class="btn" on:click={closeMoveTagsModal} disabled={moveTagsLoading}>Cancelar</button>
        <button class="btn primary" on:click={submitMoveTags} disabled={moveTagsLoading}>
          {moveTagsLoading ? "A mover..." : `Mover (${moveTagsSelected.size})`}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if deletingTag}
  <div class="modal-overlay" role="presentation">
    <button
      type="button"
      class="modal-overlay-click"
      aria-label="Fechar modal"
      on:click={closeDeleteTag}
    ></button>

    <div class="modal-content" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="delete-tag-title">
      <h3 id="delete-tag-title" style="margin: 0 0 12px 0;">Desativar etiqueta</h3>
      <p style="margin: 0 0 20px 0; color: var(--muted);">Confirmas desativar "{deletingTag.name}"?</p>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="btn" on:click={closeDeleteTag}>Cancelar</button>
        <button class="btn btn-delete" on:click={deleteTag}>Desativar</button>
      </div>
    </div>
  </div>
{/if}

{#if deletingFolder}
  <div class="modal-overlay" role="presentation">
    <button
      type="button"
      class="modal-overlay-click"
      aria-label="Fechar modal"
      on:click={closeDeleteFolder}
    ></button>

    <div class="modal-content" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="delete-folder-title">
      <h3 id="delete-folder-title" style="margin: 0 0 12px 0;">Apagar pasta</h3>
      <p style="margin: 0 0 12px 0; color: var(--muted);">Escolhe a ação para "{deletingFolder.name}".</p>
      <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 10px;">
        <input type="checkbox" bind:checked={moveFolderContents} />
        Mover etiquetas para "Sem pasta" e apagar
      </label>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="btn" on:click={closeDeleteFolder}>Cancelar</button>
        <button class="btn btn-delete" on:click={() => deleteFolder(moveFolderContents)}>Apagar</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .btn {
    padding: 10px 14px;
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
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn.primary {
    background: #111827;
    color: white;
    border-color: #111827;
  }

  .btn.primary:hover:not(:disabled) {
    background: #0f172a;
    border-color: #0f172a;
  }

  .btn-delete {
    background: #dc2626;
    color: white;
    border-color: #dc2626;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-overlay-click {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: default;
  }

  .modal-content {
    position: relative;
    z-index: 1;
    background: white;
    border-radius: 14px;
    padding: 18px;
    width: min(480px, 92vw);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
    animation: modalFadeIn 0.18s ease-out;
  }

  @keyframes modalFadeIn {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
