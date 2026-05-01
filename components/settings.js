// Panel de ajustes (SPA overlay)
document.getElementById('settings-mount').innerHTML = `
  <div class="settings-overlay" id="settings-overlay" aria-hidden="true">
    <div class="settings-panel">

      <div class="settings-header">
        <span class="settings-title">Ajustes</span>
        <button class="settings-close" id="settings-close" title="Cerrar">✕</button>
      </div>

      <div class="settings-body">

        <!-- Sección: Categorías -->
        <section class="settings-section">
          <div class="settings-section-head">
            <span class="settings-section-icon">◈</span>
            <h2 class="settings-section-title">Categorías</h2>
          </div>
          <p class="settings-section-desc">Crea categorías personalizadas para organizar tus tareas.</p>

          <!-- Lista de categorías predeterminadas -->
          <div class="settings-cats-group">
            <div class="settings-cats-group-label">Predeterminadas</div>
            <div class="settings-cats-default" id="settings-cats-default"></div>
          </div>

          <!-- Lista de categorías personalizadas -->
          <div class="settings-cats-group" id="settings-custom-group">
            <div class="settings-cats-group-label">Personalizadas</div>
            <div class="settings-cats-custom" id="settings-cats-custom"></div>
          </div>

          <!-- Formulario de nueva categoría -->
          <div class="settings-cat-form" id="settings-cat-form">
            <div class="settings-cat-form-title" id="settings-cat-form-title">Nueva categoría</div>

            <!-- Nombre -->
            <div class="settings-field">
              <label class="settings-label">Nombre</label>
              <input class="settings-input" id="cat-name" type="text" maxlength="20" placeholder="Ej. Viajes" autocomplete="off"/>
            </div>

            <!-- Icono (emoji) -->
            <div class="settings-field">
              <label class="settings-label">Icono</label>
              <div class="settings-emoji-grid" id="settings-emoji-grid">
                <!-- Relleno por JS -->
              </div>
              <input class="settings-input settings-emoji-custom" id="cat-icon" type="text" maxlength="4" placeholder="✈ o pega cualquier emoji"/>
            </div>

            <!-- Color -->
            <div class="settings-field">
              <label class="settings-label">Color</label>
              <div class="settings-palette" id="settings-palette"></div>
            </div>

            <!-- Preview -->
            <div class="settings-cat-preview" id="settings-cat-preview">
              <span class="tag">
                <span class="tag-dot" id="preview-dot" style="background:#1a3c6e"></span>
                <span id="preview-label">👤 Vista previa</span>
              </span>
            </div>

            <!-- Botones -->
            <div class="settings-cat-actions">
              <button class="settings-btn-secondary" id="cat-cancel">Cancelar</button>
              <button class="settings-btn-primary" id="cat-save">Guardar categoría</button>
            </div>
          </div>

          <button class="settings-add-cat-btn" id="settings-add-cat-btn">
            <span>＋</span> Añadir categoría
          </button>
        </section>

        <!-- Sección: Gestión de datos -->
        <section class="settings-section">
          <div class="settings-section-head">
            <span class="settings-section-icon">⇅</span>
            <h2 class="settings-section-title">Gestión de datos</h2>
          </div>
          <p class="settings-section-desc">Exporta una copia de seguridad o restaura tus datos desde un archivo JSON.</p>

          <div class="settings-data-actions">
            <button class="settings-data-btn" id="data-export">↓ Exportar datos</button>
            <label class="settings-data-btn settings-data-import-label" for="data-import-file">
              ↑ Importar datos
              <input type="file" id="data-import-file" accept=".json" style="display:none">
            </label>
          </div>
          <button class="settings-data-btn settings-data-btn-danger" id="data-clear">⊘ Borrar todos los datos</button>
          <div class="settings-data-status" id="data-import-status"></div>

          <!-- Uso de almacenamiento -->
          <div class="storage-usage" id="storage-usage">
            <div class="storage-usage-header">
              <span class="storage-usage-label">Uso estimado de almacenamiento</span>
              <span class="storage-usage-value" id="storage-usage-value">…</span>
            </div>
            <div class="storage-usage-bar-track">
              <div class="storage-usage-bar-fill" id="storage-usage-fill"></div>
            </div>
            <div class="storage-usage-detail" id="storage-usage-detail"></div>
          </div>

          <!-- Confirmación de borrado -->
          <div class="settings-data-confirm" id="data-clear-confirm" style="display:none">
            <p class="settings-data-confirm-msg">¿Borrar todas las tareas, categorías y proyectos? Esta acción no se puede deshacer.</p>
            <div class="settings-data-confirm-actions">
              <button class="settings-data-confirm-cancel" id="data-clear-cancel">Cancelar</button>
              <button class="settings-data-confirm-ok" id="data-clear-ok">Sí, borrar todo</button>
            </div>
          </div>
        </section>

        <!-- Sección: Sincronización en la nube -->
        <section class="settings-section">
          <div class="settings-section-head">
            <span class="settings-section-icon">☁</span>
            <h2 class="settings-section-title">Sincronización en la nube</h2>
          </div>
          <p class="settings-section-desc">Guarda y restaura tus datos automáticamente desde un repositorio privado de GitHub.</p>

          <div class="settings-field">
            <label class="settings-label" for="cloud-secret">Clave de acceso</label>
            <div class="cloud-secret-row">
              <input class="settings-input" id="cloud-secret" type="password" placeholder="Pega tu BACKUP_SECRET" autocomplete="off"/>
              <button class="settings-data-btn cloud-secret-save" id="cloud-secret-save" title="Guardar clave">✓</button>
            </div>
            <span class="settings-section-desc" style="margin-top:2px">La misma clave que configuraste en BACKUP_SECRET de Vercel.</span>
          </div>

          <div class="cloud-status-row">
            <span class="cloud-status-dot" id="cloud-status-dot"></span>
            <span class="cloud-status" id="cloud-status">No sincronizado</span>
          </div>

          <div class="settings-data-actions">
            <button class="settings-data-btn" id="cloud-upload">☁ Subir backup ahora</button>
            <button class="settings-data-btn" id="cloud-download">↓ Restaurar desde la nube</button>
          </div>
        </section>

        <!-- Sección: Métricas -->
        <section class="settings-section">
          <div class="settings-section-head">
            <span class="settings-section-icon">◑</span>
            <h2 class="settings-section-title">Métricas de rendimiento</h2>
          </div>
          <p class="settings-section-desc">Marca qué categorías representan trabajo profundo (Maker). Las demás se considerarán operativas (Manager). Esto activa el Factor de Impacto en Estadística.</p>
          <div class="settings-field">
            <label class="settings-label">Categorías Maker (trabajo profundo)</label>
            <div class="maker-cats-grid" id="maker-cats-grid">
              <!-- Relleno por JS -->
            </div>
          </div>
          <div class="settings-data-actions" style="margin-top:10px">
            <button class="settings-data-btn" id="maker-cats-save">✓ Guardar configuración</button>
          </div>
        </section>

        <!-- Sección: Inteligencia Artificial -->
        <section class="settings-section">
          <div class="settings-section-head">
            <span class="settings-section-icon">✨</span>
            <h2 class="settings-section-title">Inteligencia Artificial</h2>
          </div>
          <p class="settings-section-desc">Configura tu clave de API para habilitar funciones inteligentes como desglose de tareas y captura mágica.</p>

          <div class="settings-field">
            <label class="settings-label" for="openrouter-key">API Key de OpenRouter</label>
            <div class="cloud-secret-row">
              <input class="settings-input" id="openrouter-key" type="password" placeholder="sk-or-v1-..." autocomplete="off"/>
              <button class="settings-data-btn cloud-secret-save" id="openrouter-key-save" title="Guardar clave API">✓</button>
            </div>
            <span class="settings-section-desc" style="margin-top:2px">Tus claves se guardan solo en tu dispositivo y se sincronizan en tu backup.</span>
          </div>
        </section>

      </div>
    </div>

    <!-- Overlay drag-and-drop de respaldo -->
    <div class="settings-drop-overlay" id="settings-drop-overlay">
      <div class="settings-drop-box">
        <div class="settings-drop-icon">📂</div>
        <div class="settings-drop-label">Suelta el archivo para restaurar el respaldo</div>
        <div class="settings-drop-hint">Archivo JSON de Daily Planner</div>
      </div>
    </div>
  </div>
`;
