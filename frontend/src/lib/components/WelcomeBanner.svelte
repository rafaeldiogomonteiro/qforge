<script>
  let isVisible = true;
  
  function dismiss() {
    isVisible = false;
  }
</script>

{#if isVisible}
  <div class="banner">
    <button class="banner-close" on:click={dismiss} aria-label="Fechar">✕</button>
    
    <div class="banner-content">
      <div class="banner-sparkle">✨</div>
      <div class="banner-text">
        <h2>Bem-vindo ao QForge</h2>
        <p>Gerencie bancos de questões, crie testes personalizados com IA e integre facilmente com o Moodle. Use os atalhos de teclado <kbd>?</kbd> para ver todas as funcionalidades.</p>
        <div class="banner-stats">
          <span>✓ 12 Bancos Ativos</span>
          <span>✓ 326 Testes Gerados</span>
          <span>✓ 98.2% Taxa de Sucesso</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .banner {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border-radius: 12px;
    padding: 24px 32px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }

  .banner::before {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: 200px;
    height: 200px;
    font-size: 120px;
    opacity: 0.05;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .banner-close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 18px;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .banner-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .banner-content {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 20px;
    align-items: flex-start;
    position: relative;
    z-index: 1;
  }

  .banner-sparkle {
    font-size: 32px;
    text-align: center;
  }

  .banner-text h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .banner-text p {
    font-size: 14px;
    opacity: 0.95;
    margin: 0 0 12px 0;
    line-height: 1.5;
  }

  kbd {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
  }

  .banner-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .banner-stats span {
    background: rgba(255, 255, 255, 0.2);
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
</style>
