<script>
  import { api } from "$lib/api/client";
  import WelcomeBanner from "$lib/components/WelcomeBanner.svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  import { onMount } from "svelte";

  let stats = {
    banksActive: 0,
    questionsCount: 0,
    aiQuestionsCount: 0,
    auditCount: 0,
  };
  let loading = true;
  let error = "";

  onMount(loadDashboard);

  async function loadDashboard() {
    loading = true;
    error = "";
    try {
      const { data } = await api.get("/dashboard");
      stats = {
        banksActive: data?.banksActive || 0,
        questionsCount: data?.questionsCount || 0,
        aiQuestionsCount: data?.aiQuestionsCount || 0,
        auditCount: data?.auditCount || 0,
      };
    } catch (e) {
      error = e?.response?.data?.error || "Erro ao carregar dashboard.";
    } finally {
      loading = false;
    }
  }
</script>

<div style="display: flex; flex-direction: column; gap: 24px;">
  <WelcomeBanner />

  {#if error}
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; color: #991b1b;">
      {error}
    </div>
  {/if}

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
    <StatCard title="Bancos Ativos" value={loading ? "..." : stats.banksActive} icon="📁" color="blue" />
    <StatCard title="Questões" value={loading ? "..." : stats.questionsCount} icon="✓" color="green" />
    <StatCard title="Questões IA" value={loading ? "..." : stats.aiQuestionsCount} icon="✦" color="orange" />
    <StatCard title="Registos de Auditoria" value={loading ? "..." : stats.auditCount} icon="☰" color="blue" />
  </div>

  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;">
    <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1e293b;">Resumo</h2>
    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
      Estes indicadores são calculados a partir dos teus bancos, questões e ações registadas.
    </p>
  </div>
</div>
