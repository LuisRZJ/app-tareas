// Panel de proyectos (overlay SPA)
document.getElementById('projects-mount').innerHTML = `
  <div class="projects-overlay" id="projects-overlay" aria-hidden="true">
    <div class="projects-panel">

      <div class="projects-header">
        <span class="projects-title">Proyectos</span>
        <button class="projects-close" id="projects-close" title="Cerrar">✕</button>
      </div>

      <div class="projects-body">

        <section class="projects-section">
          <div class="projects-section-head">
            <span class="projects-section-icon">◫</span>
            <h2 class="projects-section-title">Mis proyectos</h2>
          </div>
          <p class="projects-section-desc">Agrupa tareas bajo un proyecto para organizar tu trabajo.</p>

          <!-- Lista de proyectos -->
          <div class="projects-list" id="projects-list"></div>

          <!-- Formulario crear/editar proyecto -->
          <div class="project-form" id="project-form">
            <div class="project-form-title" id="project-form-title">Nuevo proyecto</div>

            <div class="settings-field">
              <label class="settings-label">Nombre</label>
              <input class="settings-input" id="project-name" type="text" maxlength="40" placeholder="Ej. Rediseño web" autocomplete="off"/>
            </div>

            <div class="settings-field">
              <label class="settings-label">Descripción</label>
              <textarea class="settings-input project-desc-input" id="project-desc" rows="3" maxlength="200" placeholder="Descripción breve del proyecto..."></textarea>
            </div>

            <div class="settings-cat-actions">
              <button class="settings-btn-secondary" id="project-cancel">Cancelar</button>
              <button class="settings-btn-primary" id="project-save">Guardar proyecto</button>
            </div>
          </div>

          <button class="settings-add-cat-btn" id="projects-add-btn">
            <span>＋</span> Nuevo proyecto
          </button>
        </section>

      </div>
    </div>
  </div>

  <!-- Modal de confirmación para borrar proyecto -->
  <div class="project-confirm-overlay" id="project-confirm-overlay">
    <div class="project-confirm-box">
      <div class="project-confirm-title">Eliminar proyecto</div>
      <p class="project-confirm-text" id="project-confirm-text">¿Qué deseas hacer con las tareas de este proyecto?</p>
      <div class="project-confirm-actions">
        <button class="settings-btn-secondary" id="project-confirm-keep">Conservar tareas</button>
        <button class="project-confirm-delete-all" id="project-confirm-delete">Eliminar todo</button>
      </div>
      <button class="project-confirm-cancel" id="project-confirm-cancel">Cancelar</button>
    </div>
  </div>
`;
