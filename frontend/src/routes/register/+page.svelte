<script>
  import { api } from "$lib/api/client";
  import { authToken } from "$lib/stores/auth";
  import { currentUser } from "$lib/stores/user";
  import { goto } from "$app/navigation";

  let name = "";
  let email = "";
  let password = "";
  let confirmPassword = "";

  // role opcional: se não enviares, backend mete DOCENTE
  let role = "DOCENTE";
  let includeRole = false;

  let loading = false;
  let error = "";

  function validate() {
    if (!name.trim()) return "O nome é obrigatório.";
    if (!email.trim()) return "O email é obrigatório.";
    if (password.length < 6) return "A password deve ter pelo menos 6 caracteres.";
    if (password !== confirmPassword) return "As passwords não coincidem.";
    return null;
  }

  async function submit() {
    error = "";

    const v = validate();
    if (v) {
      error = v;
      return;
    }

    loading = true;

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password
      };

      // só envia role se o utilizador quiser escolher (senão fica default do backend)
      if (includeRole) payload.role = role;

      const { data } = await api.post("/auth/register", payload);

      // resposta: { message, token, user { id, name, email, role } }
      authToken.set(data.token);
      if (data.user) currentUser.set(data.user);

      await goto("/app");
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao criar conta.";
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
  <h2 style="margin: 0;">Criar conta</h2>
  <p style="margin: 6px 0 18px; color: var(--muted);">
    Cria a tua conta para acederes à plataforma.
  </p>

  <form on:submit|preventDefault={submit} style="display: grid; gap: 12px;">
    <div>
      <label for="name" style="font-size: 14px;">Nome</label>
      <input
        id="name"
        bind:value={name}
        required
        placeholder="Ex.: João Silva"
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
      />
    </div>

    <div>
      <label for="email" style="font-size: 14px;">Email</label>
      <input
        id="email"
        bind:value={email}
        type="email"
        required
        placeholder="email@exemplo.pt"
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
      />
    </div>

    <div>
      <label for="password" style="font-size: 14px;">Password</label>
      <input
        id="password"
        bind:value={password}
        type="password"
        required
        placeholder="••••••••"
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
      />
    </div>

    <div>
      <label for="confirmPassword" style="font-size: 14px;">Confirmar password</label>
      <input
        id="confirmPassword"
        bind:value={confirmPassword}
        type="password"
        required
        placeholder="••••••••"
        style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
      />
    </div>

    <!-- Role opcional -->
    <div style="border: 1px solid var(--border); border-radius: 12px; padding: 12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap: 10px;">
        <div>
          <div style="font-weight: 600;">Role (opcional)</div>
          <div style="margin-top: 4px; color: var(--muted); font-size: 13px;">
            Se não escolheres, o backend assume <b>DOCENTE</b>.
          </div>
        </div>

        <label style="display:flex; align-items:center; gap: 8px; font-size: 14px;">
          <input type="checkbox" bind:checked={includeRole} />
          Escolher role
        </label>
      </div>

      {#if includeRole}
        <select
          bind:value={role}
          style="width: 100%; margin-top: 10px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
        >
          <option value="DOCENTE">DOCENTE</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      {/if}
    </div>

    {#if error}
      <div style="color: #b91c1c; font-size: 14px;">{error}</div>
    {/if}

    <button class="btn" type="submit" disabled={loading} style="width: 100%; padding: 10px;">
      {loading ? "A criar conta..." : "Criar conta"}
    </button>

    <div style="text-align:center; font-size:14px; color: var(--muted); margin-top: 6px;">
      Já tens conta?
      <a href="/login" style="text-decoration: underline;">Entrar</a>
    </div>
  </form>
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
