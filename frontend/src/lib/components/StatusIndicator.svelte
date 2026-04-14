<script>
  export let status = "online"; // online, warning, offline
  export let label = "";
  export let value = "";

  const statusColors = {
    online: "#10b981",
    warning: "#f59e0b",
    offline: "#ef4444"
  };
</script>

<div class="indicator">
  <span class="status-dot" style="background-color: {statusColors[status]}"></span>
  <div class="indicator-content">
    <div class="indicator-label">{label}</div>
    <div class="indicator-value">{value}</div>
  </div>
</div>

<style>
  .indicator {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .indicator-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .indicator-label {
    font-size: 13px;
    font-weight: 500;
    color: #0f172a;
  }

  .indicator-value {
    font-size: 12px;
    color: #64748b;
  }
</style>
