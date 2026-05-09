document.getElementById('filters-mount').innerHTML = `
  <div class="pri-tabs">
    <button class="pri-tab active" data-pri="high">🔴 Alta</button>
    <button class="pri-tab" data-pri="mid">🟡 Media</button>
    <button class="pri-tab" data-pri="low">🟢 Baja</button>
    <button class="pri-tab" data-pri="all">Todas</button>
  </div>
  <div class="task-search-wrap">
    <input type="search" id="task-search-input" class="task-search-input" placeholder="Buscar tareas, subtareas, proyectos o categorías..." autocomplete="off" />
    <button type="button" id="task-search-clear" class="task-search-clear" title="Limpiar búsqueda">✕</button>
  </div>
  <div class="scope-wrapper">
    <button class="scope-toggle" id="scope-toggle" aria-expanded="false">
      <span class="scope-toggle-icon">◈</span>
      <span id="scope-toggle-label">Hoy</span>
      <span class="scope-toggle-arrow">▾</span>
    </button>
    <div class="scope-panel" id="scope-panel">
      <button class="scope-btn active" data-scope="today">Hoy</button>
      <button class="scope-btn" data-scope="tomorrow">Mañana</button>
      <button class="scope-btn" data-scope="dayafter">Pasadomañana</button>
      <button class="scope-btn" data-scope="week">Esta semana</button>
      <button class="scope-btn" data-scope="month">Este mes</button>
      <button class="scope-btn" data-scope="nodate">Sin fecha</button>
      <button class="scope-btn" data-scope="all">Todo</button>
    </div>
  </div>
  <div class="filters-wrapper">
    <button class="filters-toggle" id="filters-toggle" aria-expanded="false">
      <span class="filters-toggle-icon">⇅</span>
      <span id="filter-toggle-label">Filtros</span>
      <span class="filter-active-dot" id="filter-active-dot"></span>
      <span class="filters-toggle-arrow">▾</span>
    </button>
    <div class="filters" id="filters-panel">
      <button class="filter-btn active" data-filter="all">Todas</button>
      <button class="filter-btn" data-filter="pending">Pendientes</button>
      <button class="filter-btn" data-filter="done">Completadas</button>
    </div>
  </div>
`;
