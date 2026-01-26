<script>
  import { api } from "$lib/api/client";
  import { onMount } from "svelte";

  let loading = true;
  let stats = {
    totalQuestions: 0,
    totalBanks: 0,
    pendingGenerations: 0,
    totalLabels: 0,
    totalChapterTags: 0,
    difficultyDistribution: { 1: 0, 2: 0, 3: 0, 4: 0 },
    mostUsedQuestions: []
  };

  const DIFFICULTY_LABELS = {
    1: "Básico",
    2: "Normal",
    3: "Difícil",
    4: "Muito Difícil"
  };

  const DIFFICULTY_COLORS = {
    1: "#ecfeff",
    2: "#f0fdf4",
    3: "#fffbeb",
    4: "#fef2f2"
  };

  onMount(loadStats);

  async function loadStats() {
    loading = true;
    
    try {
      const [banksRes, labelsRes, tagsRes, generationsRes] = await Promise.all([
        api.get("/banks"),
        api.get("/labels"),
        api.get("/chapter-tags"),
        api.get("/ai/generations").catch(() => ({ data: [] }))
      ]);

      const banks = banksRes.data?.data || [];
      const labels = labelsRes.data || [];
      const tags = tagsRes.data || [];
      const generations = Array.isArray(generationsRes.data) ? generationsRes.data : [];

      stats.totalBanks = banks.length;
      stats.totalLabels = labels.length;
      stats.totalChapterTags = tags.length;
      stats.pendingGenerations = generations.filter(g => g.status === "PENDING").length;

      // Load all questions from all banks
      let allQuestions = [];
      for (const bank of banks) {
        try {
          const qRes = await api.get(`/banks/${bank._id}/questions`);
          allQuestions = [...allQuestions, ...(qRes.data || [])];
        } catch (e) {
          console.error("Error loading questions for bank", bank._id);
        }
      }

      stats.totalQuestions = allQuestions.length;

      // Difficulty distribution
      const diffDist = { 1: 0, 2: 0, 3: 0, 4: 0 };
      allQuestions.forEach(q => {
        if (q.difficulty >= 1 && q.difficulty <= 4) {
          diffDist[q.difficulty]++;
        }
      });
      stats.difficultyDistribution = diffDist;

      // Most used questions (top 5)
      stats.mostUsedQuestions = allQuestions
        .filter(q => q.usageCount > 0)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5);

    } catch (e) {
      console.error("Error loading stats:", e);
    } finally {
      loading = false;
    }
  }
</script>

<div style="max-width: 1400px;">
  <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 600;">Dashboard</h1>

  {#if loading}
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 40px; text-align: center;">
      <p style="color: var(--muted); margin: 0;">A carregar estatísticas...</p>
    </div>
  {:else}
    <!-- Stats Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px;">Total de Questões</div>
        <div style="font-size: 32px; font-weight: 600; color: #1d4ed8;">{stats.totalQuestions}</div>
      </div>

      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px;">Bancos</div>
        <div style="font-size: 32px; font-weight: 600; color: #059669;">{stats.totalBanks}</div>
      </div>

      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px;">Gerações Pendentes</div>
        <div style="font-size: 32px; font-weight: 600; color: #dc2626;">{stats.pendingGenerations}</div>
      </div>

      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px;">Labels</div>
        <div style="font-size: 32px; font-weight: 600; color: #7c3aed;">{stats.totalLabels}</div>
      </div>

      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 8px;">Chapter Tags</div>
        <div style="font-size: 32px; font-weight: 600; color: #ea580c;">{stats.totalChapterTags}</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
      <!-- Difficulty Distribution -->
      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Distribuição por Dificuldade</h3>
        
        <div style="display: grid; gap: 12px;">
          {#each Object.entries(stats.difficultyDistribution) as [level, count]}
            {@const total = Object.values(stats.difficultyDistribution).reduce((a, b) => a + b, 0)}
            {@const percentage = total > 0 ? Math.round((count / total) * 100) : 0}
            
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: 14px; font-weight: 500;">{level} - {DIFFICULTY_LABELS[level]}</span>
                <span style="font-size: 14px; color: var(--muted);">{count} ({percentage}%)</span>
              </div>
              <div style="width: 100%; height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
                <div style="width: {percentage}%; height: 100%; background: {DIFFICULTY_COLORS[level]}; border: 1px solid #d1d5db; border-radius: 4px;"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Most Used Questions -->
      <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Questões Mais Usadas</h3>
        
        {#if stats.mostUsedQuestions.length === 0}
          <p style="color: var(--muted); margin: 0; font-size: 14px;">Nenhuma questão foi usada ainda.</p>
        {:else}
          <div style="display: grid; gap: 12px;">
            {#each stats.mostUsedQuestions as q}
              <div style="border: 1px solid var(--border); border-radius: 10px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 6px;">
                  <div style="font-size: 14px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {q.stem?.substring(0, 60)}{q.stem?.length > 60 ? '...' : ''}
                  </div>
                  <span style="display:inline-flex; padding:4px 8px; border-radius:999px; font-size:12px; background:#fef3c7; border:1px solid #fde047; font-weight: 600; white-space: nowrap;">
                    {q.usageCount}x
                  </span>
                </div>
                <div style="font-size: 12px; color: var(--muted);">
                  {q.type} • Dificuldade {q.difficulty}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Acções Rápidas</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
        <a href="/app/banks" class="action-btn">
          <span style="font-size: 24px;">🗂️</span>
          <div>
            <div style="font-weight: 500;">Ver Bancos</div>
            <div style="font-size: 12px; color: var(--muted);">Gerir bancos de questões</div>
          </div>
        </a>

        <a href="/app/generate" class="action-btn">
          <span style="font-size: 24px;">🤖</span>
          <div>
            <div style="font-weight: 500;">Gerar com IA</div>
            <div style="font-size: 12px; color: var(--muted);">Criar questões automaticamente</div>
          </div>
        </a>

        {#if stats.pendingGenerations > 0}
          <a href="/app/generations" class="action-btn" style="background: #fef3c7; border-color: #fde047;">
            <span style="font-size: 24px;">📝</span>
            <div>
              <div style="font-weight: 500;">Rever Gerações</div>
              <div style="font-size: 12px; color: var(--muted);">{stats.pendingGenerations} pendentes</div>
            </div>
          </a>
        {/if}

        <a href="/app/settings" class="action-btn">
          <span style="font-size: 24px;">⚙️</span>
          <div>
            <div style="font-weight: 500;">Configurações</div>
            <div style="font-size: 12px; color: var(--muted);">API e preferências</div>
          </div>
        </a>
      </div>
    </div>
  {/if}
</div>

<style>
  .action-btn {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
    text-decoration: none;
    color: inherit;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
</style>
