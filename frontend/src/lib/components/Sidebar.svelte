<script>
  import { page } from "$app/stores";
  import { logout } from "$lib/stores/auth";
  import { currentUser } from "$lib/stores/user";
  
  const menuItems = [
    { href: "/app", label: "Dashboard", icon: "📊" },
    { href: "/app/banks", label: "Bancos de Questões", icon: "🗂️" },
    { href: "/app/generate", label: "Gerar com IA", icon: "🤖" },
    { href: "/app/labels", label: "Labels", icon: "🏷️" },
    { href: "/app/chapter-tags", label: "Chapter Tags", icon: "📚" }
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
    width: 260px;
    background: white;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    z-index: 100;
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
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
  }

  .brand-text {
    color: #111827;
  }

  .sidebar-nav {
    flex: 1;
    padding: 16px 12px;
    overflow-y: auto;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    text-decoration: none;
    color: #6b7280;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
    transition: all 0.15s;
  }

  .nav-item:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .nav-item.active {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  .nav-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }

  .nav-label {
    flex: 1;
  }

  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid #e5e7eb;
    display: grid;
    gap: 12px;
  }

  .profile-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: all 0.15s;
    border: 1px solid transparent;
  }

  .profile-link:hover {
    background: #f3f4f6;
  }

  .profile-link.active {
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    background: #f3f4f6;
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
    color: #111827;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-hint {
    font-size: 12px;
    color: #6b7280;
  }

  .logout-btn {
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #fff7ed;
    color: #c2410c;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .logout-btn:hover {
    background: #ffedd5;
    border-color: #fdba74;
  }


</style>
