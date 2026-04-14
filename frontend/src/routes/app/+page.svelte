<script>
  import WelcomeBanner from "$lib/components/WelcomeBanner.svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  import StatusIndicator from "$lib/components/StatusIndicator.svelte";

  const requestsPerMin = 142;
  const maxRequests = 1000;
  const requestsPercentage = (requestsPerMin / maxRequests) * 100;
</script>

<div style="display: flex; flex-direction: column; gap: 24px;">
  <WelcomeBanner />

  <!-- Stats Grid: 4 columns -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
    <StatCard 
      title="Bancos Ativos"
      value="12"
      icon="🗂️"
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
      icon="✓"
      trend={{ value: "+12% vs. ontem", positive: true }}
      color="orange"
    />
    <StatCard 
      title="Taxa de Sucesso"
      value="98.2%"
      icon="📊"
      trend={{ value: "+0.5%", positive: true }}
      color="green"
    />
  </div>

  <!-- Info Cards: 2 columns on desktop -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; grid-auto-flow: dense;">
    <!-- Rate Limiting Card -->
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <span style="font-size: 18px;">⚡</span>
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">Rate Limiting & Security</h3>
      </div>
      
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 28px; font-weight: 600; color: #1e293b;">{requestsPerMin}</span>
          <span style="font-size: 12px; color: #64748b;">requests/min</span>
        </div>
        <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
          <div style="height: 100%; background: #10b981; width: {requestsPercentage}%;"></div>
        </div>
        <div style="font-size: 11px; color: #64748b;">Limite: {maxRequests} req/min</div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <StatusIndicator status="online" label="/auth" value="Operacional" />
        <StatusIndicator status="online" label="/ai" value="Operacional" />
      </div>
    </div>

    <!-- Health Externos Card -->
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <span style="font-size: 18px;">🌐</span>
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">Health Externos</h3>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <StatusIndicator status="online" label="Groq API" value="Latência: 124ms" />
        <StatusIndicator status="warning" label="OpenRouter API" value="Latência: 856ms" />
      </div>
    </div>

    <!-- Chart Card: Full Width -->
    <div style="grid-column: 1 / -1; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <span style="font-size: 18px;">📈</span>
        <h3 style="margin: 0; flex: 1; font-size: 16px; font-weight: 600; color: #1e293b;">Gerações de IA nas últimas 24h</h3>
      </div>
      
      <svg style="width: 100%; height: 260px; margin-bottom: 16px;" viewBox="0 0 600 260">
        <line x1="40" y1="220" x2="600" y2="220" stroke="#e2e8f0" stroke-dasharray="3 3" />
        <line x1="40" y1="176" x2="600" y2="176" stroke="#e2e8f0" stroke-dasharray="3 3" />
        <line x1="40" y1="132" x2="600" y2="132" stroke="#e2e8f0" stroke-dasharray="3 3" />
        <line x1="40" y1="88" x2="600" y2="88" stroke="#e2e8f0" stroke-dasharray="3 3" />
        <line x1="40" y1="44" x2="600" y2="44" stroke="#e2e8f0" stroke-dasharray="3 3" />

        <text x="25" y="226" font-size="11" fill="#64748b">0</text>
        <text x="20" y="182" font-size="11" fill="#64748b">9</text>
        <text x="20" y="138" font-size="11" fill="#64748b">18</text>
        <text x="20" y="94" font-size="11" fill="#64748b">27</text>
        <text x="20" y="50" font-size="11" fill="#64748b">36</text>

        <polyline
          points="60,200 140,225 220,90 300,30 380,75 460,140"
          fill="none"
          stroke="#2563eb"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <circle cx="60" cy="200" r="4" fill="#2563eb" />
        <circle cx="140" cy="225" r="4" fill="#2563eb" />
        <circle cx="220" cy="90" r="4" fill="#2563eb" />
        <circle cx="300" cy="30" r="4" fill="#2563eb" />
        <circle cx="380" cy="75" r="4" fill="#2563eb" />
        <circle cx="460" cy="140" r="4" fill="#2563eb" />

        <text x="50" y="250" font-size="11" fill="#64748b">00:00</text>
        <text x="130" y="250" font-size="11" fill="#64748b">04:00</text>
        <text x="210" y="250" font-size="11" fill="#64748b">08:00</text>
        <text x="290" y="250" font-size="11" fill="#64748b">12:00</text>
        <text x="370" y="250" font-size="11" fill="#64748b">16:00</text>
        <text x="450" y="250" font-size="11" fill="#64748b">20:00</text>
      </svg>

      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #64748b;">📊 Total de gerações: 125</span>
        </div>
        <span style="color: #10b981; font-weight: 500;">+12% vs. ontem</span>
      </div>
    </div>
  </div>
</div>
