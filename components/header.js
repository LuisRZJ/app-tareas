document.getElementById('header-mount').innerHTML = `
  <div class="header">
    <div class="header-left">
      <h1>Mis <em>Tareas</em></h1>
      <div class="date" id="date-label"></div>
    </div>
    <div class="header-right">
      <div class="progress-ring" data-tip="Tiempo transcurrido del día actual" data-tip-dir="left">
        <div class="ring-wrap">
          <svg viewBox="0 0 64 64">
            <circle class="ring-bg" cx="32" cy="32" r="26"/>
            <circle class="ring-fill ring-fill-day" id="day-fill" cx="32" cy="32" r="26"/>
          </svg>
          <span class="ring-percent ring-percent-day" id="day-pct">0%</span>
        </div>
        <label>día</label>
      </div>
      <div class="progress-ring" data-tip="Progreso de tareas de hoy" data-tip-dir="left">
        <div class="ring-wrap">
          <svg viewBox="0 0 64 64">
            <circle class="ring-bg" cx="32" cy="32" r="26"/>
            <circle class="ring-fill" id="ring-fill" cx="32" cy="32" r="26"/>
          </svg>
          <span class="ring-percent" id="ring-pct">0%</span>
        </div>
        <label>progreso</label>
        <div class="ring-tooltip" id="ring-tip"></div>
      </div>
    </div>
  </div>
`;
