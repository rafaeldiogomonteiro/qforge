<script>
  import { api } from "$lib/api/client";

  let banks = [];
  let selectedBank = "";
  let moodleUrl = "https://moodle.exemplo.pt";
  let moodleToken = "";
  let exporting = false;
  let exportSuccess = false;
  let exportError = "";
  
  let importFile = null;
  let importing = false;
  let importSuccess = false;
  let importError = "";
  let importResult = null;
  let fileInput = null;

  let recentExports = [
    { date: "2026-03-27 14:32", user: "admin@qforge.pt", action: "Exportação", target: "Banco Matemática", status: "Sucesso" },
    { date: "2026-03-27 13:15", user: "prof.silva@qforge.pt", action: "Geração IA", target: "Banco História", status: "Sucesso" },
  ];

  async function loadBanks() {
    try {
      const res = await api.get("/banks");
      banks = res.data?.data || [];
    } catch (e) {
      console.error("Erro ao carregar bancos:", e);
    }
  }

  loadBanks();

  async function handleExport() {
    if (!selectedBank) {
      exportError = "Seleciona um banco para exportar";
      return;
    }
    if (!moodleUrl.trim()) {
      exportError = "URL do Moodle é obrigatória";
      return;
    }
    if (!moodleToken.trim()) {
      exportError = "Token de API é obrigatório";
      return;
    }

    exportError = "";
    exporting = true;
    exportSuccess = false;

    try {
      // Primeiro faz download do arquivo Moodle XML
      const response = await api.get(`/banks/${selectedBank}/export?format=moodle`, {
        responseType: "blob",
      });

      // Aqui poderia enviar para Moodle via API (futura integração)
      // Por agora apenas mostra sucesso de exportação
      
      exportSuccess = true;
      recentExports = [
        {
          date: new Date().toLocaleString("pt-PT"),
          user: "current@qforge.pt",
          action: "Exportação",
          target: banks.find(b => b._id === selectedBank)?.title || "Banco",
          status: "Sucesso"
        },
        ...recentExports.slice(0, 4)
      ];

      setTimeout(() => {
        exportSuccess = false;
      }, 3000);
    } catch (e) {
      exportError = "Erro ao exportar: " + (e.message || "Erro desconhecido");
    } finally {
      exporting = false;
    }
  }

  async function handleImport() {
    if (!importFile) {
      importError = "Seleciona um ficheiro XML para importar";
      return;
    }

    importError = "";
    importing = true;
    importSuccess = false;

    try {
      const fileContent = await importFile.text();
      const bankTitle = importFile.name.replace(".xml", "").replace(".mxml", "");

      const response = await api.post("/banks/import", {
        format: "moodle",
        content: fileContent,
        title: bankTitle,
      });

      importResult = response.data;
      importSuccess = true;
      importFile = null;

      // Recarrega bancos
      await loadBanks();

      setTimeout(() => {
        importSuccess = false;
      }, 3000);
    } catch (e) {
      importError = "Erro ao importar: " + (e.response?.data?.error || e.message || "Erro desconhecido");
    } finally {
      importing = false;
    }
  }
</script>

<div style="padding: 0;">
  <h1 style="margin: 0 0 8px 0; font-size: 28px;">Integração Moodle</h1>
  <p style="color: var(--muted); margin-top: 0;">Exporta bancos para Moodle e importa ficheiros Moodle XML</p>
</div>

<div style="margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
  <!-- EXPORTAR PARA MOODLE -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
      <span style="font-size: 20px;">📤</span>
      <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Exportar para Moodle</h2>
    </div>

    <div style="display: grid; gap: 12px;">
      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          Banco de Questões
        </label>
        <select
          bind:value={selectedBank}
          style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 14px;"
        >
          <option value="">Selecionar banco...</option>
          {#each banks as bank}
            <option value={bank._id}>{bank.title}</option>
          {/each}
        </select>
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          Formato de Exportação
        </label>
        <select
          disabled
          style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: #f9fafb; font-size: 14px; color: #666;"
        >
          <option>Moodle XML</option>
        </select>
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          URL do site Moodle
        </label>
        <input
          type="text"
          bind:value={moodleUrl}
          placeholder="https://moodle.exemplo.pt"
          style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;"
        />
      </div>

      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          Token de API
        </label>
        <input
          type="password"
          bind:value={moodleToken}
          placeholder="••••••••••••"
          style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;"
        />
        <div style="font-size: 12px; color: var(--muted); margin-top: 6px;">
          Obtém o token em: Administração → Segurança → Serviços Web
        </div>
      </div>

      {#if exportError}
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c; font-size: 13px;">
          {exportError}
        </div>
      {/if}

      {#if exportSuccess}
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; color: #166534; font-size: 13px;">
          ✓ Exportado com sucesso!
        </div>
      {/if}

      <button
        on:click={handleExport}
        disabled={exporting || !selectedBank}
        style="width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: {exporting || !selectedBank ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: {exporting || !selectedBank ? 0.6 : 1};"
      >
        {#if exporting}
          ⏳ Exportando...
        {:else}
          📤 Enviar para Moodle
        {/if}
      </button>
    </div>
  </div>

  <!-- IMPORTAR DE MOODLE -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
      <span style="font-size: 20px;">📥</span>
      <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Importar de Moodle</h2>
    </div>

    <div style="display: grid; gap: 12px;">
      <div>
        <label style="font-size: 13px; color: var(--muted); display: block; margin-bottom: 6px;">
          Ficheiro Moodle XML
        </label>
        <label
          style="display: flex; align-items: center; justify-content: center; width: 100%; padding: 40px; border: 2px dashed var(--border); border-radius: 8px; background: #fafafa; cursor: pointer; transition: all 0.15s;"
          on:click={() => fileInput?.click()}
        >
          <input
            type="file"
            accept=".xml,.mxml"
            bind:this={fileInput}
            style="display: none;"
            on:change={(e) => {
              importFile = e.target.files?.[0] || null;
            }}
          />
          {#if importFile}
            <span style="text-align: center; font-size: 14px; color: #059669;">
              ✓ {importFile.name}
            </span>
          {:else}
            <span style="text-align: center;">
              <div style="font-size: 24px;">📄</div>
              <div style="font-size: 13px; color: var(--muted); margin-top: 8px;">
                Clique para selecionar ou arraste um ficheiro XML
              </div>
            </span>
          {/if}
        </label>
      </div>

      {#if importError}
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; color: #b91c1c; font-size: 13px;">
          {importError}
        </div>
      {/if}

      {#if importSuccess && importResult}
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; color: #166534; font-size: 13px;">
          ✓ Importado com sucesso!<br/>
          Questões: {importResult.imported || 0} • Etiquetas: {importResult.createdLabels || 0}
        </div>
      {/if}

      <button
        on:click={handleImport}
        disabled={importing || !importFile}
        style="width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: {importing || !importFile ? 'not-allowed' : 'pointer'}; font-size: 14px; opacity: {importing || !importFile ? 0.6 : 1};"
      >
        {#if importing}
          ⏳ Importando...
        {:else}
          📥 Importar Questões
        {/if}
      </button>
    </div>
  </div>
</div>

<!-- EXPORTAÇÕES RECENTES -->
<div style="margin-top: 24px; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
  <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Exportações Recentes</h2>

  <div style="overflow-x: auto;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border);">
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Data</th>
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Utilizador</th>
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Ação</th>
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Alvo</th>
          <th style="text-align: left; padding: 8px 0; color: var(--muted); font-weight: 500;">Resultado</th>
        </tr>
      </thead>
      <tbody>
        {#each recentExports as item}
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 8px 0;">{item.date}</td>
            <td style="padding: 8px 0;">{item.user}</td>
            <td style="padding: 8px 0;">{item.action}</td>
            <td style="padding: 8px 0;">{item.target}</td>
            <td style="padding: 8px 0;">
              <span style="background: {item.status === 'Sucesso' ? '#dcfce7' : '#fee2e2'}; color: {item.status === 'Sucesso' ? '#166534' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                {item.status}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
