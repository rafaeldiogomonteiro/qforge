<script>
  import ChapterTagItem from "$lib/components/ChapterTagItem.svelte";
  import { createEventDispatcher } from "svelte";

  export let folder = null; // null = Sem pasta
  export let tags = [];
  export let open = false;
  export let onToggle = () => {};
  export let isEditingTag = false;
  export let onEditTag = () => {};
  export let onToggleTag = () => {};
  export let onDeleteTag = () => {};
  export let onCreateTagInFolder = () => {};
  export let onMoveExistingToFolder = () => {};

  export let onEditFolder = () => {};
  export let onToggleFolder = () => {};
  export let onDeleteFolder = () => {};

  const dispatch = createEventDispatcher();

  let localOpen = open;
  let lastPropOpen = open;
  $: if (open !== lastPropOpen) {
    lastPropOpen = open;
    localOpen = open;
  }

  function handleToggleClick() {
    localOpen = !localOpen;
    dispatch("toggle", { open: localOpen });
    if (typeof onToggle === "function") onToggle(localOpen);
  }

</script>

<div class="folder-card">
  <div class="accordion-header">
    <button class="accordion-main" type="button" on:click={handleToggleClick} aria-expanded={localOpen}>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 16px;">{folder ? "📂" : "📁"}</span>
        <div style="text-align: left;">
          <div style="font-weight: 700; font-size: 15px;">
            {folder ? folder.name : "Sem pasta"}
            <span style="color: var(--muted); font-weight: 500;">({tags.length})</span>
          </div>
          {#if folder?.description}
            <div style="font-size: 12px; color: var(--muted);">{folder.description}</div>
          {/if}
          {#if folder && !folder.isActive}
            <div style="font-size: 12px; color: #b91c1c;">● Pasta inativa</div>
          {/if}
        </div>
      </div>
    </button>

    <div class="folder-actions">
      {#if folder}
        <button class="btn" type="button" on:click|stopPropagation={() => onEditFolder(folder)}>Editar</button>
        <button class="btn" type="button" on:click|stopPropagation={() => onToggleFolder(folder)}>
          {folder.isActive ? "Desativar" : "Ativar"}
        </button>
        <button class="btn btn-delete" type="button" on:click|stopPropagation={() => onDeleteFolder(folder)}>Apagar</button>
      {/if}
      <button
        class="btn btn-toggle"
        type="button"
        on:click={handleToggleClick}
        aria-expanded={localOpen}
        aria-label={localOpen ? "Esconder etiquetas" : "Mostrar etiquetas"}
      >
        {localOpen ? "Esconder" : "Mostrar"}
        <span class="chevron" aria-hidden="true">{localOpen ? "▾" : "▸"}</span>
      </button>
    </div>
  </div>

  {#if localOpen}
    <div class="folder-body">
      <div class="folder-body-actions">
        <button class="btn" on:click={() => onCreateTagInFolder(folder ? folder._id : "")}>
          + Nova etiqueta aqui
        </button>
        <button class="btn" on:click={() => onMoveExistingToFolder(folder ? folder._id : "")}>
          Mover etiquetas existentes...
        </button>
      </div>

      {#if tags.length === 0}
        <div style="color: var(--muted); font-size: 14px;">Sem etiquetas nesta pasta.</div>
      {:else}
        <div style="display: grid; gap: 10px;">
          {#each tags as tag (tag._id)}
            <div class="tag-row">
              <ChapterTagItem
                {tag}
                isEditing={isEditingTag}
                onEdit={onEditTag}
                onToggle={onToggleTag}
                onDelete={onDeleteTag}
              />
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .folder-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: white;
    position: relative;
    overflow: visible;
  }

  .accordion-header {
    width: 100%;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
  }

  .accordion-main {
    text-align: left;
    background: transparent;
    border: none;
    width: 100%;
    cursor: pointer;
  }

  .accordion-main:hover {
    background: #f9fafb;
    border-radius: 8px;
  }

  .folder-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chevron {
    color: var(--muted);
    font-size: 16px;
  }

  .btn {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: white;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
  }

  .btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn-delete {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
  }

  .btn-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .folder-body {
    padding: 14px;
    background: #fbfbfb;
    border-top: 1px solid var(--border);
    overflow: visible;
  }

  .folder-body-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .tag-row {
    border-radius: 10px;
  }
</style>
