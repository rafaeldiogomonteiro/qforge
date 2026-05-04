<script>
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Header from "$lib/components/Header.svelte";
</script>

<div style="display: flex; min-height: 100vh;">
  <Sidebar />
  
  <div style="margin-left: 210px; flex: 1; background: #f8fafc;">
    <Header />
    
    <main style="padding: 100px 32px 32px 32px; max-width: 1600px; margin: 0 auto;">
      <slot />
    </main>
  </div>
</div>

<style global>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f8fafc;
    color: #0f172a;
  }
</style>
