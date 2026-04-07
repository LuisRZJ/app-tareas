// Botón flotante de navegación + panel modal
document.getElementById('form-mount').innerHTML = `
  <!-- Menú de navegación flotante -->
  <div class="nav-fab-wrap" id="nav-fab-wrap">
    <div class="nav-fab-menu" id="nav-fab-menu" aria-hidden="true">
      <button class="nav-fab-item" id="nav-nueva-nota" data-nav="nueva-nota">
        <span class="nav-fab-item-icon">✎</span>
        <span class="nav-fab-item-label">Nueva nota</span>
      </button>
      <button class="nav-fab-item" data-nav="proyectos">
        <span class="nav-fab-item-icon">◫</span>
        <span class="nav-fab-item-label">Proyectos</span>
      </button>
      <button class="nav-fab-item" data-nav="estadistica">
        <span class="nav-fab-item-icon">◎</span>
        <span class="nav-fab-item-label">Estadística</span>
      </button>
      <button class="nav-fab-item" data-nav="ajustes">
        <span class="nav-fab-item-icon">⊙</span>
        <span class="nav-fab-item-label">Ajustes</span>
      </button>
    </div>
    <button class="fab" id="fab-add" title="Menú" aria-expanded="false">
      <span class="fab-icon" id="fab-icon">≡</span>
    </button>
  </div>

  <div class="form-overlay" id="form-overlay">
    <div class="form-modal">
      <div class="form-modal-header">
        <span class="form-modal-title">Nueva tarea</span>
        <button class="form-modal-close" id="form-close" title="Cerrar">✕</button>
      </div>
      <div class="form-card">
        <div class="form-top">
          <div class="add-icon">＋</div>
          <input type="text" id="new-task" placeholder="Título de la tarea..." autocomplete="off" />
        </div>
        <div class="form-desc">
          <textarea id="new-desc" placeholder="Descripción (soporta **Markdown**)..." rows="3"></textarea>
        </div>
        <div class="form-extra">
          <div class="form-field">
            <label for="sel-due">Vencimiento</label>
            <input type="date" id="sel-due" />
          </div>
          <div class="form-field">
            <label for="sel-time">Hora</label>
            <input type="time" id="sel-time" />
          </div>
          <div class="form-field form-field-repeat">
            <label>Repetir cada</label>
            <div class="repeat-inputs">
              <input type="number" id="sel-repeat-n" min="1" max="999" placeholder="—" />
              <select id="sel-repeat-unit">
                <option value="">No repetir</option>
                <option value="h">horas</option>
                <option value="d">días</option>
                <option value="w">semanas</option>
                <option value="m">meses</option>
                <option value="y">años</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-bottom">
          <label>Proyecto</label>
          <select id="sel-project">
            <option value="">— Sin proyecto</option>
          </select>
          <label>Cat.</label>
          <select id="sel-cat">
            <option value="">— Sin categoría</option>
          </select>
          <label>Prioridad</label>
          <select id="sel-pri">
            <option value="mid">Media</option>
            <option value="high">Alta</option>
            <option value="low">Baja</option>
          </select>
          <button class="btn-add" onclick="addTask()">Agregar</button>
        </div>
      </div>
    </div>
  </div>
`;
