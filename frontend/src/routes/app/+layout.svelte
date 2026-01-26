<script>
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { logout } from "$lib/stores/auth";
</script>

<div style="display: flex; min-height: 100vh;">
  <Sidebar />
  
  <div style="margin-left: 260px; flex: 1; background: #f9fafb;">
    <!-- Top bar -->
    <header style="background: white; border-bottom: 1px solid #e5e7eb; padding: 16px 24px; display: flex; justify-content: flex-end; align-items: center;">
      <button 
        class="btn" 
        on:click={logout}
        style="padding: 8px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: white; cursor: pointer; font-size: 14px;"
      >
        Sair
      </button>
    </header>

    <!-- Content -->
    <main style="padding: 24px;">
      <slot />
    </main>
  </div>
</div>

<style>
  .btn:hover {
    background: #f9fafb;
  }
</style>
