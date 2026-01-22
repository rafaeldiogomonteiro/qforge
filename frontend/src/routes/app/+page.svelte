<script>
  import { api } from "$lib/api/client";

  let health = null;
  let error = "";

  async function ping() {
    error = "";
    try {
      const { data } = await api.get("/health");
      health = data;
    } catch (e) {
      error = e?.response?.data?.message || "Erro a contactar o backend.";
    }
  }
</script>

<div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <h2 style="margin: 0 0 6px 0;">Dashboard</h2>
  <p style="margin: 0; color: var(--muted);">
    Área autenticada. Aqui entra: bancos, questões, geração IA e exportação.
  </p>

  <div style="margin-top: 16px; display: flex; gap: 10px;">
    <a class="btn" href="/app/banks">Bancos</a>
    <button class="btn" on:click={ping}>Testar /health</button>
  </div>

  {#if error}
    <p style="margin-top: 12px; color: #b91c1c;">{error}</p>
  {/if}

  {#if health}
    <pre style="margin-top: 12px; background: #f3f4f6; padding: 12px; border-radius: 12px; overflow:auto;">
{JSON.stringify(health, null, 2)}
    </pre>
  {/if}
</div>
