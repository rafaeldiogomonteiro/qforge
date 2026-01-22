<script>
  import "./layout.css";
  import { isAuthed, logout } from "$lib/stores/auth";
</script>

<div class="app">
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/">QForge</a>

      {#if $isAuthed}
        <nav class="nav">
          <a href="/app">Dashboard</a>
          <a href="/app/banks">Bancos</a>
          <button class="btn" on:click={logout}>Sair</button>
        </nav>
      {:else}
        <nav class="nav">
          <a href="/login">Entrar</a>
        </nav>
      {/if}
    </div>
  </header>

  <main class="container">
    <slot />
  </main>
</div>
