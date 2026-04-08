document.getElementById('task-mount').innerHTML = `
  <div>
    <div class="section-title" id="list-label">— tareas</div>
    <div class="task-list" id="task-list" style="margin-top:16px;"></div>
  </div>

  <!-- Modal: ¿qué hacer con subtareas al completar padre no recurrente? -->
  <div class="project-confirm-overlay" id="subtask-complete-overlay">
    <div class="project-confirm-box">
      <div class="project-confirm-title">Subtareas pendientes</div>
      <p class="project-confirm-text" id="subtask-complete-text"></p>
      <div class="project-confirm-actions">
        <button class="settings-btn-primary" id="subtask-complete-free">Liberar subtareas</button>
        <button class="settings-btn-secondary" id="subtask-complete-all">Completar todo</button>
      </div>
      <button class="project-confirm-cancel" id="subtask-complete-cancel">Cancelar</button>
    </div>
  </div>
`;
