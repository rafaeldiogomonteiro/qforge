<script>
  export let tag;
  export let isEditing = false;
  export let onEdit = () => {};
  export let onToggle = () => {};
  export let onDelete = () => {};
</script>

<div
  style="
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    {tag.isActive ? '' : 'opacity: 0.55; background: #f9fafb;'}
  "
>
  <div style="flex: 1;">
    <div style="font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px;">
      <span style="color: var(--muted);">📌</span>
      {tag.name}
    </div>
    {#if !tag.isActive}
      <div style="font-size: 12px; color: #b91c1c; margin-top: 4px;">● Inativa</div>
    {/if}
  </div>

  <div style="display: flex; gap: 8px; flex-shrink: 0;">
    {#if tag.isActive}
      <button class="btn" on:click={() => onEdit(tag)} disabled={isEditing} title="Editar etiqueta">
        Editar
      </button>
      <button
        class="btn btn-delete"
        on:click={() => onDelete(tag, "deactivate")}
        title="Desativar etiqueta"
      >
        Desativar
      </button>
      <button
        class="btn btn-delete"
        on:click={() => onDelete(tag, "delete")}
        title="Eliminar etiqueta"
      >
        Eliminar
      </button>
    {:else}
      <button
        class="btn btn-activate"
        on:click={() => onToggle(tag)}
        title="Reativar etiqueta"
      >
        Reativar
      </button>
      <button
        class="btn btn-delete"
        on:click={() => onDelete(tag, "delete")}
        title="Eliminar etiqueta"
      >
        Eliminar
      </button>
    {/if}
  </div>
</div>

<style>
  .btn {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
    cursor: pointer;
    font-size: 13px;
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
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
  }

  .btn-activate {
    background: #ecfdf5;
    border-color: #bbf7d0;
    color: #166534;
  }
</style>
