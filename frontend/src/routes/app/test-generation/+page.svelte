<script>
  import { api } from "$lib/api/client";

  let banks = [];
  let selectedBank = "";
  let numQuestions = 20;
  let easyPercentage = 30;
  let mediumPercentage = 50;
  let hardPercentage = 20;
  let shuffleQuestions = true;

  let selectedLabels = [];
  let excludedLabels = [];
  let allLabels = [];

  let generating = false;
  let generatedHTML = "";
  let showPreview = false;

  let includeInput = "";
  let excludeInput = "";

  async function loadData() {
    try {
      const [banksRes, labelsRes] = await Promise.all([
        api.get("/banks"),
        api.get("/labels")
      ]);

      banks = banksRes.data?.data || [];
      allLabels = labelsRes.data || [];
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  }

  loadData();

  function getEasyCount() {
    return Math.round((easyPercentage / 100) * numQuestions);
  }

  function getMediumCount() {
    return Math.round((mediumPercentage / 100) * numQuestions);
  }

  function getHardCount() {
    return numQuestions - getEasyCount() - getMediumCount();
  }

  function addIncludedLabel(label) {
    if (includeInput.trim() && !selectedLabels.includes(includeInput.trim())) {
      selectedLabels = [...selectedLabels, includeInput.trim()];
      includeInput = "";
    }
  }

  function addExcludedLabel(label) {
    if (excludeInput.trim() && !excludedLabels.includes(excludeInput.trim())) {
      excludedLabels = [...excludedLabels, excludeInput.trim()];
      excludeInput = "";
    }
  }

  function removeIncluded(label) {
    selectedLabels = selectedLabels.filter(l => l !== label);
  }

  function removeExcluded(label) {
    excludedLabels = excludedLabels.filter(l => l !== label);
  }

  async function generateTest() {
    if (!selectedBank) {
      alert("Seleciona um banco de questões");
      return;
    }

    generating = true;

    try {
      // Busca questões do banco
      const res = await api.get(`/banks/${selectedBank}/questions`);
      let questions = res.data || [];

      // Filtra por labels incluídas/excluídas
      if (selectedLabels.length > 0) {
        questions = questions.filter(q => 
          selectedLabels.some(label => 
            (q.labels || []).some(l => 
              (typeof l === 'string' ? l : l.name).includes(label)
            )
          )
        );
      }

      if (excludedLabels.length > 0) {
        questions = questions.filter(q => 
          !excludedLabels.some(label => 
            (q.labels || []).some(l => 
              (typeof l === 'string' ? l : l.name).includes(label)
            )
          )
        );
      }

      // Agrupa por dificuldade
      const byDifficulty = {
        1: questions.filter(q => q.difficulty === 1),
        2: questions.filter(q => q.difficulty === 2),
        3: questions.filter(q => q.difficulty === 3)
      };

      // Seleciona questões proporcionalmente
      const selected = [];
      const counts = {
        1: getEasyCount(),
        2: getMediumCount(),
        3: getHardCount()
      };

      for (const [difficulty, count] of Object.entries(counts)) {
        const available = byDifficulty[difficulty] || [];
        const toSelect = Math.min(count, available.length);
        for (let i = 0; i < toSelect; i++) {
          const idx = Math.floor(Math.random() * available.length);
          selected.push(available[idx]);
          available.splice(idx, 1);
        }
      }

      if (shuffleQuestions) {
        for (let i = selected.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [selected[i], selected[j]] = [selected[j], selected[i]];
        }
      }

      // Gera HTML
      generateHTML(selected);
      showPreview = true;
    } catch (e) {
      alert("Erro ao gerar teste: " + (e.message || "Erro desconhecido"));
    } finally {
      generating = false;
    }
  }

  function generateHTML(questions) {
    const bank = banks.find(b => b._id === selectedBank);
    const bankTitle = bank?.title || "Teste";

    let html = `
<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${bankTitle} - Teste</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 850px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { margin: 0; color: #1f2937; }
        .header p { color: #6b7280; margin: 8px 0 0 0; }
        .question { page-break-inside: avoid; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb; }
        .question:last-child { border-bottom: none; }
        .question-number { font-weight: bold; color: #2563eb; }
        .stem { margin: 8px 0; }
        .option { margin-left: 32px; margin-top: 6px; }
        .instruction { background: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${bankTitle}</h1>
        <p>Data: ${new Date().toLocaleDateString('pt-PT')}</p>
        <p>Total de questões: ${questions.length}</p>
    </div>

    <div class="instruction">
        <strong>Instruções:</strong> Responde a todas as questões. O tempo máximo é 90 minutos.
    </div>
`;

    questions.forEach((q, idx) => {
      html += `
    <div class="question">
        <div class="question-number">Questão ${idx + 1}</div>
        <div class="stem"><strong>${q.stem}</strong></div>
`;

      if (q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') {
        if (q.options && Array.isArray(q.options)) {
          q.options.forEach((opt, optIdx) => {
            const letter = String.fromCharCode(65 + optIdx);
            html += `<div class="option">${letter}) ${opt.text || opt}</div>`;
          });
        }
      } else if (q.type === 'SHORT_ANSWER') {
        html += `<div class="option" style="margin-top: 24px; height: 60px; border-bottom: 2px solid #000;"></div>`;
      } else {
        html += `<div class="option" style="margin-top: 24px;">
            <textarea style="width: 100%; height: 100px; border: 1px solid #ccc; padding: 8px;"></textarea>
        </div>`;
      }

      html += `
    </div>
`;
    });

    html += `
</body>
</html>
`;

    generatedHTML = html;
  }

  function downloadPDF() {
    // Implementação simplificada - pode usar uma lib como html2pdf
    alert("Download PDF - funcionalidade a implementar com biblioteca PDF");
  }

  function downloadHTML() {
    const blob = new Blob([generatedHTML], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teste-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printTest() {
    const printWindow = window.open("", "", "height=800,width=900");
    printWindow.document.write(generatedHTML);
    printWindow.document.close();
    printWindow.print();
  }

  // Carregar dados ao montar a página
  loadData();
</script>

<div style="display: flex; flex-direction: column; gap: 24px;">
  <!-- Header -->
  <div>
    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1e293b;">Criar Teste</h1>
    <p style="margin: 6px 0 0; font-size: 14px; color: #64748b;">Configure e gere testes personalizados a partir de bancos de questões</p>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
    <!-- LEFT: Configuration Form -->
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 18px;">
      <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">⚙️ Configuração</h2>

      <div style="display: grid; gap: 16px;">
        <div>
          <label style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px;">
            Banco de Questões
          </label>
          <select
            bind:value={selectedBank}
            style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; font-size: 14px;"
          >
            <option value="">Selecionar banco...</option>
            {#each banks as bank}
              <option value={bank._id}>{bank.title}</option>
            {/each}
          </select>
        </div>

        <div>
          <label style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px;">
            Número de Questões: <strong style="color: #1e293b;">{numQuestions}</strong>
          </label>
          <input
            type="range"
            min="5"
            max="100"
            step="1"
            bind:value={numQuestions}
            style="width: 100%; accent-color: #2563eb;"
          />
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">5 a 100 questões</div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #1e293b;">Distribuição</h3>

          <div style="display: grid; gap: 12px;">
            <div>
              <label style="font-size: 12px; color: #64748b; display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Fácil</span>
                <strong style="color: #10b981;">{easyPercentage}%</strong>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                bind:value={easyPercentage}
                style="width: 100%; accent-color: #10b981;"
              />
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">{getEasyCount()} questões</div>
            </div>

            <div>
              <label style="font-size: 12px; color: #64748b; display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Médio</span>
                <strong style="color: #f59e0b;">{mediumPercentage}%</strong>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                bind:value={mediumPercentage}
                style="width: 100%; accent-color: #f59e0b;"
              />
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">{getMediumCount()} questões</div>
            </div>

            <div>
              <label style="font-size: 12px; color: #64748b; display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Difícil</span>
                <strong style="color: #ef4444;">{hardPercentage}%</strong>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                bind:value={hardPercentage}
                style="width: 100%; accent-color: #ef4444;"
              />
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">{getHardCount()} questões</div>
            </div>
          </div>
        </div>

        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
          <input type="checkbox" bind:checked={shuffleQuestions} style="width: 16px; height: 16px;" />
          <span style="color: #1e293b;">Baralhar ordem das questões</span>
        </label>

        <button
          style="padding: 12px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s;"
          on:click={generateTest}
          disabled={!selectedBank}
        >
          ✨ Gerar Teste
        </button>
      </div>
    </div>

    <!-- RIGHT: Preview/Download -->
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
      <h2 style="margin: 0 0 18px 0; font-size: 16px; font-weight: 600; color: #1e293b;">📄 Pré-visualização</h2>

      {#if generatedHTML.length === 0}
        <p style="margin: 0; color: #64748b; font-size: 14px;">Configura e clica em "Gerar Teste" para ver a pré-visualização aqui...</p>
      {:else}
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; overflow-y: auto; max-height: 500px; margin-bottom: 16px; font-size: 12px; line-height: 1.5; color: #1e293b;">
          <div style="white-space: pre-wrap; word-break: break-word; font-family: monospace;">
            {generatedHTML.substring(0, 500)}...
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button
            style="padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.15s;"
            on:click={downloadHTML}
          >
            📥 Baixar HTML
          </button>
          <button
            style="padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.15s;"
            on:click={printTest}
          >
            🖨️ Imprimir
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- PRÉ-VISUALIZAÇÃO -->
  <div style="background: white; border: 1px solid var(--border); border-radius: 14px; padding: 20px;">
    <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Pré-visualização</h2>

    {#if !showPreview}
      <div style="text-align: center; padding: 60px 20px; color: var(--muted);">
        <div style="font-size: 48px; margin-bottom: 12px;">👁️</div>
        <p>Gera um teste para ver a pré-visualização aqui</p>
      </div>
    {:else}
      <div style="max-height: 600px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; padding: 16px; background: #fafafa;">
        <iframe
          title="Preview"
          srcdoc={generatedHTML}
          style="width: 100%; border: none; height: 500px; display: block;"
        />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
        <button
          on:click={downloadHTML}
          style="padding: 10px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 13px;"
        >
          📄 Baixar HTML
        </button>
        <button
          on:click={printTest}
          style="padding: 10px; background: #8b5cf6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 13px;"
        >
          🖨️ Imprimir
        </button>
      </div>
    {/if}
  </div>
</div>
