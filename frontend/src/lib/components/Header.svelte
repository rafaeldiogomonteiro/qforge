<script>
  import { page } from "$app/stores";

  let breadcrumbs = [];
  let pageTitle = "Dashboard";

  $: {
    const path = $page.url.pathname;

    if (path === "/app" || path === "/app/") {
      pageTitle = "Dashboard";
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
    } else if (path.startsWith("/app/generate")) {
      pageTitle = "Gerar Questões";
      breadcrumbs = [{ label: "Dashboard", link: "/app" }, { label: "Gerar" }];
    } else if (path.startsWith("/app/labels")) {
      pageTitle = "Etiquetas";
      breadcrumbs = [{ label: "Dashboard", link: "/app" }, { label: "Etiquetas" }];
    } else if (path.startsWith("/app/chapter-tags")) {
      pageTitle = "Chapters";
      breadcrumbs = [{ label: "Dashboard", link: "/app" }, { label: "Chapters" }];
    }
  }
</script>

<div class="header">
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
    padding: 0 32px;
    z-index: 99;
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
</style>
