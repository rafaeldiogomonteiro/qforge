<script>
  import { api } from "$lib/api/client";
  import { goto } from "$app/navigation";

  let title = "";
  let description = "";
  let loading = false;
  let error = "";

  async function submit() {
    loading = true;
    error = "";

    try {
      const { data } = await api.post("/banks", { title, description });
      // dependendo do backend, pode devolver {data: bank} ou o bank direto:
      const created = data?.data ?? data;
      await goto(`/app/banks/${created._id}`);
    } catch (e) {
      error = e?.response?.data?.message || "Erro ao criar banco.";
    } finally {
      loading = false;
    }
  }
</script>

<div style="max-width: 700px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <h2 style="margin: 0;">Novo Banco</h2>
  <p style="margin: 6px 0 18px; color: var(--muted);">
    Cria um novo banco para organizar questões por UC/tema.
  </p>

  <form on:submit|preventDefault={submit} style="display:grid; gap: 12px;">
    <div>
      <label for="title" style="font-size: 14px;">Título</label>
      <input
        id="title"
        bind:value={title}
        required
        placeholder="ex.: Investigação Operacional — Exame 2026"
        style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
      />
    </div>

    <div>
      <label for="description" style="font-size: 14px;">Descrição (opcional)</label>
      <textarea
        id="description"
        bind:value={description}
        rows="3"
        placeholder="Pequena descrição do banco..."
        style="width:100%; margin-top:6px; padding:10px; border:1px solid var(--border); border-radius:10px;"
      ></textarea>
    </div>

    {#if error}
      <div style="color:#b91c1c; font-size:14px;">{error}</div>
    {/if}

    <div style="display:flex; gap: 10px;">
      <button class="btn" type="submit" disabled={loading} style="padding:10px 14px;">
        {loading ? "A criar..." : "Criar"}
      </button>
      <a class="btn" href="/app/banks" style="padding:10px 14px; text-decoration:none; display:inline-flex; align-items:center;">
        Cancelar
      </a>
    </div>
  </form>
</div>
