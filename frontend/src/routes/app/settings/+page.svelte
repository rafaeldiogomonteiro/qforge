<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  let loading = true;
  let saving = false;
  let error = "";
  let success = "";

  let apiKey = "";
  let hasExistingConfig = false;
  let models = [];

  const AVAILABLE_MODELS = [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Versatile)" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Instant)" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
    { id: "gemma2-9b-it", name: "Gemma2 9B" }
  ];

  onMount(async () => {
    loading = true;
    error = "";

    try {
      // Check if there's an existing Groq config
      const { data } = await api.get("/ai/config");
      
      if (data && data.provider === "groq") {
        hasExistingConfig = true;
        // API key won't be sent back for security, so we show placeholder
        apiKey = ""; // User needs to enter new key to update
      }

      // Load available models
      try {
        const modelsRes = await api.get("/ai/models");
        models = modelsRes.data || [];
      } catch (e) {
        console.error("Erro ao carregar modelos:", e);
      }
    } catch (e) {
      // No config yet
      hasExistingConfig = false;
    } finally {
      loading = false;
    }
  });

  async function saveConfig() {
    error = "";
    success = "";

    if (!apiKey.trim()) {
      error = "Por favor, insere a API key do Groq.";
      return;
    }

    saving = true;

    try {
      await api.post("/ai/config", {
        provider: "groq",
        apiKey: apiKey.trim()
      });

      success = "Configuração guardada com sucesso!";
      hasExistingConfig = true;
      apiKey = ""; // Clear for security

      // Reload models
      try {
        const modelsRes = await api.get("/ai/models");
        models = modelsRes.data || [];
      } catch (e) {
        console.error("Erro ao carregar modelos:", e);
      }
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao guardar configuração.";
    } finally {
      saving = false;
    }
  }
</script>

<div style="max-width: 800px; margin: 0 auto;">
  <!-- Header -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
    <h2 style="margin: 0;">Configuração da IA - Groq</h2>
    <p style="margin: 6px 0 0; color: var(--muted); font-size: 14px;">
      Configura a API key do Groq para gerar questões automaticamente com IA.
    </p>
  </div>

  {#if loading}
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
      <p style="color: var(--muted); margin: 0;">A carregar...</p>
    </div>
  {:else}
    <!-- Config Form -->
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 16px 0;">API Key do Groq</h3>

      {#if hasExistingConfig}
        <div style="background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; margin-bottom: 16px; color: #166534; font-size: 14px;">
          ✓ Já existe uma configuração guardada. Insere uma nova API key para atualizar.
        </div>
      {/if}

      <form on:submit|preventDefault={saveConfig}>
        <div style="margin-bottom: 16px;">
          <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
            API Key
          </label>
          <input
            bind:value={apiKey}
            type="password"
            placeholder="gsk_..."
            disabled={saving}
            style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 10px; font-family: ui-monospace, monospace;"
          />
          <p style="margin: 6px 0 0; color: var(--muted); font-size: 12px;">
            Obtém a tua API key em <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">console.groq.com/keys</a>
          </p>
        </div>

        {#if error}
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px; color: #b91c1c; font-size: 14px;">
            {error}
          </div>
        {/if}

        {#if success}
          <div style="background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 16px; color: #166534; font-size: 14px;">
            {success}
          </div>
        {/if}

        <button type="submit" class="btn" disabled={saving}>
          {saving ? "A guardar..." : "Guardar Configuração"}
        </button>
      </form>
    </div>

    <!-- Available Models -->
    {#if models.length > 0}
      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0;">Modelos Disponíveis</h3>

        <div style="display: grid; gap: 12px;">
          {#each models as model}
            <div style="border: 1px solid var(--border); border-radius: 10px; padding: 12px;">
              <div style="font-weight: 500;">{model.name || model.id}</div>
              <div style="font-size: 13px; color: var(--muted); font-family: ui-monospace, monospace; margin-top: 4px;">
                {model.id}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if hasExistingConfig}
      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0;">Modelos Disponíveis</h3>
        <p style="color: var(--muted); margin: 0; font-size: 14px;">
          A carregar modelos da Groq API...
        </p>

        <div style="margin-top: 16px; display: grid; gap: 8px;">
          {#each AVAILABLE_MODELS as model}
            <div style="border: 1px solid var(--border); border-radius: 10px; padding: 12px; opacity: 0.7;">
              <div style="font-weight: 500;">{model.name}</div>
              <div style="font-size: 13px; color: var(--muted); font-family: ui-monospace, monospace; margin-top: 4px;">
                {model.id}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .btn {
    padding: 10px 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;
  }

  .btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
