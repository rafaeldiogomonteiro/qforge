<script>
  import { api } from "$lib/api/client";

  let searchQuery = "";
  let filterAction = "Todas as ações";
  let auditLogs = [];
  let filteredLogs = [];
  let stats = [];
  let resultStats = [];
  let loading = true;
  let statsLoading = true;
  let error = "";
  let currentPage = 1;
  let totalPages = 1;
  let pageSize = 10;

  const actions = [
    "Todas as ações",
    "Criação",
    "Edição",
    "Eliminação",
    "Exportação",
    "Importação",
    "Geração IA",
  ];

  loadAuditStats();
  loadAuditLogs();

  async function loadAuditStats() {
    statsLoading = true;
    try {
      const { data } = await api.get("/audit-logs/stats");
      stats = data?.actionStats || [];
      resultStats = data?.successRate || [];
    } catch (e) {
      console.error("Erro ao carregar estatísticas de auditoria:", e);
      stats = [];
      resultStats = [];
    } finally {
      statsLoading = false;
    }
  }

  async function loadAuditLogs(page = 1) {
    loading = true;
    error = "";
    try {
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", pageSize);
      if (filterAction !== "Todas as ações") {
        params.set("action", filterAction);
      }

      const res = await api.get(`/audit-logs?${params.toString()}`);
      auditLogs = res.data?.data || [];
      currentPage = res.data?.pagination?.page || 1;
      totalPages = res.data?.pagination?.totalPages || 1;
      filterLogs();
    } catch (e) {
      console.error("Erro ao carregar logs de auditoria:", e);
      error = e?.response?.data?.error || "Erro ao carregar auditoria.";
      auditLogs = [];
      filteredLogs = [];
    } finally {
      loading = false;
    }
  }

  function filterLogs() {
    const query = searchQuery.trim().toLowerCase();
    filteredLogs = auditLogs.filter((log) => {
      if (!query) return true;
      return [
        log.action,
        log.targetType,
        log.targetName,
        log.result,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }

  function handleSearchChange(value) {
    searchQuery = value;
    filterLogs();
  }

  function handleActionChange(action) {
    filterAction = action;
    currentPage = 1;
    loadAuditLogs(1);
  }

  function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    return (
      d.toLocaleDateString("pt-PT") +
      " " +
      d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    );
  }

  function countFor(action) {
    return stats.find((item) => item._id === action)?.count || 0;
  }

  function totalActions() {
    return stats.reduce((sum, item) => sum + (item.count || 0), 0);
  }

  function successfulActions() {
    return resultStats.find((item) => item._id === "Sucesso")?.count || 0;
  }

  function exportCSV() {
    const headers = ["Data", "Ação", "Tipo", "Alvo", "Resultado"];
    const rows = filteredLogs.map((log) => [
      formatDate(log.createdAt),
      log.action,
      log.targetType || "-",
      log.targetName || "-",
      log.result,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-qforge-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div style="padding: 0;">
  <h1 style="margin: 0 0 8px 0; font-size: 28px;">Histórico / Auditoria</h1>
  <p style="color: var(--muted); margin-top: 0;">Registo das tuas ações na aplicação</p>
</div>

<div style="margin-top: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
  <div class="stat-box">
    <div class="stat-value">{statsLoading ? "..." : totalActions()}</div>
    <div class="stat-label">Ações registadas</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">{statsLoading ? "..." : successfulActions()}</div>
    <div class="stat-label">Sucessos</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">{statsLoading ? "..." : countFor("Geração IA")}</div>
    <div class="stat-label">Gerações IA</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">{statsLoading ? "..." : countFor("Importação") + countFor("Exportação")}</div>
    <div class="stat-label">Importações / Exportações</div>
  </div>
</div>

<div style="margin-top: 24px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <div style="display: grid; grid-template-columns: 1fr 220px 120px; gap: 12px; margin-bottom: 20px;">
    <input
      type="text"
      placeholder="Pesquisar por ação ou alvo..."
      value={searchQuery}
      on:input={(e) => handleSearchChange(e.target.value)}
      style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;"
    />

    <select
      value={filterAction}
      on:change={(e) => handleActionChange(e.target.value)}
      style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 14px;"
    >
      {#each actions as action}
        <option value={action}>{action}</option>
      {/each}
    </select>

    <button
      on:click={exportCSV}
      disabled={filteredLogs.length === 0}
      style="padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 14px; opacity: {filteredLogs.length === 0 ? 0.6 : 1};"
    >
      CSV
    </button>
  </div>

  {#if error}
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c; margin-bottom: 12px;">
      {error}
    </div>
  {/if}

  <div style="overflow-x: auto;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border);">
          <th>Data</th>
          <th>Ação</th>
          <th>Tipo</th>
          <th>Alvo</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredLogs as log}
          <tr style="border-bottom: 1px solid var(--border);">
            <td>{formatDate(log.createdAt)}</td>
            <td>{log.action}</td>
            <td>{log.targetType || "-"}</td>
            <td>{log.targetName || "-"}</td>
            <td>
              <span class={log.result === "Sucesso" ? "status-ok" : "status-error"}>
                {log.result}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if filteredLogs.length === 0 && !loading}
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        Nenhum registo encontrado
      </div>
    {/if}

    {#if loading}
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        A carregar...
      </div>
    {/if}
  </div>

  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 13px; color: var(--muted);">
    <span>Página {currentPage} de {totalPages}</span>
    <div style="display: flex; gap: 8px;">
      <button class="pager" on:click={() => currentPage > 1 && loadAuditLogs(currentPage - 1)} disabled={currentPage === 1}>
        Anterior
      </button>
      <button class="pager" on:click={() => currentPage < totalPages && loadAuditLogs(currentPage + 1)} disabled={currentPage === totalPages}>
        Próximo
      </button>
    </div>
  </div>
</div>

<style>
  .stat-box {
    background: white;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #1e293b;
  }

  .stat-label {
    margin-top: 4px;
    color: var(--muted);
    font-size: 13px;
  }

  th,
  td {
    text-align: left;
    padding: 12px 0;
  }

  th {
    color: var(--muted);
    font-weight: 500;
  }

  .status-ok,
  .status-error {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
  }

  .status-ok {
    background: #dcfce7;
    color: #166534;
  }

  .status-error {
    background: #fee2e2;
    color: #991b1b;
  }

  .pager {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;
  }

  .pager:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
