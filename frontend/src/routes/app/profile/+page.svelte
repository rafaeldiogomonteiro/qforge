<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";
  import { currentUser } from "$lib/stores/user";

  // Estado do utilizador
  let user = {
    name: "",
    email: "",
    institution: "",
    department: ""
  };
  let loading = true;

  // Estado do formulário de perfil
  let profileLoading = false;
  let profileSuccess = "";
  let profileError = "";

  // Estado do formulário de password
  let currentPassword = "";
  let newPassword = "";
  let confirmPassword = "";
  let passwordLoading = false;
  let passwordSuccess = "";
  let passwordError = "";

  onMount(loadProfile);

  async function loadProfile() {
    loading = true;
    try {
      const { data } = await api.get("/auth/me");
      user = {
        name: data.name || "",
        email: data.email || "",
        institution: data.institution || "",
        department: data.department || ""
      };
    } catch (e) {
      profileError = e?.response?.data?.error || "Erro ao carregar perfil";
    } finally {
      loading = false;
    }
  }

  async function saveProfile() {
    profileError = "";
    profileSuccess = "";

    if (!user.name.trim()) {
      profileError = "O nome é obrigatório";
      return;
    }

    if (!user.email.trim()) {
      profileError = "O email é obrigatório";
      return;
    }

    profileLoading = true;

    try {
      const { data } = await api.put("/auth/profile", {
        name: user.name.trim(),
        email: user.email.trim(),
        institution: user.institution?.trim() || null,
        department: user.department?.trim() || null
      });

      user = {
        name: data.user.name || "",
        email: data.user.email || "",
        institution: data.user.institution || "",
        department: data.user.department || ""
      };

      // Atualizar store global
      currentUser.set(data.user);

      profileSuccess = "Perfil atualizado com sucesso";
      setTimeout(() => profileSuccess = "", 3000);
    } catch (e) {
      profileError = e?.response?.data?.error || "Erro ao atualizar perfil";
    } finally {
      profileLoading = false;
    }
  }

  async function changePassword() {
    passwordError = "";
    passwordSuccess = "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      passwordError = "Todos os campos são obrigatórios";
      return;
    }

    if (newPassword.length < 6) {
      passwordError = "A nova password deve ter pelo menos 6 caracteres";
      return;
    }

    if (newPassword !== confirmPassword) {
      passwordError = "A nova password e a confirmação não coincidem";
      return;
    }

    if (currentPassword === newPassword) {
      passwordError = "A nova password não pode ser igual à password atual";
      return;
    }

    passwordLoading = true;

    try {
      await api.put("/auth/password", {
        currentPassword,
        newPassword,
        confirmPassword
      });

      // Limpar campos
      currentPassword = "";
      newPassword = "";
      confirmPassword = "";

      passwordSuccess = "Password alterada com sucesso";
      setTimeout(() => passwordSuccess = "", 3000);
    } catch (e) {
      passwordError = e?.response?.data?.error || "Erro ao alterar password";
    } finally {
      passwordLoading = false;
    }
  }
</script>

<div style="max-width: 800px;">
  <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 600;">Perfil</h1>

  {#if loading}
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 40px; text-align: center;">
      <p style="color: var(--muted); margin: 0;">A carregar perfil...</p>
    </div>
  {:else}
    <!-- Informações Pessoais -->
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 24px; margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 600;">Informações Pessoais</h2>
      <p style="margin: 0 0 20px 0; color: var(--muted); font-size: 14px;">
        Atualiza os teus dados pessoais
      </p>

      <form on:submit|preventDefault={saveProfile} style="display: grid; gap: 16px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label for="name" style="font-size: 14px; font-weight: 500;">Nome *</label>
            <input
              id="name"
              bind:value={user.name}
              required
              placeholder="O teu nome"
              style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
            />
          </div>

          <div>
            <label for="email" style="font-size: 14px; font-weight: 500;">Email *</label>
            <input
              id="email"
              type="email"
              bind:value={user.email}
              required
              placeholder="email@exemplo.pt"
              style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
            />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label for="institution" style="font-size: 14px; font-weight: 500;">Instituição</label>
            <input
              id="institution"
              bind:value={user.institution}
              placeholder="Ex.: Universidade do Minho"
              style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
            />
          </div>

          <div>
            <label for="department" style="font-size: 14px; font-weight: 500;">Departamento</label>
            <input
              id="department"
              bind:value={user.department}
              placeholder="Ex.: Informática"
              style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
            />
          </div>
        </div>

        {#if profileError}
          <div style="padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #b91c1c; font-size: 14px;">
            {profileError}
          </div>
        {/if}

        {#if profileSuccess}
          <div style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; color: #15803d; font-size: 14px;">
            {profileSuccess}
          </div>
        {/if}

        <div>
          <button 
            class="btn" 
            type="submit" 
            disabled={profileLoading}
            style="padding: 10px 20px;"
          >
            {profileLoading ? "A guardar..." : "Guardar alterações"}
          </button>
        </div>
      </form>
    </div>

    <!-- Segurança (Password) -->
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 24px;">
      <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 600;">Segurança</h2>
      <p style="margin: 0 0 20px 0; color: var(--muted); font-size: 14px;">
        Altera a tua palavra-passe
      </p>

      <form on:submit|preventDefault={changePassword} style="display: grid; gap: 16px;">
        <div>
          <label for="currentPassword" style="font-size: 14px; font-weight: 500;">Password atual *</label>
          <input
            id="currentPassword"
            type="password"
            bind:value={currentPassword}
            required
            placeholder="••••••••"
            style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
          />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label for="newPassword" style="font-size: 14px; font-weight: 500;">Nova password *</label>
            <input
              id="newPassword"
              type="password"
              bind:value={newPassword}
              required
              placeholder="••••••••"
              style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
            />
            <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--muted);">Mínimo 6 caracteres</p>
          </div>

          <div>
            <label for="confirmPassword" style="font-size: 14px; font-weight: 500;">Confirmar nova password *</label>
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              required
              placeholder="••••••••"
              style="width: 100%; margin-top: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px;"
            />
          </div>
        </div>

        {#if passwordError}
          <div style="padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #b91c1c; font-size: 14px;">
            {passwordError}
          </div>
        {/if}

        {#if passwordSuccess}
          <div style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; color: #15803d; font-size: 14px;">
            {passwordSuccess}
          </div>
        {/if}

        <div>
          <button 
            class="btn" 
            type="submit" 
            disabled={passwordLoading}
            style="padding: 10px 20px;"
          >
            {passwordLoading ? "A alterar..." : "Alterar password"}
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>
