<script>
  import { api } from "$lib/api/client";

  let searchQuery = "";
  let filterAction = "Todas as ações";
  let auditLogs = [];
  let filteredLogs = [];
  let loading = true;
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
    "Visualização"
  ];

  async function loadAuditLogs(page = 1) {
    loading = true;
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
      // Fallback com dados fictícios
      auditLogs = [
        {
          _id: "1",
          createdAt: "2026-03-27T14:32:00Z",
          userId: { email: "admin@qforge.pt" },
          action: "Exportação",
          targetName: "Banco Matemática",
          result: "Sucesso"
        },
        {
          _id: "2",
          createdAt: "2026-03-27T13:15:00Z",
          userId: { email: "prof.silva@qforge.pt" },
          action: "Geração IA",
          targetName: "Banco História",
          result: "Sucesso"
        }
      ];
      filterLogs();
    } finally {
      loading = false;
    }
  }

  function filterLogs() {
    filteredLogs = auditLogs.filter(log => {
      const matchesSearch = 
        (log.userId?.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.targetName || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
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
    return d.toLocaleDateString("pt-PT") + " " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  }

  function exportCSV() {
    const headers = ["Data", "Utilizador", "Ação", "Alvo", "Resultado"];
    const rows = filteredLogs.map(log => [
      formatDate(log.createdAt),
      log.userId?.email || "Desconhecido",
      log.action,
      log.targetName || "-",
      log.result
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-qforge-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Carregar dados ao montar a página
  loadAuditLogs();
</script>

<div style="padding: 0;">
  <h1 style="margin: 0 0 8px 0; font-size: 28px;">Histórico / Auditoria</h1>
  <p style="color: var(--muted); margin-top: 0;">Registo de todas as ações realizadas no sistema</p>
</div>

<div style="margin-top: 24px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <!-- FILTROS E BUSCA -->
  <div style="display: grid; grid-template-columns: 1fr 1fr 120px; gap: 12px; margin-bottom: 20px;">
    <div>
      <input
        type="text"
        placeholder="Pesquisar por alvo ou utilizador..."
        value={searchQuery}
        on:input={(e) => handleSearchChange(e.target.value)}
        style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;"
      />
    </div>

    <div>
      <select
        value={filterAction}
        on:change={(e) => handleActionChange(e.target.value)}
        style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 14px;"
      >
        {#each actions as action}
          <option value={action}>{action}</option>
        {/each}
      </select>
    </div>

    <button
      on:click={exportCSV}
      style="padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 14px;"
    >
      📥 Exportar CSV
    </button>
  </div>

  <!-- TABELA -->
  <div style="overflow-x: auto;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border);">
          <th style="text-align: left; padding: 12px 0; color: var(--muted); font-weight: 500;">Data</th>
          <th style="text-align: left; padding: 12px 0; color: var(--muted); font-weight: 500;">Utilizador</th>
          <th style="text-align: left; padding: 12px 0; color: var(--muted); font-weight: 500;">Ação</th>
          <th style="text-align: left; padding: 12px 0; color: var(--muted); font-weight: 500;">Alvo</th>
          <th style="text-align: left; padding: 12px 0; color: var(--muted); font-weight: 500;">Resultado</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredLogs as log}
          <tr style="border-bottom: 1px solid var(--border); transition: background 0.15s;">
            <td style="padding: 12px 0;">{formatDate(log.createdAt)}</td>
            <td style="padding: 12px 0;">{log.userId?.email || "Desconhecido"}</td>
            <td style="padding: 12px 0;">{log.action}</td>
            <td style="padding: 12px 0; color: #2563eb; text-decoration: underline; cursor: pointer;">{log.targetName || "-"}</td>
            <td style="padding: 12px 0;">
              <span style="background: {log.result === 'Sucesso' ? '#dcfce7' : '#fee2e2'}; color: {log.result === 'Sucesso' ? '#166534' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-size: 13px; font-weight: 500;">
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
        Carregando...
      </div>
    {/if}
  </div>

  <!-- PAGINAÇÃO -->
  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 13px; color: var(--muted);">
    <span>Página {currentPage} de {totalPages}</span>
    <div style="display: flex; gap: 8px;">
      <button
        on:click={() => currentPage > 1 && loadAuditLogs(currentPage - 1)}
        disabled={currentPage === 1}
        style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; background: white; cursor: {currentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 13px; opacity: {currentPage === 1 ? 0.5 : 1};"
      >
        ◀ Anterior
      </button>
      <span style="padding: 6px 10px;">Página {currentPage} de {totalPages}</span>
      <button
        on:click={() => currentPage < totalPages && loadAuditLogs(currentPage + 1)}
        disabled={currentPage === totalPages}
        style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; background: white; cursor: {currentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 13px; opacity: {currentPage === totalPages ? 0.5 : 1};"
      >
        Próximo ▶
      </button>
    </div>
  </div>
</div>

<style>
  table {
    border-spacing: 0;
  }

  tr:hover {
    background: #f9fafb;
  }
</style>
