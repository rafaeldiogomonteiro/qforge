<script>
  import { page } from "$app/stores";
  import { logout } from "$lib/stores/auth";
  import { currentUser } from "$lib/stores/user";
  
  const menuItems = [
    { href: "/app", label: "Painel", icon: "📊" },
    { href: "/app/banks", label: "Bancos de Questões", icon: "🗂️" },
    { href: "/app/generate", label: "Gerar com IA", icon: "🤖" },
    { href: "/app/test-generation", label: "Geração de Testes", icon: "📝" },
    { href: "/app/moodle", label: "Integração Moodle", icon: "🔗" },
    { href: "/app/audit-history", label: "Auditoria", icon: "📋" },
    { href: "/app/labels", label: "Etiquetas", icon: "🏷️" },
    { href: "/app/chapter-tags", label: "Capítulos", icon: "📚" }
  ];

  $: currentPath = $page.url.pathname;
  $: userName = $currentUser?.name || "Utilizador";
  
  function isActive(href) {
    if (href === "/app") {
      return currentPath === "/app";
    }
    return currentPath.startsWith(href);
  }
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <a href="/app" class="sidebar-brand">
      <span class="brand-icon">⚡</span>
      <span class="brand-text">QForge</span>
    </a>
  </div>

  <nav class="sidebar-nav">
    {#each menuItems as item}
      <a 
        href={item.href} 
        class="nav-item"
        class:active={isActive(item.href)}
      >
        <span class="nav-icon">{item.icon}</span>
        <span class="nav-label">{item.label}</span>
      </a>
    {/each}
  </nav>

  
  <div class="sidebar-footer">
    <a href="/app/profile" class="profile-link" class:active={currentPath === "/app/profile"}>
      <div class="user-avatar">👤</div>
      <div class="user-details">
        <div class="user-name">{userName}</div>
        <div class="user-hint">Ver perfil</div>
      </div>
    </a>
    <button class="logout-btn" on:click={logout}>Terminar sessão</button>
  </div>
</aside>

<style>
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 210px;
    background: #0f172a;
    border-right: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    z-index: 100;
  }

  .sidebar-header {
    padding: 24px 20px;
    border-bottom: 1px solid #1e293b;
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    font-weight: 600;
    font-size: 18px;
  }

  .brand-icon {
    font-size: 24px;
    background: #2563eb;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-text {
    color: #f8fafc;
  }

  .sidebar-nav {
    flex: 1;
    padding: 12px 8px;
    overflow-y: auto;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 8px;
    text-decoration: none;
    color: #cbd5e1;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
    transition: all 0.15s;
  }

  .nav-item:hover {
    background: #1e293b;
    color: #f8fafc;
  }

  .nav-item.active {
    background: #2563eb;
    color: #ffffff;
  }

  .nav-icon {
    font-size: 18px;
    width: 20px;
    text-align: center;
  }

  .nav-label {
    flex: 1;
  }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid #1e293b;
    display: grid;
    gap: 12px;
  }

  .profile-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    text-decoration: none;
    color: #cbd5e1;
    transition: all 0.15s;
    border: 1px solid transparent;
  }

  .profile-link:hover {
    background: #1e293b;
    color: #f8fafc;
  }

  .profile-link.active {
    background: #2563eb;
    color: #ffffff;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    background: #1e293b;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }

  .user-details {
    flex: 1;
    min-width: 0;
  }

  .user-name {
    font-size: 14px;
    font-weight: 500;
    color: #f8fafc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-hint {
    font-size: 12px;
    color: #64748b;
  }

  .logout-btn {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #1e293b;
    background: transparent;
    color: #cbd5e1;
    font-weight: 600;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s;
  }
  
  .logout-btn:hover {
    background: #1e293b;
    border-color: #475569;
    color: #f8fafc;
  }


</style>
