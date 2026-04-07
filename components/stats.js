// Panel de estadísticas (SPA overlay)
document.getElementById('stats-mount').innerHTML = `
  <div class="stats-overlay" id="stats-overlay" aria-hidden="true">
    <div class="stats-panel">

      <div class="stats-header">
        <span class="stats-title">Estadística</span>
        <button class="stats-close" id="stats-close" title="Cerrar">✕</button>
      </div>

      <div class="stats-body">

        <!-- Total completadas -->
        <section class="stats-section">
          <div class="stats-card stats-card-total">
            <span class="stats-card-icon">✓</span>
            <div class="stats-card-info">
              <span class="stats-card-value" id="stats-total-done">0</span>
              <span class="stats-card-label">Tareas completadas</span>
            </div>
          </div>
          <!-- Métricas adicionales globales -->
          <div class="stats-metrics-row">
            <div class="stats-metric">
              <span class="stats-metric-value" id="stats-days-since">—</span>
              <span class="stats-metric-label">Días desde la primera tarea</span>
            </div>
            <div class="stats-metric">
              <span class="stats-metric-value" id="stats-streak">—</span>
              <span class="stats-metric-label">Semanas de racha</span>
            </div>
          </div>
        </section>

        <!-- Completadas por prioridad -->
        <section class="stats-section">
          <div class="stats-section-head">
            <span class="stats-section-icon">◈</span>
            <h2 class="stats-section-title">Por prioridad</h2>
          </div>
          <div class="stats-pri-grid">
            <div class="stats-card stats-card-pri">
              <span class="stats-pri-dot" style="background:#8b1a1a"></span>
              <div class="stats-card-info">
                <span class="stats-card-value" id="stats-pri-high">0</span>
                <span class="stats-card-label">Alta</span>
              </div>
            </div>
            <div class="stats-card stats-card-pri">
              <span class="stats-pri-dot" style="background:#7a6a00"></span>
              <div class="stats-card-info">
                <span class="stats-card-value" id="stats-pri-mid">0</span>
                <span class="stats-card-label">Media</span>
              </div>
            </div>
            <div class="stats-card stats-card-pri">
              <span class="stats-pri-dot" style="background:#1a5c1a"></span>
              <div class="stats-card-info">
                <span class="stats-card-value" id="stats-pri-low">0</span>
                <span class="stats-card-label">Baja</span>
              </div>
            </div>
          </div>
          <div id="stats-breakdown-total"></div>
        </section>

        <!-- Gráfica del mes -->
        <section class="stats-section">
          <div class="stats-month-nav">
            <button class="stats-month-btn" id="stats-month-prev" title="Mes anterior">‹</button>
            <div class="stats-section-head" style="flex:1;justify-content:center">
              <span class="stats-section-icon">◎</span>
              <h2 class="stats-section-title" id="stats-month-title">Evolución del mes</h2>
            </div>
            <button class="stats-month-btn" id="stats-month-next" title="Mes siguiente">›</button>
          </div>
          <div class="stats-chart-wrap">
            <canvas id="stats-chart"></canvas>
            <div class="stats-chart-tooltip" id="stats-chart-tooltip"></div>
          </div>
          <div class="stats-chart-legend" id="stats-chart-legend"></div>

          <!-- Desglose del mes en curso -->
          <div class="stats-card stats-card-total">
            <span class="stats-card-icon" style="font-size:16px">↻</span>
            <div class="stats-card-info">
              <span class="stats-card-value" id="stats-month-done">0</span>
              <span class="stats-card-label" id="stats-month-label">Completadas este mes</span>
            </div>
          </div>
          <div class="stats-pri-grid">
            <div class="stats-card stats-card-pri">
              <span class="stats-pri-dot" style="background:#8b1a1a"></span>
              <div class="stats-card-info">
                <span class="stats-card-value" id="stats-month-high">0</span>
                <span class="stats-card-label">Alta</span>
              </div>
            </div>
            <div class="stats-card stats-card-pri">
              <span class="stats-pri-dot" style="background:#7a6a00"></span>
              <div class="stats-card-info">
                <span class="stats-card-value" id="stats-month-mid">0</span>
                <span class="stats-card-label">Media</span>
              </div>
            </div>
            <div class="stats-card stats-card-pri">
              <span class="stats-pri-dot" style="background:#1a5c1a"></span>
              <div class="stats-card-info">
                <span class="stats-card-value" id="stats-month-low">0</span>
                <span class="stats-card-label">Baja</span>
              </div>
            </div>
          </div>
          <div id="stats-breakdown-month"></div>
        </section>

      </div>
    </div>
  </div>
`;
