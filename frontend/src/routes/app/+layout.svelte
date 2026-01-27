<script>
  import Sidebar from "$lib/components/Sidebar.svelte";
</script>

<div style="display: flex; min-height: 100vh;">
  <Sidebar />
  
  <div style="margin-left: 260px; flex: 1; background: #f9fafb;">
    <main style="padding: 24px;">
      <slot />
    </main>
  </div>
</div>
