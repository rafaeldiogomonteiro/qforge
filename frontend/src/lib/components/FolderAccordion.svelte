<script>
  import { createEventDispatcher } from "svelte";

  export let folder = null;
  export let tags = [];
  export let open = false;
  export let onToggle = () => {};
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

<div style="border-top: 1px solid #e2e8f0; padding-top: 12px;">
  <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 0;">
    <button
      style="display: flex; align-items: center; gap: 12px; flex: 1; background: transparent; border: none; cursor: pointer; text-align: left;"
      type="button"
      on:click={handleToggleClick}
      aria-expanded={localOpen}
    >
      <span style="font-size: 16px; color: #64748b; width: 20px; text-align: center;">
        {localOpen ? "▾" : "▸"}
      </span>
      <span style="font-size: 16px;">📂</span>
      <span style="font-size: 14px; font-weight: 600; color: #1e293b;">{folder ? folder.name : "Sem pasta"}</span>
      <span style="font-size: 12px; color: #64748b;">({tags.length} chapters)</span>
      {#if folder?.description}
        <span style="font-size: 12px; color: #64748b;">- {folder.description}</span>
      {/if}
      {#if folder && !folder.isActive}
        <span style="font-size: 12px; color: #b91c1c;">Inativa</span>
      {/if}
    </button>

    {#if folder}
      <div style="display: flex; align-items: center; gap: 6px;">
        <button class="icon-action" type="button" on:click={() => onEditFolder(folder)} title="Editar pasta">Editar</button>
        <button class="icon-action" type="button" on:click={() => onMoveExistingToFolder(folder._id)} title="Mover chapters">Mover</button>
        <button class="icon-action" type="button" on:click={() => onToggleFolder(folder)} title={folder.isActive ? "Desativar pasta" : "Reativar pasta"}>
          {folder.isActive ? "Desativar" : "Reativar"}
        </button>
        <button class="icon-action danger" type="button" on:click={() => onDeleteFolder(folder)} title="Eliminar pasta">Eliminar</button>
      </div>
    {/if}
  </div>

  {#if localOpen}
    <div style="margin-top: 8px; margin-left: 32px; display: flex; flex-direction: column; gap: 0;">
      {#if tags.length === 0}
        <div style="padding: 12px 0; color: #64748b; font-size: 13px;">Sem chapters nesta pasta.</div>
      {:else}
        {#each tags as tag (tag._id)}
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14px; color: #1e293b;">{tag.name}</span>
              <span style="font-size: 12px; color: #64748b;">({tag.questions?.length || 0} Q)</span>
              {#if !tag.isActive}
                <span style="font-size: 12px; color: #b91c1c;">Inativo</span>
              {/if}
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="icon-action" type="button" on:click={() => onEditTag(tag)}>Editar</button>
              <button class="icon-action" type="button" on:click={() => onToggleTag(tag)}>
                {tag.isActive ? "Desativar" : "Reativar"}
              </button>
              <button class="icon-action danger" type="button" on:click={() => onDeleteTag(tag)}>Eliminar</button>
            </div>
          </div>
        {/each}
      {/if}
      <button
        style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #2563eb; background: transparent; border: none; cursor: pointer; padding: 8px 0; margin-top: 4px;"
        type="button"
        on:click={() => onCreateTagInFolder(folder ? folder._id : "")}
      >
        + Adicionar chapter
      </button>
    </div>
  {/if}
</div>

<style>
  .icon-action {
    padding: 5px 8px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    color: #334155;
    font-size: 12px;
  }

  .icon-action:hover {
    background: #f8fafc;
  }

  .icon-action.danger {
    color: #b91c1c;
  }
</style>
