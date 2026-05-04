<script>
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

<div style="border-top: 1px solid #e2e8f0; padding-top: 12px;">
  <button
    style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 0; background: transparent; border: none; cursor: pointer; transition: all 0.15s;"
    type="button"
    on:click={handleToggleClick}
    aria-expanded={localOpen}
  >
    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
      <span style="font-size: 16px; color: #64748b; width: 20px; text-align: center;">
        {localOpen ? "▾" : "▸"}
      </span>
      <span style="font-size: 16px;">📂</span>
      <span style="font-size: 14px; font-weight: 600; color: #1e293b;">{folder ? folder.name : "Sem pasta"}</span>
      <span style="font-size: 12px; color: #64748b;">({tags.length} tags)</span>
      {#if folder?.description}
        <span style="font-size: 12px; color: #64748b;">— {folder.description}</span>
      {/if}
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      {#if folder}
        <button
          style="padding: 4px; background: transparent; border: none; cursor: pointer; color: #64748b; transition: all 0.15s;"
          type="button"
          on:click|stopPropagation={() => onEditFolder(folder)}
          title="Editar pasta"
        >
          ✏️
        </button>
        <button
          style="padding: 4px; background: transparent; border: none; cursor: pointer; color: #64748b; transition: all 0.15s;"
          type="button"
          on:click|stopPropagation={() => onMoveExistingToFolder(folder ? folder._id : "")}
          title="Mover tags"
        >
          ↔️
        </button>
      {/if}
    </div>
  </button>

  {#if localOpen}
    <div style="margin-top: 8px; margin-left: 32px; display: flex; flex-direction: column; gap: 0;">
      {#if tags.length === 0}
        <div style="padding: 12px 0; color: #64748b; font-size: 13px;">Sem etiquetas nesta pasta.</div>
      {:else}
        {#each tags as tag (tag._id)}
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" style="width: 16px; height: 16px;" />
              <span style="font-size: 14px; color: #1e293b;">{tag.name}</span>
              <span style="font-size: 12px; color: #64748b;">({tag.questions?.length || 0} Q)</span>
            </div>
            <button
              style="padding: 4px 8px; background: transparent; border: none; cursor: pointer; color: #64748b; transition: all 0.15s;"
              type="button"
              on:click={() => onEditTag(tag)}
              title="Editar tag"
            >
              ✏️
            </button>
          </div>
        {/each}
      {/if}
      <button
        style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #2563eb; background: transparent; border: none; cursor: pointer; padding: 8px 0; margin-top: 4px;"
        on:click={() => onCreateTagInFolder(folder ? folder._id : "")}
      >
        ➕ Adicionar tag
      </button>
    </div>
  {/if}
</div>

