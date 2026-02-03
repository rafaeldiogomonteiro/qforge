<script>
  import "./layout.css";
  import { page } from "$app/stores";

  const AUTH_PATHS = ["/login", "/register"];
  $: isAuthPage = AUTH_PATHS.some((path) => $page.url.pathname.startsWith(path));
</script>

<div class:auth-page={isAuthPage} class="app">
  <main class="container">
    <slot />
  </main>
</div>
