<script>
  import { api } from "$lib/api/client";
  import { authToken } from "$lib/stores/auth";
  import { currentUser } from "$lib/stores/user";
  import { goto } from "$app/navigation";

  let email = "";
  let password = "";
  let loading = false;
  let error = "";

  async function submit() {
    loading = true;
    error = "";
    try {
      // AJUSTAR se o endpoint for diferente
      const { data } = await api.post("/auth/login", { email, password });

      // AJUSTAR se o token vier noutro campo
      authToken.set(data.token);
      if (data.user) currentUser.set(data.user);

      await goto("/app");
    } catch (e) {
      error = e?.response?.data?.message || "Falha no login.";
    } finally {
      loading = false;
    }
  }
</script>

<div style="max-width: 420px; margin: 40px auto; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <h2 style="margin: 0;">Entrar</h2>
  <p style="margin: 6px 0 18px; color: var(--muted);">Autenticação via JWT.</p>

  <form on:submit|preventDefault={submit} style="display: grid; gap: 12px;">
    <div>
      <label for="email" style="font-size: 14px;">Email</label>
      <input id="email" bind:value={email} type="email" required
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;" />
    </div>

    <div>
      <label for="password" style="font-size: 14px;">Password</label>
      <input id="password" bind:value={password} type="password" required
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;" />
    </div>

    {#if error}
      <div style="color: #b91c1c; font-size: 14px;">{error}</div>
    {/if}

    <button class="btn" disabled={loading} style="width: 100%; padding: 10px;">
      {loading ? "A entrar..." : "Entrar"}
    </button>
  </form>
</div>
