<script>
  export let title = "";
  export let value = "";
  export let icon = "📊";
  export let trend = null;
  export let color = "blue";

  const colors = {
    blue: "#2563eb",
    green: "#10b981",
    orange: "#f59e0b",
    red: "#ef4444"
  };

  const bgColors = {
    blue: "#eff6ff",
    green: "#f0fdf4",
    orange: "#fffbeb",
    red: "#fef2f2"
  };
</script>

<div class="stat-card">
  <div class="stat-content">
    <div class="stat-info">
      <div class="stat-title">{title}</div>
      <div class="stat-value">{value}</div>
      {#if trend}
        <div class="stat-trend" class:positive={trend.positive}>
          {trend.value}
        </div>
      {/if}
    </div>
    <div class="stat-icon" style="background-color: {bgColors[color]}; color: {colors[color]};">
      {icon}
    </div>
  </div>
</div>

<style>
  .stat-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
  }

  .stat-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .stat-info {
    flex: 1;
  }

  .stat-title {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: #0f172a;
    margin-bottom: 8px;
  }

  .stat-trend {
    font-size: 12px;
    color: #ef4444;
  }

  .stat-trend.positive {
    color: #10b981;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
  }
</style>
