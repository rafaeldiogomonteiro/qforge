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
      const { data } = await api.post("/auth/login", { email, password });

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

<div class="auth-wrapper">
<div
  style="
    max-width: 420px;
    width: 100%;
    background: white;
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.08);
  "
>
  <h2 style="margin: 0;">Entrar</h2>
  <p style="margin: 6px 0 18px; color: var(--muted);">
    Cria questões de forma rápida e fácil.
  </p>

  <form on:submit|preventDefault={submit} style="display: grid; gap: 12px;">
    <div>
      <label for="email" style="font-size: 14px;">Email</label>
      <input
        id="email"
        bind:value={email}
        type="email"
        required
        style="
          width: 100%;
          margin-top: 6px;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 10px;
        "
      />
    </div>

    <div>
      <label for="password" style="font-size: 14px;">Password</label>
      <input
        id="password"
        bind:value={password}
        type="password"
        required
        style="
          width: 100%;
          margin-top: 6px;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 10px;
        "
      />
    </div>

    {#if error}
      <div style="color: #b91c1c; font-size: 14px;">
        {error}
      </div>
    {/if}

    <button
      class="btn"
      disabled={loading}
      style="width: 100%; padding: 10px;"
    >
      {loading ? "A entrar..." : "Entrar"}
    </button>
  </form>

  <!-- 🔹 Criar conta -->
  <div
    style="
      margin-top: 14px;
      text-align: center;
      font-size: 14px;
      color: var(--muted);
    "
  >
    Ainda não tens conta?
    <a href="/register" style="text-decoration: underline;">
      Criar conta
    </a>
  </div>
</div>
</div>

<style>
  :global(body) {
    background:
      linear-gradient(
      rgba(0, 0, 0, 0.4),
      rgba(0, 0, 0, 0.4)
    ),
      url("https://blog.unis.edu.br/hubfs/shutterstock_318001037.jpg");
    background-size: cover;
    background-position: center;
  }

  .auth-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
  }
</style>
