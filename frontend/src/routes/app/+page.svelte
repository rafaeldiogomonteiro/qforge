<script>
  import WelcomeBanner from "$lib/components/WelcomeBanner.svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  import StatusIndicator from "$lib/components/StatusIndicator.svelte";

  let loading = true;
  let stats = {
    totalQuestions: 0,
    totalBanks: 0,
    totalLabels: 0,
    totalChapterTags: 0,
    difficultyDistribution: { 1: 0, 2: 0, 3: 0, 4: 0 },
    mostUsedQuestions: []
  };

  // Chart data
  const chartData = [
    { time: "00:00", geracoes: 12 },
    { time: "04:00", geracoes: 8 },
    { time: "08:00", geracoes: 24 },
    { time: "12:00", geracoes: 35 },
    { time: "16:00", geracoes: 28 },
    { time: "20:00", geracoes: 18 },
  ];

  const requestsPerMin = 142;
  const maxRequests = 1000;
  const requestsPercentage = (requestsPerMin / maxRequests) * 100;

  // Simulando dados de exemplo (mock)
  loading = false;
  stats = {
    totalBanks: 12,
    totalUsers: 48,
    totalTests: 326,
    successRate: 98.2
  };
</script>

<div class="dashboard">
  <WelcomeBanner />

  <!-- Stats Grid -->
  <div class="stats-grid">
    <StatCard 
      title="Bancos Ativos"
      value="12"
      icon="📦"
      trend={{ value: "+2 este mês", positive: true }}
      color="blue"
    />
    <StatCard 
      title="Utilizadores"
      value="48"
      icon="👥"
      trend={{ value: "+8% vs. mês anterior", positive: true }}
      color="green"
    />
    <StatCard 
      title="Testes Gerados"
      value="326"
      icon="📋"
      trend={{ value: "+12% vs. ontem", positive: true }}
      color="orange"
    />
    <StatCard 
      title="Taxa de Sucesso"
      value="98.2%"
      icon="📈"
      trend={{ value: "+0.5%", positive: true }}
      color="green"
    />
  </div>

  <!-- Info Cards -->
  <div class="info-grid">
    <div class="info-card">
      <div class="card-header">
        <h3>⚡ Rate Limiting & Security</h3>
      </div>
      <div class="card-body">
        <div class="metric-box">
          <div class="metric-value">{requestsPerMin}</div>
          <div class="metric-label">requests/min</div>
          <div class="metric-bar">
            <div class="metric-fill" style="width: {requestsPercentage}%"></div>
          </div>
          <div class="metric-limit">Limite: {maxRequests} req/min</div>
        </div>

        <div class="endpoints">
          <StatusIndicator status="online" label="/auth" value="Operacional" />
          <StatusIndicator status="online" label="/ai" value="Operacional" />
        </div>
      </div>
    </div>

    <div class="info-card">
      <div class="card-header">
        <h3>🌐 Health Externos</h3>
      </div>
      <div class="card-body">
        <StatusIndicator status="online" label="Groq API" value="Latência: 124ms" />
        <StatusIndicator status="warning" label="OpenRouter API" value="Latência: 856ms" />
      </div>
    </div>
  </div>

  <!-- Chart -->
  <div class="chart-card">
    <div class="card-header">
      <h3>📊 Gerações de IA nas últimas 24h</h3>
    </div>
    <div class="card-body">
      <svg class="chart" viewBox="0 0 600 300">
        <!-- Grid -->
        <line x1="40" y1="250" x2="600" y2="250" stroke="#e2e8f0" stroke-dasharray="3 3" />
        <line x1="40" y1="205" x2="600" y2="205" stroke="#e2e8f0" stroke-dasharray="3 3" />
        <line x1="40" y1="160" x2="600" y2="160" stroke="#e2e8f0" stroke-dasharray="3 3" />
        <line x1="40" y1="115" x2="600" y2="115" stroke="#e2e8f0" stroke-dasharray="3 3" />
        <line x1="40" y1="70" x2="600" y2="70" stroke="#e2e8f0" stroke-dasharray="3 3" />

        <!-- Y-axis labels -->
        <text x="25" y="255" font-size="11" fill="#64748b">0</text>
        <text x="20" y="210" font-size="11" fill="#64748b">9</text>
        <text x="20" y="165" font-size="11" fill="#64748b">18</text>
        <text x="20" y="120" font-size="11" fill="#64748b">27</text>
        <text x="20" y="75" font-size="11" fill="#64748b">36</text>

        <!-- Line -->
        <polyline
          points="60,230 140,255 220,120 300,60 380,105 460,170"
          fill="none"
          stroke="#2563eb"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- Data points -->
        <circle cx="60" cy="230" r="4" fill="#2563eb" />
        <circle cx="140" cy="255" r="4" fill="#2563eb" />
        <circle cx="220" cy="120" r="4" fill="#2563eb" />
        <circle cx="300" cy="60" r="4" fill="#2563eb" />
        <circle cx="380" cy="105" r="4" fill="#2563eb" />
        <circle cx="460" cy="170" r="4" fill="#2563eb" />

        <!-- X-axis labels -->
        <text x="50" y="280" font-size="11" fill="#64748b">00:00</text>
        <text x="130" y="280" font-size="11" fill="#64748b">04:00</text>
        <text x="210" y="280" font-size="11" fill="#64748b">08:00</text>
        <text x="290" y="280" font-size="11" fill="#64748b">12:00</text>
        <text x="370" y="280" font-size="11" fill="#64748b">16:00</text>
        <text x="450" y="280" font-size="11" fill="#64748b">20:00</text>
      </svg>
      <div class="chart-footer">
        <span>Total de gerações: 125</span>
        <span class="positive">+12% vs. ontem</span>
      </div>
    </div>
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 16px;
  }

  .info-card,
  .chart-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }

  .chart-card {
    grid-column: 1 / -1;
  }

  .card-header {
    padding: 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  .card-header h3 {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
    margin: 0;
  }

  .card-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .metric-box {
    background: #f8fafc;
    border-radius: 8px;
    padding: 16px;
  }

  .metric-value {
    font-size: 28px;
    font-weight: 600;
    color: #0f172a;
    margin-bottom: 4px;
  }

  .metric-label {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 12px;
  }

  .metric-bar {
    width: 100%;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .metric-fill {
    height: 100%;
    background: #10b981;
    border-radius: 4px;
    transition: width 0.3s;
  }

  .metric-limit {
    font-size: 11px;
    color: #64748b;
  }

  .endpoints {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chart {
    width: 100%;
    height: 300px;
    margin-bottom: 16px;
  }

  .chart-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
  }

  .chart-footer .positive {
    color: #10b981;
    font-weight: 500;
  }
</style>
