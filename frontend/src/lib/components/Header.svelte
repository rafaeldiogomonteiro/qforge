<script>
  import { page } from "$app/stores";
  import { currentUser } from "$lib/stores/user";

  let breadcrumbs = [];
  let pageTitle = "Dashboard";
  let searchQuery = "";

  $: {
    const path = $page.url.pathname;
    
    if (path === "/app" || path === "/app/") {
      pageTitle = "Dashboard de Estado";
      breadcrumbs = [{ label: "Dashboard" }];
    } else if (path.startsWith("/app/banks")) {
      pageTitle = "Bancos de Questões";
      breadcrumbs = [{ label: "Dashboard", link: "/app" }, { label: "Bancos" }];
    } else if (path.startsWith("/app/test-generation")) {
      pageTitle = "Geração de Testes Completos";
      breadcrumbs = [{ label: "Dashboard", link: "/app" }, { label: "Geração de Testes" }];
    } else if (path.startsWith("/app/moodle")) {
      pageTitle = "Integração Moodle";
      breadcrumbs = [{ label: "Dashboard", link: "/app" }, { label: "Moodle" }];
    } else if (path.startsWith("/app/audit")) {
      pageTitle = "Histórico / Auditoria";
      breadcrumbs = [{ label: "Dashboard", link: "/app" }, { label: "Histórico" }];
    } else if (path.startsWith("/app/profile")) {
      pageTitle = "Perfil";
      breadcrumbs = [{ label: "Dashboard", link: "/app" }, { label: "Perfil" }];
    }
  }
</script>

<div class="header">
  <div class="header-left">
    <div class="page-info">
      <h1 class="page-title">{pageTitle}</h1>
      <nav class="breadcrumbs">
        {#each breadcrumbs as crumb, i}
          {#if i > 0}<span class="separator">›</span>{/if}
          {#if crumb.link}
            <a href={crumb.link} class="breadcrumb-link">{crumb.label}</a>
          {:else}
            <span class="breadcrumb-text">{crumb.label}</span>
          {/if}
        {/each}
      </nav>
    </div>
  </div>

  <div class="header-right">
    <div class="search-container">
      <input 
        type="text" 
        placeholder="Pesquisar..." 
        class="search-input"
        bind:value={searchQuery}
      />
      <span class="search-icon">🔍</span>
    </div>

    <button class="icon-btn notifications">
      <span>🔔</span>
      <span class="badge">1</span>
    </button>

    <div class="profile-menu">
      <button class="profile-btn">
        👤
      </button>
    </div>
  </div>
</div>

<style>
  .header {
    position: fixed;
    top: 0;
    left: 210px;
    right: 0;
    height: 72px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
    z-index: 99;
  }

  .header-left {
    flex: 1;
  }

  .page-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .page-title {
    font-size: 20px;
    font-weight: 600;
    color: #0f172a;
    margin: 0;
  }

  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #64748b;
  }

  .breadcrumb-link {
    color: #64748b;
    text-decoration: none;
    transition: color 0.15s;
  }

  .breadcrumb-link:hover {
    color: #2563eb;
  }

  .breadcrumb-text {
    color: #64748b;
  }

  .separator {
    margin: 0 4px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .search-container {
    position: relative;
    width: 240px;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px 10px 38px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 13px;
    background: #f8fafc;
    transition: all 0.15s;
  }

  .search-input:focus {
    outline: none;
    border-color: #2563eb;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    color: #94a3b8;
  }

  .icon-btn {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  .icon-btn.notifications {
    position: relative;
  }

  .badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ef4444;
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
  }

  .profile-btn {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: all 0.15s;
  }

  .profile-btn:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }
</style>
