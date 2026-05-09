let tasks = [];
let priFilter  = 'high';
let dateScope  = 'today';
let filterMode = 'all';
let toastTimer = null;
let editingId = null;
let subtaskParentId = null;
let detailStack = [];
let subtaskFilter = 'pending';
let _backupSha = null;
let _dataDirty = false;
let _backupSecret = null;
let _pendingCompleteParent = null;
let _pendingCompleteSubs = null;
let subtaskCompleteOverlay = null;
let currentDetailProjId = null;
let dayProgressInterval = null;
let targetTime = null;
let searchQuery = '';
let _searchIndexDirty = true;
let _searchIndex = [];
let _searchResultCache = new Map();
let _searchDebounceTimer = null;
let _searchRenderLimit = 250;
let _taskTitleMapCache = null;
const SEARCH_RENDER_STEP = 250;
const SEARCH_DEBOUNCE_MS = 130;
const SEARCH_CACHE_LIMIT = 15;

function markDirty() {
  _dataDirty = true;
  _searchIndexDirty = true;
  _searchResultCache.clear();
  _taskTitleMapCache = null;
}

async function getCloudHeaders(extra = {}) {
  if (!_backupSecret) _backupSecret = await dbGetMeta('backupSecret');
  const h = { ...extra };
  if (_backupSecret) h['Authorization'] = 'Bearer ' + _backupSecret;
  return h;
}

// ── Categorías: poblar select dinámicamente ──
function getTaskCats(t) {
  if (Array.isArray(t.cats) && t.cats.length) return t.cats;
  return t.cat ? [t.cat] : [];
}
function getCatSelectValues() {
  const dd = document.getElementById('cat-multi-dropdown');
  if (!dd) return [];
  return [...dd.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
}
function setCatSelectValues(arr) {
  const dd = document.getElementById('cat-multi-dropdown');
  if (!dd) return;
  dd.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = arr.includes(cb.value); });
  updateCatTriggerLabel();
}
function updateCatTriggerLabel() {
  const trigger = document.getElementById('cat-multi-trigger');
  if (!trigger) return;
  const selected = getCatSelectValues();
  if (!selected.length) { trigger.textContent = '— Sin categoría'; return; }
  const first = CATS[selected[0]];
  const label = first ? first.label : selected[0];
  trigger.textContent = selected.length > 1 ? `${label} +${selected.length - 1}` : label;
}
function rebuildCatSelect(preserveValue) {
  const dd = document.getElementById('cat-multi-dropdown');
  if (!dd) return;
  const prev = preserveValue !== undefined
    ? (Array.isArray(preserveValue) ? preserveValue : [preserveValue].filter(Boolean))
    : getCatSelectValues();
  dd.innerHTML = '';
  for (const [key, cat] of Object.entries(CATS)) {
    const label = document.createElement('label');
    label.className = 'cat-multi-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = key; cb.checked = prev.includes(key);
    cb.addEventListener('change', updateCatTriggerLabel);
    const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = cat.color;
    label.append(cb, dot, document.createTextNode(cat.label));
    dd.appendChild(label);
  }
  updateCatTriggerLabel();
}

// ── Filtros: reconstruir botones de categoría y proyecto dinámicamente ──
function rebuildFilterButtons() {
  const panel = document.getElementById('filters-panel');
  if (!panel) return;
  // Remove old dynamic buttons and separators
  panel.querySelectorAll('.filter-btn-cat, .filter-btn-proj, .filter-group-label').forEach(b => b.remove());
  // Category group
  if (Object.keys(CATS).length) {
    const catLabel = document.createElement('span');
    catLabel.className = 'filter-group-label';
    catLabel.textContent = 'Categorías';
    panel.appendChild(catLabel);
    for (const [key, cat] of Object.entries(CATS)) {
      const btn = document.createElement('button');
      btn.className = 'filter-btn filter-btn-cat';
      btn.dataset.filter = key;
      btn.textContent = cat.label;
      if (filterMode === key) btn.classList.add('active');
      panel.appendChild(btn);
    }
  }
  // Project group
  if (PROJECTS.length) {
    const projLabel = document.createElement('span');
    projLabel.className = 'filter-group-label';
    projLabel.textContent = 'Proyectos';
    panel.appendChild(projLabel);
    for (const proj of PROJECTS) {
      const btn = document.createElement('button');
      btn.className = 'filter-btn filter-btn-proj';
      btn.dataset.filter = 'proj:' + proj.id;
      btn.textContent = '◫ ' + proj.name;
      if (filterMode === 'proj:' + proj.id) btn.classList.add('active');
      panel.appendChild(btn);
    }
  }
  // Wire all filter buttons
  panel.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      panel.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterMode = btn.dataset.filter;
      const labels = { all:'Filtros', pending:'Pendientes', done:'Completadas' };
      for (const [k, c] of Object.entries(CATS)) labels[k] = c.label;
      for (const p of PROJECTS) labels['proj:' + p.id] = '◫ ' + p.name;
      document.getElementById('filter-toggle-label').textContent = labels[filterMode] || 'Filtros';
      document.getElementById('filters-toggle').classList.toggle('filtered', filterMode !== 'all');
      render();
    };
  });
}

// ── Proyectos: poblar select dinámicamente ──
function getProjSelectValue() {
  const dd = document.getElementById('proj-select-dropdown');
  if (!dd) return '';
  const checked = dd.querySelector('input[type=radio]:checked');
  return checked ? checked.value : '';
}
function setProjSelectValue(val) {
  const dd = document.getElementById('proj-select-dropdown');
  if (!dd) return;
  dd.querySelectorAll('input[type=radio]').forEach(r => { r.checked = false; });
  const rb = dd.querySelector(`input[type=radio][value="${CSS.escape(String(val))}"]`)
    || dd.querySelector(`input[type=radio][value="${String(val)}"]`);
  if (rb) rb.checked = true;
  updateProjTriggerLabel();
}
function updateProjTriggerLabel() {
  const trigger = document.getElementById('proj-select-trigger');
  if (!trigger) return;
  const val = getProjSelectValue();
  if (!val) { trigger.textContent = '\u2014 Sin proyecto'; return; }
  const proj = getProjectById(Number(val));
  trigger.textContent = proj ? '\u25ab ' + proj.name : '\u2014 Sin proyecto';
}
function rebuildProjectSelect(preserveValue) {
  const dd = document.getElementById('proj-select-dropdown');
  if (!dd) return;
  const prev = preserveValue !== undefined ? String(preserveValue) : getProjSelectValue();
  dd.innerHTML = '';
  // "Sin proyecto" option
  const noneLabel = document.createElement('label');
  noneLabel.className = 'cat-multi-item';
  const noneRb = document.createElement('input');
  noneRb.type = 'radio'; noneRb.name = 'proj-select-rb'; noneRb.value = ''; noneRb.checked = !prev;
  noneRb.addEventListener('change', () => { updateProjTriggerLabel(); document.getElementById('proj-select-dropdown').classList.remove('open'); });
  noneLabel.append(noneRb, document.createTextNode('\u2014 Sin proyecto'));
  dd.appendChild(noneLabel);
  for (const proj of PROJECTS) {
    const label = document.createElement('label');
    label.className = 'cat-multi-item';
    const rb = document.createElement('input');
    rb.type = 'radio'; rb.name = 'proj-select-rb'; rb.value = String(proj.id); rb.checked = String(proj.id) === String(prev);
    rb.addEventListener('change', () => { updateProjTriggerLabel(); document.getElementById('proj-select-dropdown').classList.remove('open'); });
    const icon = document.createElement('span'); icon.textContent = '\u25ab'; icon.style.cssText = 'font-size:11px;color:var(--text3);flex-shrink:0';
    label.append(rb, icon, document.createTextNode('\u00a0' + proj.name));
    dd.appendChild(label);
  }
  updateProjTriggerLabel();
}

function updateDateLabel() {
  const d = new Date();
  const date = d.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('date-label').textContent = date + ' · ' + time;
}
updateDateLabel();

// ── Helpers de fecha ──
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function parseISODateLocal(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatISODateLocal(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function parseTimeHHMM(timeStr) {
  if (!timeStr || !String(timeStr).includes(':')) return { h: 0, m: 0 };
  const [hh, mm] = String(timeStr).split(':').map(Number);
  const h = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 0;
  const m = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
  return { h, m };
}

function addDays(dateStr, days) {
  const d = parseISODateLocal(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() + Number(days));
  return formatISODateLocal(d);
}
function formatDateNice(dateStr) {
  if (!dateStr) return '';
  const d = parseISODateLocal(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDueLabel(dateStr) {
  if (!dateStr) return '';
  const today = todayISO();
  if (dateStr === today) return 'Hoy';
  if (dateStr === addDays(today, 1)) return 'Mañana';
  const dow = new Date().getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(today, mondayOffset);
  const sunday = addDays(monday, 6);
  if (dateStr >= monday && dateStr <= sunday) {
    const d = parseISODateLocal(dateStr);
    if (!d) return formatDateNice(dateStr);
    const name = d.toLocaleDateString('es-ES', { weekday: 'long' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return formatDateNice(dateStr);
}
function formatCreatedTime(t) {
  const d = new Date(t.id);
  const createdDate = formatISODateLocal(d);
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (createdDate === todayISO()) return 'Creada hoy a las ' + time;
  const date = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return 'Creada el ' + date + ' a las ' + time;
}
function getDueStatus(dateStr, timeStr) {
  if (!dateStr) return '';
  const t = todayISO();
  if (dateStr < t) return 'overdue';
  if (dateStr === t) {
    if (timeStr) {
      const now = new Date();
      const [h, m] = timeStr.split(':').map(Number);
      const due = new Date(); due.setHours(h, m, 0, 0);
      if (now > due) return 'overdue';
    }
    return 'today';
  }
  return 'future';
}
function addRepeat(dateStr, timeStr, repeatVal) {
  if (!repeatVal) return { due: dateStr, dueTime: timeStr };
  const repStr = String(repeatVal);

  // ── Días de la semana ──
  if (repStr.startsWith('dw:')) {
    const allowedDays = [...new Set(repStr
      .slice(3)
      .split(',')
      .map(Number)
      .filter(x => !isNaN(x) && x >= 0 && x <= 6))];
    if (!allowedDays.length) return { due: dateStr, dueTime: timeStr };
    const d = parseISODateLocal(dateStr);
    if (!d) return { due: dateStr, dueTime: timeStr };
    d.setDate(d.getDate() + 1); // avanzar al menos un día
    for (let i = 0; i < 7; i++) {
      if (allowedDays.includes(d.getDay())) break;
      d.setDate(d.getDate() + 1);
    }
    return { due: formatISODateLocal(d), dueTime: timeStr || '' };
  }

  let n, unit;
  if (repStr.includes(':')) {
    [n, unit] = repStr.split(':');
    n = Number(n);
  } else {
    n = Number(repStr); unit = 'd';
  }
  if (!Number.isFinite(n) || n <= 0) return { due: dateStr, dueTime: timeStr };
  if (unit === 'h') {
    const baseDate = parseISODateLocal(dateStr);
    if (!baseDate) return { due: dateStr, dueTime: timeStr };
    const { h, m } = parseTimeHHMM(timeStr || '00:00');
    const dt = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      h,
      m,
      0,
      0
    );
    dt.setHours(dt.getHours() + n);
    return {
      due: formatISODateLocal(dt),
      dueTime: String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0')
    };
  }
  const d = parseISODateLocal(dateStr);
  if (!d) return { due: dateStr, dueTime: timeStr };
  if (unit === 'd') d.setDate(d.getDate() + n);
  else if (unit === 'w') d.setDate(d.getDate() + n * 7);
  else if (unit === 'm') d.setMonth(d.getMonth() + n);
  else if (unit === 'y') d.setFullYear(d.getFullYear() + n);
  return { due: formatISODateLocal(d), dueTime: timeStr || '' };
}
function formatRepeat(repeatVal) {
  if (!repeatVal) return '';
  const repStr = String(repeatVal);

  // ── Días de la semana ──
  if (repStr.startsWith('dw:')) {
    const dayLabels = ['D','L','M','X','J','V','S']; // índice = getDay()
    const days = repStr.slice(3).split(',').map(Number).filter(x => !isNaN(x) && x >= 0 && x <= 6);
    if (!days.length) return '';
    return days.map(d => dayLabels[d]).join(' ');
  }

  let n, unit;
  if (repStr.includes(':')) { [n, unit] = repStr.split(':'); n = Number(n); }
  else { n = Number(repStr); unit = 'd'; }
  const labels = { h: n===1?'hora':'horas', d: n===1?'día':'días', w: n===1?'semana':'semanas', m: n===1?'mes':'meses', y: n===1?'año':'años' };
  return `cada ${n} ${labels[unit] || unit}`;
}

function isTaskOverdue(t) {
  return !t.done && getDueStatus(t.due, t.dueTime) === 'overdue';
}

// ── Inicialización del date picker ──
function initDatePicker() {
  const input = document.getElementById('sel-due');
  if (input) input.min = todayISO();
}
function initTimePicker() {
  const input = document.getElementById('sel-time');
  if (input && !input.value) {
    const now = new Date();
    input.value = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  }
}

// ── Persistencia ──
async function saveTasks() {
  for (const t of tasks) await dbPut(t);
}
async function loadTasks() {
  tasks = await dbGetAll();
  tasks.sort((a, b) => b.id - a.id);
  // Migración: tareas done sin doneAt (creadas antes de que se añadiera el campo)
  const toMigrate = tasks.filter(t => t.done && !t.doneAt);
  if (toMigrate.length) {
    for (const t of toMigrate) {
      t.doneAt = t.due || formatISODateLocal(new Date(t.id));
      await dbPut(t);
    }
  }
}

// ── CRUD ──
async function addTask() {
  const input = document.getElementById('new-task');
  const descInput = document.getElementById('new-desc');
  const text = input.value.trim();
  if (!text) { showToast('✏️  Escribe una tarea primero'); input.focus(); return; }
  const cats = getCatSelectValues();
  const pri = document.getElementById('sel-pri').value;
  const project = getProjSelectValue();
  const desc    = descInput ? descInput.value.trim() : '';
  const due     = document.getElementById('sel-due').value || '';
  const dueTime = due ? (document.getElementById('sel-time').value || '') : '';
  const repeatN    = document.getElementById('sel-repeat-n').value.trim();
  const repeatUnit  = document.getElementById('sel-repeat-unit').value;
  let repeat = '';
  if (due && repeatUnit) {
    if (repeatUnit === 'dw') {
      const activeDays = [...document.querySelectorAll('#repeat-days-picker .day-btn.active')]
        .map(b => b.dataset.day).join(',');
      if (activeDays) repeat = 'dw:' + activeDays;
    } else if (repeatN) {
      repeat = repeatN + ':' + repeatUnit;
    }
  }

  if (editingId !== null) {
    const t = tasks.find(t => t.id === editingId);
    if (t) {
      t.text = text; t.desc = desc; t.cats = cats; t.cat = cats[0] || ''; t.pri = pri;
      t.due = due; t.dueTime = dueTime; t.repeat = repeat; t.project = project;
      await dbPut(t);
    }
    markDirty();
    showToast('✎ Tarea actualizada');
  } else {
    const task = { id: now(), text, desc, cats, cat: cats[0] || '', pri, due, dueTime, repeat, project, parentId: subtaskParentId || null, done: false, time: new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) };
    tasks.unshift(task);
    await dbPut(task);
    markDirty();
    showToast(subtaskParentId ? '✓ Subtarea agregada' : '✓ Tarea agregada');
  }

  input.value = '';
  descInput.value = '';
  render();
  closeForm();
  // Refresh detail if open
  if (detailStack.length) renderDetailBody(detailStack[detailStack.length - 1]);
}

document.getElementById('new-task').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

async function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;

  if (!t.done && t.repeat && t.due) {
    // Archivar la ocurrencia completada (done:true) y crear la siguiente
    const childTasks = tasks.filter(task => task.parentId === t.id);
    // Marcar la ocurrencia actual como completada (queda como historial)
    t.done = true;
    t.doneAt = todayISO();
    await dbPut(t);
    const next = addRepeat(t.due, t.dueTime || '', t.repeat);
    const newTask = {
      id: now(),
      text: t.text,
      desc: t.desc,
      cats: getTaskCats(t),
      cat: getTaskCats(t)[0] || '',
      pri: t.pri,
      due: next.due,
      dueTime: next.dueTime,
      repeat: t.repeat,
      project: t.project || '',
      parentId: t.parentId || null,
      done: false,
      time: new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})
    };
    tasks.unshift(newTask);
    await dbPut(newTask);
    // Reasignar subtareas al nuevo padre
    for (const child of childTasks) {
      child.parentId = newTask.id;
      await dbPut(child);
    }
    markDirty();
    render();
    showToast(`🔁 Reprogramada para ${formatDateNice(next.due)}`, {
      undo: true,
      onUndo: async () => {
        // Borrar la nueva ocurrencia, restaurar el padre original como pendiente
        tasks = tasks.filter(task => task.id !== newTask.id);
        await dbDelete(newTask.id);
        t.done = false;
        t.doneAt = null;
        await dbPut(t);
        for (const child of childTasks) {
          child.parentId = t.id;
          await dbPut(child);
        }
        render();
      }
    });
  } else {
    // Si se va a completar (no reabrir) y tiene subtareas pendientes, preguntar qué hacer
    if (!t.done) {
      const pendingSubs = tasks.filter(task => task.parentId === t.id && !task.done);
      if (pendingSubs.length > 0) {
        showSubtaskCompleteDialog(t, pendingSubs);
        return;
      }
    }
    // Completar tarea sin fecha: asignarle la fecha de hoy para que aparezca en Todo
    const hadDue = t.due;
    if (!t.done && !t.due) {
      t.due = todayISO();
    }
    if (!t.done) { t.doneAt = todayISO(); } else { t.doneAt = null; }
    t.done = !t.done;
    await dbPut(t);
    markDirty();
    render();
    if (t.done) {
      showToast('🎉 ¡Tarea completada!', {
        undo: true,
        onUndo: async () => {
          t.done = false;
          t.doneAt = null;
          if (!hadDue) t.due = '';
          await dbPut(t);
          render();
        }
      });
    } else {
      showToast('↩ Tarea reabierta');
    }
  }
}

function showSubtaskCompleteDialog(parent, pendingSubs) {
  _pendingCompleteParent = parent;
  _pendingCompleteSubs = pendingSubs;
  const total = pendingSubs.length;
  const recurring = pendingSubs.filter(s => s.repeat).length;
  let msg = `Esta tarea tiene ${total} subtarea${total > 1 ? 's' : ''} pendiente${total > 1 ? 's' : ''}`;
  if (recurring > 0) msg += ` (${recurring} con recurrencia)`;
  msg += '. ¿Qué deseas hacer con ellas?';
  document.getElementById('subtask-complete-text').textContent = msg;
  subtaskCompleteOverlay.classList.add('open');
}

async function executeCompleteParent(action) {
  subtaskCompleteOverlay.classList.remove('open');
  if (action === 'cancel') { _pendingCompleteParent = null; _pendingCompleteSubs = null; return; }
  const t = _pendingCompleteParent;
  const subs = _pendingCompleteSubs;
  _pendingCompleteParent = null;
  _pendingCompleteSubs = null;
  const hadDue = t.due;
  if (!t.due) t.due = todayISO();
  t.done = true;
  t.doneAt = todayISO();
  await dbPut(t);
  if (action === 'free') {
    // Desvincula las subtareas pendientes: pasan a ser tareas independientes
    for (const s of subs) { s.parentId = null; await dbPut(s); }
  } else if (action === 'all') {
    // Marca todas las subtareas pendientes como completadas
    for (const s of subs) {
      if (!s.due) s.due = todayISO();
      s.done = true;
      s.doneAt = todayISO();
      await dbPut(s);
    }
  }
  markDirty();
  render();
  if (!handleDetailAfterCompletion(t.id) && detailStack.length) {
    renderDetailBody(detailStack[detailStack.length - 1]);
  }
  showToast('🎉 ¡Tarea completada!', {
    undo: true,
    onUndo: async () => {
      t.done = false;
      t.doneAt = null;
      if (!hadDue) t.due = '';
      await dbPut(t);
      if (action === 'free') {
        for (const s of subs) { s.parentId = t.id; await dbPut(s); }
      } else if (action === 'all') {
        for (const s of subs) { s.done = false; s.doneAt = null; await dbPut(s); }
      }
      render();
    }
  });
}

async function deleteTask(id) {
  const deleted = tasks.find(t => t.id === id);
  // Cascade delete subtasks recursively
  const toDelete = [id];
  const collectChildren = (pid) => {
    tasks.filter(t => t.parentId === pid).forEach(t => { toDelete.push(t.id); collectChildren(t.id); });
  };
  collectChildren(id);
  const removedTasks = tasks.filter(t => toDelete.includes(t.id));
  tasks = tasks.filter(t => !toDelete.includes(t.id));
  for (const tid of toDelete) await dbDelete(tid);
  markDirty();
  render();
  if (detailStack.length) {
    if (toDelete.includes(detailStack[detailStack.length - 1])) closeTaskDetail();
    else renderDetailBody(detailStack[detailStack.length - 1]);
  }
  showToast('🗑 Tarea eliminada', {
    undo: true,
    onUndo: async () => {
      for (const t of removedTasks) { tasks.unshift(t); await dbPut(t); }
      render();
      if (detailStack.length) renderDetailBody(detailStack[detailStack.length - 1]);
    }
  });
}

function getPriLabel(p) {
  if (p === 'high') return '<span class="priority-badge priority-high">Alta</span>';
  if (p === 'mid')  return '<span class="priority-badge priority-mid">Media</span>';
  return '<span class="priority-badge priority-low">Baja</span>';
}

function getDueBadge(t) {
  if (!t.due || t.done) return '';
  const status = getDueStatus(t.due, t.dueTime);
  const label = formatDueLabel(t.due);
  const timeLabel = t.dueTime ? ` · ${t.dueTime}` : '';
  return `<span class="due-badge due-${status}" title="Vencimiento">📅 ${label}${timeLabel}</span>`;
}

function getRepeatBadge(t) {
  if (!t.repeat) return '';
  return `<span class="repeat-badge">🔁 ${formatRepeat(t.repeat)}</span>`;
}

function getProjectBadge(t) {
  if (!t.project) return '';
  const proj = getProjectById(Number(t.project));
  if (!proj) return '';
  return `<span class="project-badge">◫ ${escHtml(proj.name)}</span>`;
}

function getSubtasks(id) {
  return tasks.filter(t => t.parentId === id);
}
function getSubtaskBadge(t) {
  const subs = getSubtasks(t.id);
  if (!subs.length) return '';
  const done = subs.filter(s => s.done).length;
  return `<span class="subtask-badge">☐ ${done}/${subs.length}</span>`;
}

function getTaskTitleMap() {
  if (_taskTitleMapCache && _taskTitleMapCache.size === tasks.length) return _taskTitleMapCache;
  _taskTitleMapCache = new Map(tasks.map(t => [t.id, String(t.text || '').trim()]));
  return _taskTitleMapCache;
}

function getSubtaskParentBadge(t) {
  if (!t.parentId) return '';
  const name = getTaskTitleMap().get(t.parentId) || '';
  if (!name) return '';
  const short = name.length > 28 ? name.slice(0, 28) + '…' : name;
  return `<span class="subtask-parent-badge">↳ ${escHtml(short || 'Tarea padre')}</span>`;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getSearchScore(entry, q) {
  let score = 0;
  if (entry.text.startsWith(q)) score += 9;
  if (entry.text.includes(q)) score += 6;
  if (entry.desc.includes(q)) score += 4;
  if (entry.project.includes(q)) score += 3;
  if (entry.categories.includes(q)) score += 3;
  if (entry.parentTitle.includes(q)) score += 2;
  if (!entry.done) score += 1;
  return score;
}

function rebuildSearchIndexIfNeeded() {
  if (!_searchIndexDirty && _searchIndex.length === tasks.length) return;

  const titles = getTaskTitleMap();
  const projById = new Map(PROJECTS.map(p => [String(p.id), normalizeSearchText(p.name || '')]));

  _searchIndex = tasks.map(t => {
    const text = normalizeSearchText(t.text);
    const desc = normalizeSearchText(t.desc);
    const project = t.project ? (projById.get(String(t.project)) || '') : '';
    const categories = normalizeSearchText(getTaskCats(t).map(key => (CATS[key]?.label || key)).join(' '));
    const parentTitle = t.parentId ? normalizeSearchText(titles.get(t.parentId) || '') : '';
    const blob = [text, desc, project, categories, parentTitle].join(' ');
    return {
      task: t,
      id: t.id,
      done: !!t.done,
      text,
      desc,
      project,
      categories,
      parentTitle,
      blob
    };
  });

  _searchIndexDirty = false;
  _searchResultCache.clear();
}

function searchTasksGlobal(query) {
  const q = normalizeSearchText(query).trim();
  if (!q) return [];

  rebuildSearchIndexIfNeeded();

  if (_searchResultCache.has(q)) return _searchResultCache.get(q);

  const ranked = [];
  for (const entry of _searchIndex) {
    if (!entry.blob.includes(q)) continue;
    ranked.push({ entry, score: getSearchScore(entry, q) });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.entry.done !== b.entry.done) return a.entry.done ? 1 : -1;
    return b.entry.id - a.entry.id;
  });

  const result = ranked.map(x => x.entry.task);
  _searchResultCache.set(q, result);
  if (_searchResultCache.size > SEARCH_CACHE_LIMIT) {
    const oldest = _searchResultCache.keys().next().value;
    if (oldest) _searchResultCache.delete(oldest);
  }
  return result;
}

function priorityTasks() {
  if (priFilter === 'all') return tasks.filter(t => !t.parentId);
  return tasks.filter(t => !t.parentId && t.pri === priFilter);
}

function scopedTasks() {
  const src = priorityTasks();
  if (dateScope === 'today')    return src.filter(t => t.due === todayISO());
  if (dateScope === 'tomorrow') return src.filter(t => t.due === addDays(todayISO(), 1));
  if (dateScope === 'dayafter') return src.filter(t => t.due === addDays(todayISO(), 2));
  if (dateScope === 'week') {
    const d = new Date();
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addDays(todayISO(), mondayOffset);
    const sunday = addDays(monday, 6);
    return src.filter(t => t.due && t.due >= monday && t.due <= sunday);
  }
  if (dateScope === 'month') {
    const monthPrefix = todayISO().slice(0, 7);
    return src.filter(t => t.due && t.due.startsWith(monthPrefix));
  }
  if (dateScope === 'nodate')   return src.filter(t => !t.due && !t.done);
  return src.filter(t => t.due);
}

function filteredTasks() {
  const base = filterMode === 'done'
    ? scopedTasks().filter(t => t.done)
    : scopedTasks().filter(t => !t.done);
  let result;
  switch(filterMode) {
    case 'done':    result = base; break;
    case 'pending': result = base; break;
    default:
      if (filterMode in CATS) result = base.filter(t => getTaskCats(t).includes(filterMode));
      else if (filterMode.startsWith('proj:')) result = base.filter(t => String(t.project) === filterMode.slice(5));
      else result = base;
  }
  return sortTasks(result);
}

// Pendientes: fecha asc (vencidas primero, sin fecha al final)
// Completadas: fecha desc (recientes primero, más antiguas al fondo)
function sortTasks(arr) {
  return [...arr].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const aDue = a.due || '';
    const bDue = b.due || '';
    if (!aDue && !bDue) return 0;
    if (!aDue) return 1;
    if (!bDue) return -1;
    if (a.done) return aDue > bDue ? -1 : aDue < bDue ? 1 : 0;
    return aDue < bDue ? -1 : aDue > bDue ? 1 : 0;
  });
}

function render() {
  const list = document.getElementById('task-list');
  const searchActive = !!searchQuery.trim();
  const searchResults = searchActive ? searchTasksGlobal(searchQuery) : [];
  const visible = searchActive ? searchResults.slice(0, _searchRenderLimit) : filteredTasks();
  const scoped  = searchActive ? searchResults : scopedTasks();
  const searchTotal = searchActive ? searchResults.length : 0;
  const todayStr = todayISO();

  // ── Anillo de progreso: todas las tareas y subtareas de hoy, filtrado por categoría o proyecto ──
  const isCatFilter = filterMode in CATS;
  const isProjFilter = filterMode.startsWith('proj:');
  const todayAll = tasks.filter(t => {
    if (t.due !== todayStr) return false;
    if (isCatFilter) return getTaskCats(t).includes(filterMode);
    if (isProjFilter) return String(t.project) === filterMode.slice(5);
    return true;
  });
  const snoozedTodayTasks = tasks.filter(t => {
    if (!Array.isArray(t.snoozedDates) || !t.snoozedDates.includes(todayStr)) return false;
    if (isCatFilter) return getTaskCats(t).includes(filterMode);
    if (isProjFilter) return String(t.project) === filterMode.slice(5);
    return true;
  });
  const snoozedPreview = snoozedTodayTasks
    .slice(0, 3)
    .map(t => (t.text || 'Sin título').trim())
    .join(' · ');
  const snoozedMore = snoozedTodayTasks.length > 3 ? ` +${snoozedTodayTasks.length - 3} más` : '';
  const tTotal   = todayAll.length;
  const tDone    = todayAll.filter(t => t.done).length;
  const tOverdue = todayAll.filter(t => isTaskOverdue(t)).length;
  const isToday  = dateScope === 'today';
  const allDoneNoOverdue = tTotal > 0 && tDone === tTotal && tOverdue === 0;
  const pct = tTotal ? (allDoneNoOverdue ? 100 : Math.min(Math.round(tDone/tTotal*100), 99)) : 0;

  const circ = 163;
  const ringFill = document.getElementById('ring-fill');
  const ringPct  = document.getElementById('ring-pct');
  const ringTip  = document.getElementById('ring-tip');
  const ringWrap = ringFill.closest('.progress-ring');

  if (isToday) {
    ringWrap.classList.remove('ring-disabled');
    ringPct.textContent = pct + '%';
    ringTip.innerHTML =
      `<div class="ring-tip-row"><span>Total</span><span>${tTotal}</span></div>` +
      `<div class="ring-tip-row"><span>Pendientes</span><span>${tTotal - tDone}</span></div>` +
      `<div class="ring-tip-row"><span>Completadas</span><span>${tDone}</span></div>` +
      `<div class="ring-tip-row ${tOverdue ? 'overdue' : ''}"><span>Vencidas</span><span>${tOverdue}</span></div>` +
      `<div class="ring-tip-row ring-tip-row-snoozed"><span>Pospuestas hoy</span><span>${snoozedTodayTasks.length}</span></div>` +
      (snoozedTodayTasks.length
        ? `<div class="ring-tip-note">${snoozedPreview}${snoozedMore}</div>`
        : '');
    const tPct = pct / 100;
    const ringColor = lerpColor(139,94,16, 26,92,26, tPct);
    ringFill.style.strokeDashoffset = circ - (circ * pct / 100);
    ringFill.style.stroke = ringColor;
    ringPct.style.color = ringColor;
  } else {
    ringWrap.classList.add('ring-disabled');
    ringPct.textContent = '—';
    ringTip.innerHTML = `<div class="ring-tip-row"><span>Solo disponible en "Hoy"</span></div>`;
    ringFill.style.strokeDashoffset = circ;
    ringFill.style.stroke = 'var(--border2)';
    ringPct.style.color = 'var(--text3)';
  }

  // ── Etiqueta de lista: basada en datos del scope activo ──
  const sTotal   = scoped.length;
  const sDone    = scoped.filter(t => t.done).length;
  const sOverdue = scoped.filter(t => isTaskOverdue(t)).length;
  const scopeLabel  = { today: 'hoy', tomorrow: 'mañana', dayafter: 'pasadomañana', week: 'esta semana', month: 'este mes', nodate: 'sin fecha', all: '' };
  const scopeSuffix = scopeLabel[dateScope] ? ` · ${scopeLabel[dateScope]}` : '';
  const labelMap = {
    all:      `tareas${scopeSuffix} · ${sTotal}`,
    pending:  `pendientes${scopeSuffix} · ${sTotal - sDone}`,
    done:     `completadas${scopeSuffix} · ${sDone}`,
    overdue:  `vencidas${scopeSuffix} · ${sOverdue}`,
    personal: `personal${scopeSuffix}`,
    trabajo:  `trabajo${scopeSuffix}`,
    salud:    `salud${scopeSuffix}`,
  };
  document.getElementById('list-label').textContent = searchActive
    ? `— búsqueda global · ${searchTotal}`
    : ('— ' + (labelMap[filterMode] || 'tareas'));

  if (!visible.length) {
    list.innerHTML = searchActive
      ? `<div class="empty">
          <div class="empty-icon">⌕</div>
          <h3>Sin coincidencias</h3>
          <p>No encontré tareas para "${escHtml(searchQuery)}"</p>
        </div>`
      : `<div class="empty">
          <div class="empty-icon">✦</div>
          <h3>Sin tareas aquí</h3>
          <p>Agrega una nueva tarea o cambia el filtro</p>
        </div>`;
    return;
  }

  if (!searchActive && ['all', 'week', 'month'].includes(dateScope)) {
    // Agrupar por fecha de vencimiento
    const groups = new Map();
    for (const t of visible) {
      const key = t.due || '__nodate__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    // Grupos con al menos 1 pendiente → orden asc (vencidos primero)
    // Grupos 100% completados → orden desc (recientes primero, más antiguas al fondo)
    const allKeys = [...groups.keys()];
    const pendingKeys = allKeys
      .filter(k => groups.get(k).some(t => !t.done))
      .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    const doneKeys = allKeys
      .filter(k => groups.get(k).every(t => t.done))
      .sort((a, b) => a > b ? -1 : a < b ? 1 : 0);
    const sortedKeys = [...pendingKeys, ...doneKeys];
    const today = todayISO();
    list.innerHTML = sortedKeys.map(key => {
      const items = groups.get(key);
      let label;
      if (key === '__nodate__') label = 'Sin fecha';
      else if (key === today) label = 'Hoy · ' + formatDateNice(key);
      else if (key === addDays(today, 1)) label = 'Mañana · ' + formatDateNice(key);
      else if (key === addDays(today, 2)) label = 'Pasadomañana · ' + formatDateNice(key);
      else label = formatDateNice(key);
      const count = items.length === 1 ? '1 tarea' : `${items.length} tareas`;
      return `<div class="task-group">
        <div class="task-group-header">
          <span class="task-group-label">${label}</span>
          <span class="task-group-line"></span>
          <span class="task-group-count">${count}</span>
        </div>
        ${items.map(t => renderTaskItem(t)).join('')}
      </div>`;
    }).join('');
  } else {
    list.innerHTML = visible.map(t => renderTaskItem(t)).join('');
    if (searchActive) {
      const shown = visible.length;
      const remain = Math.max(0, searchTotal - shown);
      const shownText = shown.toLocaleString('es-ES');
      const totalText = searchTotal.toLocaleString('es-ES');
      const nextChunk = Math.min(SEARCH_RENDER_STEP, remain);
      list.innerHTML += `<div class="search-load-more-wrap">
        <div class="search-results-counter">Mostrando ${shownText} de ${totalText} resultados</div>
        ${remain > 0 ? `<button class="search-load-more-btn" id="search-load-more" type="button">Cargar ${nextChunk} más · ${remain} restantes</button>` : ''}
      </div>`;
      if (remain > 0) {
        const loadMoreBtn = document.getElementById('search-load-more');
        if (loadMoreBtn) {
          loadMoreBtn.addEventListener('click', () => {
            _searchRenderLimit += SEARCH_RENDER_STEP;
            render();
          });
        }
      }
    }
  }
  // Refresh project detail if open
  if (currentDetailProjId) renderProjectDetailTasks();
}

function renderTaskItem(t) {
  const taskCats = getTaskCats(t);
  const primaryCat = taskCats.length ? (CATS[taskCats[0]] || CATS.otro) : null;
  const extraCount = taskCats.length - 1;
  const overdueClass = isTaskOverdue(t) ? 'overdue' : '';
  const catTag = primaryCat
    ? `<span class="tag"><span class="tag-dot" style="background:${primaryCat.color}"></span>${primaryCat.label}${extraCount > 0 ? `<span class="tag-extra">+${extraCount}</span>` : ''}</span>`
    : '';
  const priColor = t.pri === 'high' ? '#8b1a1a' : t.pri === 'mid' ? '#7a6a00' : '#1a5c1a';
  return `<div class="task-item ${t.done?'done':''} ${overdueClass}" style="--cat-color:${primaryCat ? primaryCat.color : 'var(--border2)'};--pri-color:${priColor}" data-id="${t.id}">
      <div class="task-row-top">
        <div class="task-check ${t.done?'checked':''}" onclick="toggleDone(${t.id})" title="${t.done?'Reabrir':'Completar'}"></div>
        <div class="task-body" onclick="openTaskDetail(${t.id})" style="cursor:pointer">
          <div class="task-text md-content">${renderMd(t.text)}</div>
          ${t.desc ? `<div class="task-desc md-content">${renderMd(t.desc)}</div>` : ''}
        </div>
        <div class="task-actions">
          <button class="act-btn edit" onclick="editTask(${t.id})" title="Editar">✎</button>
          <button class="act-btn del" onclick="deleteTask(${t.id})" title="Eliminar">✕</button>
        </div>
      </div>
      <div class="task-meta">
        ${catTag}
        ${getProjectBadge(t)}
        ${getSubtaskParentBadge(t)}
        ${getPriLabel(t.pri)}
        ${getDueBadge(t)}
        ${getRepeatBadge(t)}
        ${getSubtaskBadge(t)}
        <span class="task-time">${formatCreatedTime(t)}</span>
      </div>
    </div>`;
}

let _toastUndo = null;
function dismissToast() {
  const el = document.getElementById('toast');
  el.classList.remove('show');
  el.style.transform = '';
  el.style.opacity = '';
  el.style.transition = '';
  _toastUndo = null;
  clearTimeout(toastTimer);
}

function showToast(msg, opts) {
  const el = document.getElementById('toast');
  _toastUndo = null;
  const closeBtn = `<button class="toast-close" id="toast-close-btn" title="Cerrar">✕</button>`;
  if (opts && opts.undo) {
    el.innerHTML = `<span class="toast-msg">${escHtml(msg)}</span><button class="toast-undo" id="toast-undo-btn">Deshacer</button>${closeBtn}`;
    _toastUndo = opts.onUndo;
    document.getElementById('toast-undo-btn').addEventListener('click', () => {
      if (_toastUndo) { _toastUndo(); _toastUndo = null; }
      dismissToast();
    });
  } else {
    el.innerHTML = `<span class="toast-msg">${escHtml(msg)}</span>${closeBtn}`;
  }
  document.getElementById('toast-close-btn').addEventListener('click', dismissToast);
  el.classList.add('show');
  el.style.transform = '';
  el.style.opacity = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(dismissToast, 6000);
}

// ── Actualización en vivo al cambio de minuto ──
function lerpColor(r1,g1,b1, r2,g2,b2, t) {
  const r = Math.round(r1 + (r2-r1)*t);
  const g = Math.round(g1 + (g2-g1)*t);
  const b = Math.round(b1 + (b2-b1)*t);
  return `rgb(${r},${g},${b})`;
}

function updateDayRing() {
  const now = new Date();
  const secondsElapsed = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const pct = Math.round(secondsElapsed / 864);
  const t = pct / 100;
  const circ = 163;
  // 0% → neutral sepia · 100% → rojo
  const color = lerpColor(100,80,50, 139,26,26, t);
  const fill = document.getElementById('day-fill');
  const label = document.getElementById('day-pct');
  fill.style.strokeDashoffset = circ - (circ * pct / 100);
  fill.style.stroke = color;
  label.style.color = color;
  document.getElementById('day-pct').textContent = pct + '%';
}

function scheduleMinuteTick() {
  const now = new Date();
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  setTimeout(() => {
    render();
    updateDayRing();
    updateDateLabel();
    scheduleMinuteTick();
  }, msToNextMinute);
}

const PRIORITY_ORDER = ['high', 'mid', 'low', 'all'];

function setPriorityFilter(nextPri, swipeDelta = 0) {
  if (!PRIORITY_ORDER.includes(nextPri)) return;
  if (priFilter === nextPri) return;
  priFilter = nextPri;

  document.querySelectorAll('.pri-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pri === nextPri);
  });

  const priTabs = document.querySelector('.pri-tabs');
  if (priTabs && swipeDelta) {
    priTabs.classList.remove('pri-swipe-left', 'pri-swipe-right');
    // Reinicia la animación si el usuario hace swipes seguidos.
    void priTabs.offsetWidth;
    priTabs.classList.add(swipeDelta < 0 ? 'pri-swipe-left' : 'pri-swipe-right');
    setTimeout(() => priTabs.classList.remove('pri-swipe-left', 'pri-swipe-right'), 260);
  }

  render();
}

function cyclePriorityBySwipe(swipeDelta) {
  const step = swipeDelta < 0 ? 1 : -1;
  const idx = PRIORITY_ORDER.indexOf(priFilter);
  const nextIdx = (idx + step + PRIORITY_ORDER.length) % PRIORITY_ORDER.length;
  setPriorityFilter(PRIORITY_ORDER[nextIdx], swipeDelta);
}

function isOverlayBlockingPrioritySwipe() {
  return !!document.querySelector([
    '.detail-overlay.open',
    '.form-overlay.open',
    '.settings-overlay.open',
    '.projects-overlay.open',
    '.stats-overlay.open',
    '.day-progress-overlay.open',
    '.snooze-detail-overlay.open'
  ].join(','));
}

function isInteractivePrioritySwipeTarget(target) {
  if (!target || !(target instanceof Element)) return true;
  return !!target.closest([
    'button',
    'input',
    'textarea',
    'select',
    'a',
    '[role="button"]',
    '.task-item',
    '.task-actions',
    '.task-check',
    '.task-body',
    '.filters-wrapper',
    '.scope-wrapper',
    '.pri-tabs',
    '.nav-fab-wrap',
    '.cat-multi-wrap',
    '.ring-wrap'
  ].join(','));
}

function initPrioritySwipe() {
  const appEl = document.querySelector('.app');
  if (!appEl) return;

  let tracking = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let horizontalLocked = false;

  const reset = () => {
    if (pointerId !== null && appEl.hasPointerCapture && appEl.hasPointerCapture(pointerId)) {
      appEl.releasePointerCapture(pointerId);
    }
    tracking = false;
    pointerId = null;
    horizontalLocked = false;
  };

  appEl.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    if (isOverlayBlockingPrioritySwipe()) return;
    if (isInteractivePrioritySwipeTarget(e.target)) return;
    tracking = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    horizontalLocked = false;
  });

  appEl.addEventListener('pointermove', e => {
    if (!tracking || e.pointerId !== pointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!horizontalLocked) {
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.15) {
        reset();
        return;
      }
      horizontalLocked = true;
      appEl.setPointerCapture?.(pointerId);
    }

    if (e.cancelable) e.preventDefault();
    if (Math.abs(dx) >= 70) {
      cyclePriorityBySwipe(dx);
      reset();
    }
  }, { passive: false });

  appEl.addEventListener('pointerup', reset);
  appEl.addEventListener('pointercancel', reset);
}

function triggerSearchRender(immediate = false) {
  if (_searchDebounceTimer) {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = null;
  }
  if (immediate) {
    render();
    return;
  }
  _searchDebounceTimer = setTimeout(() => {
    _searchDebounceTimer = null;
    render();
  }, SEARCH_DEBOUNCE_MS);
}

// ── Inicialización async ──
(async function init() {
  await dbInit();
  await loadTasks();
  await loadCustomCats();
  await loadProjects();
  initDatePicker();
  rebuildCatSelect();
  rebuildProjectSelect();
  rebuildFilterButtons();
  render();
  updateDayRing();
  scheduleMinuteTick();
  document.getElementById('loader').classList.add('hidden');

  // ── Toast swipe-to-dismiss ──
  (function initToastSwipe() {
    const el = document.getElementById('toast');
    let startX = 0, dragX = 0, dragging = false;
    const THRESHOLD = 80;

    function snapBack() {
      dragging = false;
      el.style.transition = '';
      // rAF ensures transition is active before resetting transform
      requestAnimationFrame(() => {
        el.style.transform = '';
        el.style.opacity = '';
      });
    }

    el.addEventListener('touchstart', e => {
      if (!el.classList.contains('show')) return;
      startX = e.touches[0].clientX;
      dragX = 0;
      dragging = true;
      el.style.transition = 'none';
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if (!dragging) return;
      dragX = e.touches[0].clientX - startX;
      el.style.transform = `translateX(calc(-50% + ${dragX}px))`;
      el.style.opacity = String(Math.max(0, 1 - Math.abs(dragX) / 160));
    }, { passive: true });

    el.addEventListener('touchend', () => {
      if (!dragging) return;
      if (Math.abs(dragX) >= THRESHOLD) {
        dragging = false;
        // Animate off-screen in the drag direction, then dismiss
        const dir = dragX > 0 ? 1 : -1;
        el.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
        el.style.transform = `translateX(calc(-50% + ${dir * 110}vw))`;
        el.style.opacity = '0';
        setTimeout(dismissToast, 240);
      } else {
        snapBack();
      }
    });

    // Cancel (browser scroll hijack, notification, etc.) — always snap back
    el.addEventListener('touchcancel', snapBack);
  })();

  // Filtro 1: Prioridad (pestañas)
  document.querySelectorAll('.pri-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setPriorityFilter(btn.dataset.pri);
    });
  });
  initPrioritySwipe();

  // Búsqueda global de tareas
  const searchInput = document.getElementById('task-search-input');
  const searchClear = document.getElementById('task-search-clear');
  const syncSearchUi = () => {
    if (!searchClear) return;
    searchClear.classList.toggle('visible', !!searchQuery);
  };
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim();
      _searchRenderLimit = SEARCH_RENDER_STEP;
      syncSearchUi();
      triggerSearchRender();
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape' && searchQuery) {
        searchQuery = '';
        searchInput.value = '';
        _searchRenderLimit = SEARCH_RENDER_STEP;
        syncSearchUi();
        triggerSearchRender(true);
      }
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      _searchRenderLimit = SEARCH_RENDER_STEP;
      syncSearchUi();
      triggerSearchRender(true);
      searchInput?.focus();
    });
  }

  // Filtro 2: Fecha (scope)
  document.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dateScope = btn.dataset.scope;
      document.getElementById('scope-toggle-label').textContent = btn.textContent.trim();
      render();
    });
  });

  // Toggle panel de scope
  const scopeToggle = document.getElementById('scope-toggle');
  const scopePanel  = document.getElementById('scope-panel');
  scopeToggle.addEventListener('click', () => {
    const open = scopePanel.classList.toggle('open');
    scopeToggle.setAttribute('aria-expanded', String(open));
  });

  rebuildFilterButtons();

  // ── Modal de progreso del día ──
  const dayProgressOverlay = document.getElementById('day-progress-overlay');
  const dayProgressClose   = document.getElementById('day-progress-close');
  const dayProgressBody    = document.getElementById('day-progress-body');

  function formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Ahora';
    if (seconds < 60) return `${seconds} segundos`;
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes} minutos y ${remainingSeconds} segundos` : `${minutes} minutos`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      let parts = [];
      if (hours > 0) parts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
      if (minutes > 0) parts.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`);
      if (remainingSeconds > 0) parts.push(`${remainingSeconds} segundo${remainingSeconds > 1 ? 's' : ''}`);
      return parts.join(', ');
    }
    return 'Más de un día';
  }

  function updateDayProgressModal() {
    if (!dayProgressOverlay.classList.contains('open')) return;
    const now = new Date();
    const totalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const currentPct = Math.round(totalSeconds / 864);
    let nextTimeStr, timeToNextChange, nextPctValue;
    if (currentPct >= 100) {
      nextTimeStr = 'Día completo';
      timeToNextChange = 0;
      nextPctValue = 100;
    } else {
      const nextPct = currentPct + 1;
      const secondsForNextPct = nextPct * 864;
      timeToNextChange = secondsForNextPct - totalSeconds;
      const nextTime = new Date(now.getTime() + timeToNextChange * 1000);
      nextTimeStr = nextTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      nextPctValue = nextPct;
    }

    // Calcular countdown para hora objetivo
    let targetCountdown = '00:00:00';
    let targetMessage = 'Selecciona una hora objetivo.';
    if (targetTime) {
      const [targetHours, targetMinutes] = targetTime.split(':').map(Number);
      const targetDate = new Date();
      targetDate.setHours(targetHours, targetMinutes, 0, 0);
      const diff = targetDate - now;
      if (diff <= 0) {
        targetCountdown = '00:00:00';
        targetMessage = 'Esa hora ya ha pasado hoy.';
      } else {
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const formattedHours = String(hours).padStart(2, '0');
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(seconds).padStart(2, '0');
        targetCountdown = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
        targetMessage = 'Tiempo hasta tu objetivo.';
      }
    }

    // Actualizar elementos específicos (de forma segura, si existen)
    const elCur = document.getElementById('day-progress-current-pct');
    if (elCur) elCur.textContent = `${currentPct}%`;
    const elNextTime = document.getElementById('day-progress-next-time');
    if (elNextTime) elNextTime.textContent = `Próximo cambio: ${nextTimeStr}`;
    const elNextRem = document.getElementById('day-progress-next-remaining');
    if (elNextRem) elNextRem.textContent = `En ${formatTimeRemaining(timeToNextChange)}`;
    const elNextPct = document.getElementById('day-progress-next-pct');
    if (elNextPct) elNextPct.textContent = `Nuevo porcentaje: ${nextPctValue}%`;
    const elTargetCount = document.getElementById('day-progress-target-countdown');
    if (elTargetCount) elTargetCount.textContent = targetCountdown;
    const elTargetMsg = document.getElementById('day-progress-target-message');
    if (elTargetMsg) elTargetMsg.textContent = targetMessage;
  }

  function openDayProgressModal() {
    const now = new Date();
    const totalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const currentPct = Math.round(totalSeconds / 864);
    let nextTimeStr, timeToNextChange, nextPctValue;
    if (currentPct >= 100) {
      nextTimeStr = 'Día completo';
      timeToNextChange = 0;
      nextPctValue = 100;
    } else {
      const nextPct = currentPct + 1;
      const secondsForNextPct = nextPct * 864;
      timeToNextChange = secondsForNextPct - totalSeconds;
      const nextTime = new Date(now.getTime() + timeToNextChange * 1000);
      nextTimeStr = nextTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      nextPctValue = nextPct;
    }

    // Renderizar estructura fija (con IDs) una sola vez para evitar destruir el input
    dayProgressBody.innerHTML = `
      <div class="day-progress-current">
        <div class="day-progress-pct" id="day-progress-current-pct">${currentPct}%</div>
        <div class="day-progress-label">del día transcurrido</div>
      </div>
      <div class="day-progress-next">
        <div class="day-progress-next-time" id="day-progress-next-time">Próximo cambio: ${nextTimeStr}</div>
        <div class="day-progress-next-remaining" id="day-progress-next-remaining">En ${formatTimeRemaining(timeToNextChange)}</div>
        <div class="day-progress-next-pct" id="day-progress-next-pct">Nuevo porcentaje: ${nextPctValue}%</div>
      </div>
      <div class="day-progress-target">
        <div class="day-progress-target-title">Objetivo de Hoy</div>
        <div class="day-progress-target-input">
          <label for="day-target-time">Selecciona la hora:</label>
          <input type="time" id="day-target-time" value="${targetTime || ''}">
        </div>
        <div class="day-progress-target-display">
          <div class="day-progress-target-countdown" id="day-progress-target-countdown">00:00:00</div>
          <div class="day-progress-target-message" id="day-progress-target-message">Selecciona una hora objetivo.</div>
        </div>
      </div>
    `;
    dayProgressOverlay.classList.add('open');
    dayProgressOverlay.setAttribute('aria-hidden', 'false');

    // Agregar listener al input (si existe) — solo una vez por apertura
    const targetInputOnce = document.getElementById('day-target-time');
    if (targetInputOnce) {
      targetInputOnce.addEventListener('input', () => {
        targetTime = targetInputOnce.value;
        updateDayProgressModal();
      });
    }

    // Iniciar intervalo de actualización en vivo cada segundo (evitar duplicados)
    if (!dayProgressInterval) dayProgressInterval = setInterval(updateDayProgressModal, 1000);
    // Actualizar inmediatamente para mostrar todo al abrir
    updateDayProgressModal();
  }

  function closeDayProgressModal() {
    dayProgressOverlay.classList.remove('open');
    dayProgressOverlay.setAttribute('aria-hidden', 'true');
    // Limpiar intervalo de actualización en vivo
    if (dayProgressInterval) {
      clearInterval(dayProgressInterval);
      dayProgressInterval = null;
    }
  }

  // Event listener en el anillo del día
  document.querySelector('.progress-ring').addEventListener('click', openDayProgressModal); // El primer .progress-ring
  dayProgressClose.addEventListener('click', closeDayProgressModal);
  dayProgressOverlay.addEventListener('click', e => { if (e.target === dayProgressOverlay) closeDayProgressModal(); });

  // Toggle panel de filtros
  const filtersToggle = document.getElementById('filters-toggle');
  const filtersPanel  = document.getElementById('filters-panel');
  filtersToggle.addEventListener('click', () => {
    const open = filtersPanel.classList.toggle('open');
    filtersToggle.setAttribute('aria-expanded', String(open));
  });

  // Anillo de día: interval independiente para actualización en vivo
  setInterval(updateDayRing, 1000);

  // Tooltips en tactil
  document.querySelectorAll('.progress-ring[data-tip]').forEach(el => {
    el.addEventListener('touchstart', () => {
      el.classList.add('tip-active');
      setTimeout(() => el.classList.remove('tip-active'), 2200);
    }, { passive: true });
  });

  initSettings();
  initProjects();
  initStats();

  // Verificar si hay un backup más reciente en la nube
  syncOnLoad();
})();

// ══════════════════════════════════════════
// TASK DETAIL MODAL + SUBTASKS
// ══════════════════════════════════════════
function renderSubsGroupedByDoneAt(subs) {
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const groups = new Map();
  for (const s of subs) {
    const key = s.doneAt || '__unknown__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === '__unknown__') return 1;
    if (b === '__unknown__') return -1;
    return a > b ? -1 : a < b ? 1 : 0;
  });
  return sortedKeys.map(key => {
    const items = groups.get(key);
    let label;
    if (key === '__unknown__') label = 'Fecha desconocida';
    else if (key === today) label = 'Hoy · ' + formatDateNice(key);
    else if (key === yesterday) label = 'Ayer · ' + formatDateNice(key);
    else label = formatDateNice(key);
    const count = items.length === 1 ? '1 subtarea' : `${items.length} subtareas`;
    return `<div class="task-group">
      <div class="task-group-header">
        <span class="task-group-label">${label}</span>
        <span class="task-group-line"></span>
        <span class="task-group-count">${count}</span>
      </div>
      <div class="detail-subtasks-list">${items.map(s => renderSubtaskItem(s)).join('')}</div>
    </div>`;
  }).join('');
}

const detailOverlay = document.getElementById('detail-overlay');
const detailPanel   = document.getElementById('detail-panel');
const detailBody    = document.getElementById('detail-body');
const detailBack    = document.getElementById('detail-back');
const detailCloseBtn= document.getElementById('detail-close');
const detailHandle  = document.getElementById('detail-handle');

function openTaskDetail(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  subtaskFilter = 'pending';
  detailStack.push(id);
  renderDetailBody(id);
  detailPanel.style.transform = '';
  detailPanel.style.transition = '';
  detailOverlay.style.background = '';
  detailOverlay.classList.add('open');
  detailOverlay.setAttribute('aria-hidden', 'false');
  updateDetailBackBtn();
}

function closeTaskDetail() {
  detailStack = [];
  detailPanel.style.transform = '';
  detailPanel.style.transition = '';
  detailOverlay.style.background = '';
  detailOverlay.classList.remove('open');
  detailOverlay.setAttribute('aria-hidden', 'true');
}

function goBackDetail() {
  if (detailStack.length > 1) {
    subtaskFilter = 'pending';
    detailStack.pop();
    renderDetailBody(detailStack[detailStack.length - 1]);
    updateDetailBackBtn();
  } else {
    closeTaskDetail();
  }
}

function updateDetailBackBtn() {
  detailBack.style.visibility = detailStack.length > 1 ? 'visible' : 'hidden';
}

function handleDetailAfterCompletion(taskId) {
  if (!detailStack.length) return false;
  const topId = detailStack[detailStack.length - 1];
  if (topId !== taskId) return false;

  const completed = tasks.find(t => t.id === taskId);
  if (!completed || !completed.done) return false;

  // Si es subtarea, volver al modal del padre en lugar de cerrar todo.
  if (completed.parentId) {
    const parentId = completed.parentId;
    const parentExists = tasks.some(t => t.id === parentId);
    if (parentExists) {
      const parentIdx = detailStack.lastIndexOf(parentId);
      detailStack = parentIdx >= 0 ? detailStack.slice(0, parentIdx + 1) : [parentId];
      subtaskFilter = 'pending';
      renderDetailBody(parentId);
      updateDetailBackBtn();
      return true;
    }
  }

  closeTaskDetail();
  return true;
}

function initDetailDrag() {
  if (!detailPanel || !detailHandle) return;
  let startY = 0, deltaY = 0, dragging = false;
  const THRESHOLD = 90;

  const resetOverlay = () => {
    detailOverlay.style.background = 'rgba(26,16,8,0.55)';
  };

  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    detailPanel.style.transition = 'transform 0.24s ease';
    if (deltaY >= THRESHOLD) {
      detailPanel.style.transform = 'translateY(110vh)';
      detailOverlay.style.transition = 'background 0.24s ease';
      detailOverlay.style.background = 'rgba(26,16,8,0)';
      setTimeout(closeTaskDetail, 240);
    } else {
      detailPanel.style.transform = '';
      resetOverlay();
    }
  };

  detailHandle.addEventListener('pointerdown', e => {
    if (!detailOverlay.classList.contains('open') || e.button !== 0) return;
    if (e.cancelable) e.preventDefault();
    detailHandle.setPointerCapture(e.pointerId);
    startY = e.clientY;
    deltaY = 0;
    dragging = true;
    detailPanel.style.transition = 'none';
  });

  detailHandle.addEventListener('pointermove', e => {
    if (!dragging) return;
    deltaY = e.clientY - startY;
    if (deltaY < 0) return;
    e.preventDefault();
    detailPanel.style.transform = `translateY(${deltaY}px)`;
    detailOverlay.style.background = `rgba(26,16,8,${Math.max(0, 0.55 - deltaY / 450)})`;
  });

  detailHandle.addEventListener('pointerup', finishDrag);
  detailHandle.addEventListener('pointercancel', finishDrag);

  // Fallback táctil: evita pull-to-refresh cuando se usa el handle como cortina.
  detailHandle.addEventListener('touchstart', e => {
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  detailHandle.addEventListener('touchmove', e => {
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
}

initDetailDrag();

function renderDetailBody(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) { detailBody.innerHTML = '<p class="detail-no-subtasks">Tarea no encontrada</p>'; return; }
  const taskCats = getTaskCats(t);
  const catTag = taskCats.map(key => {
    const c = CATS[key] || CATS.otro;
    return `<span class="tag"><span class="tag-dot" style="background:${c.color}"></span>${c.label}</span>`;
  }).join('');
  const subs = getSubtasks(id);
  const displaySubs = subtaskFilter === 'pending' ? subs.filter(s => !s.done)
    : subtaskFilter === 'done' ? subs.filter(s => s.done)
    : subs;
  const emptyMsg = subtaskFilter === 'pending' ? 'Sin subtareas pendientes'
    : subtaskFilter === 'done' ? 'Sin subtareas completadas'
    : 'Sin subtareas aún';
  const sfTab = v => `<button class="subtask-filter-tab${subtaskFilter === v ? ' active' : ''}" data-sf="${v}">${v === 'pending' ? 'Pendientes' : v === 'done' ? 'Completadas' : 'Todo'}</button>`;

  detailBody.innerHTML = `
    <div class="detail-title ${t.done ? 'done-title' : ''}">${renderMd(t.text)}</div>
    ${t.desc ? `<div class="detail-desc md-content">${renderMd(t.desc)}</div>` : ''}
    <div class="detail-meta">
      ${catTag}
      ${getProjectBadge(t)}
      ${getPriLabel(t.pri)}
      ${getDueBadge(t)}
      ${getRepeatBadge(t)}
      <span class="task-time">${formatCreatedTime(t)}</span>
    </div>
    <div class="detail-actions-row">
      <button class="detail-action-btn" id="detail-add-subtask"><span class="btn-icon">＋</span> Añadir subtarea</button>
      <button class="detail-action-btn" id="detail-breakdown-ai"><span class="btn-icon" style="color:var(--gold);">✨</span> Desglosar con IA</button>
      <button class="detail-action-btn" id="detail-edit-task"><span class="btn-icon">✎</span> Editar</button>
      ${t.repeat ? `<button class="detail-action-btn" id="detail-snooze"><span class="btn-icon">⏰</span> Posponer</button>` : ''}
      <button class="detail-action-btn" id="detail-toggle-done"><span class="btn-icon">${t.done ? '↩' : '✓'}</span> ${t.done ? 'Reabrir' : 'Completar'}</button>
    </div>
    <div>
      <div class="detail-subtasks-header">
        <span class="detail-subtasks-label">Subtareas (${subs.filter(s => s.done).length}/${subs.length})</span>
        ${subs.length ? `<div class="subtask-filter-tabs">${sfTab('pending')}${sfTab('done')}${sfTab('all')}</div>` : ''}
      </div>
      ${displaySubs.length
        ? (subtaskFilter === 'done'
            ? renderSubsGroupedByDoneAt(displaySubs)
            : `<div class="detail-subtasks-list">${displaySubs.map(s => renderSubtaskItem(s)).join('')}</div>`)
        : `<div class="detail-no-subtasks">${emptyMsg}</div>`}
    </div>
  `;

  // Wire action buttons
  document.getElementById('detail-add-subtask').addEventListener('click', () => {
    subtaskParentId = id;
    document.querySelector('.form-modal-title').textContent = 'Nueva subtarea';
    // Inherit cat, pri, project from the nearest parent task
    const parent = tasks.find(t => t.id === id);
    if (parent) {
      setCatSelectValues(getTaskCats(parent));
      document.getElementById('sel-pri').value = parent.pri || 'high';
      setProjSelectValue(parent.project || '');
    }
    openForm();
  });
  
  const btnBreakdown = document.getElementById('detail-breakdown-ai');
  if (btnBreakdown) {
    btnBreakdown.addEventListener('click', async () => {
      await handleAIBreakdown(id, btnBreakdown);
    });
  }
  document.getElementById('detail-edit-task').addEventListener('click', () => {
    editTask(id);
  });
  document.getElementById('detail-toggle-done').addEventListener('click', async () => {
    const wasDone = !!t.done;
    await toggleDone(id);
    if (!wasDone && handleDetailAfterCompletion(id)) {
      return;
    }
    if (detailStack.length) renderDetailBody(detailStack[detailStack.length - 1]);
  });

  // Wire snooze for recurring tasks
  const snoozeBtn = document.getElementById('detail-snooze');
  if (snoozeBtn) {
    snoozeBtn.addEventListener('click', async () => {
      const task = tasks.find(tt => tt.id === id);
      if (!task) return;
      if (!task.repeat) { showToast('No es una tarea recurrente'); return; }
      const oldDue = task.due || '';
      const oldDueTime = task.dueTime || '';
      const next = addRepeat(task.due || todayISO(), task.dueTime || '', task.repeat);
      task.due = next.due;
      task.dueTime = next.dueTime || '';
      task.snoozedDates = task.snoozedDates || [];
      task.snoozedDates.push(todayISO());
      await dbPut(task);
      markDirty();
      render();
      renderDetailBody(id);
      showToast(`⏰ Pospuesta para ${formatDateNice(next.due)}`, {
        undo: true,
        onUndo: async () => {
          task.due = oldDue;
          task.dueTime = oldDueTime;
          if (task.snoozedDates && task.snoozedDates.length > 0) {
            task.snoozedDates.pop();
          }
          await dbPut(task);
          markDirty();
          render();
          renderDetailBody(id);
        }
      });
    });
  }

  // Wire subtask filter tabs
  detailBody.querySelectorAll('[data-sf]').forEach(btn => {
    btn.addEventListener('click', () => {
      subtaskFilter = btn.dataset.sf;
      renderDetailBody(id);
    });
  });

  // Wire subtask click → open detail (recursive)
  detailBody.querySelectorAll('[data-subtask-open]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-subtask-toggle]') || e.target.closest('[data-subtask-del]')) return;
      openTaskDetail(Number(el.dataset.subtaskOpen));
    });
  });
  // Wire subtask check toggles
  detailBody.querySelectorAll('[data-subtask-toggle]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleDone(Number(btn.dataset.subtaskToggle));
      if (detailStack.length) renderDetailBody(detailStack[detailStack.length - 1]);
    });
  });
  // Wire subtask delete
  detailBody.querySelectorAll('[data-subtask-del]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteTask(Number(btn.dataset.subtaskDel));
    });
  });
  // Wire subtask edit
  detailBody.querySelectorAll('[data-subtask-edit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editTask(Number(btn.dataset.subtaskEdit));
    });
  });
}

function renderSubtaskItem(t) {
  const taskCats = getTaskCats(t);
  const primaryCat = taskCats.length ? (CATS[taskCats[0]] || null) : null;
  const extraCount = taskCats.length - 1;
  const catTag = primaryCat
    ? `<span class="tag"><span class="tag-dot" style="background:${primaryCat.color}"></span>${primaryCat.label}${extraCount > 0 ? `<span class="tag-extra">+${extraCount}</span>` : ''}</span>`
    : '';
  const priColor = t.pri === 'high' ? '#8b1a1a' : t.pri === 'mid' ? '#7a6a00' : '#1a5c1a';
  const overdueClass = isTaskOverdue(t) ? 'overdue' : '';
  const subCount = getSubtasks(t.id);
  const subBadge = subCount.length ? `<span class="subtask-badge">☐ ${subCount.filter(s=>s.done).length}/${subCount.length}</span>` : '';
  return `<div class="task-item ${t.done?'done':''} ${overdueClass}" style="--cat-color:${primaryCat ? primaryCat.color : 'var(--border2)'};--pri-color:${priColor}" data-subtask-open="${t.id}">
    <div class="task-row-top">
      <div class="task-check ${t.done?'checked':''}" data-subtask-toggle="${t.id}" title="${t.done?'Reabrir':'Completar'}"></div>
      <div class="task-body" style="cursor:pointer">
        <div class="task-text md-content">${renderMd(t.text)}</div>
        ${t.desc ? `<div class="task-desc md-content">${renderMd(t.desc)}</div>` : ''}
      </div>
      <div class="task-actions">
        <button class="act-btn edit" data-subtask-edit="${t.id}" title="Editar">✎</button>
        <button class="act-btn del" data-subtask-del="${t.id}" title="Eliminar">✕</button>
      </div>
    </div>
    <div class="task-meta">
      ${catTag}
      ${getProjectBadge(t)}
      ${getPriLabel(t.pri)}
      ${getDueBadge(t)}
      ${getRepeatBadge(t)}
      ${subBadge}
      <span class="task-time">${formatCreatedTime(t)}</span>
    </div>
  </div>`;
}

detailCloseBtn.addEventListener('click', closeTaskDetail);
detailBack.addEventListener('click', goBackDetail);
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) closeTaskDetail(); });

// ── FAB nav + modal ──
const fab         = document.getElementById('fab-add');
const navMenu     = document.getElementById('nav-fab-menu');
const formOverlay = document.getElementById('form-overlay');
const formClose   = document.getElementById('form-close');

let navOpen = false;

function openNav() {
  navOpen = true;
  navMenu.classList.add('open');
  navMenu.setAttribute('aria-hidden', 'false');
  fab.classList.add('active');
  fab.setAttribute('aria-expanded', 'true');
  // Backdrop to close on outside click
  const bd = document.createElement('div');
  bd.className = 'nav-fab-backdrop';
  bd.id = 'nav-fab-backdrop';
  bd.addEventListener('click', closeNav);
  document.body.appendChild(bd);
}

function closeNav() {
  navOpen = false;
  navMenu.classList.remove('open');
  navMenu.setAttribute('aria-hidden', 'true');
  fab.classList.remove('active');
  fab.setAttribute('aria-expanded', 'false');
  const bd = document.getElementById('nav-fab-backdrop');
  if (bd) bd.remove();
}

function openForm() {
  initDatePicker();
  initTimePicker();
  formOverlay.classList.toggle('above-detail', detailStack.length > 0);
  formOverlay.classList.add('open');
  setTimeout(() => document.getElementById('new-task').focus(), 200);
}
function closeForm() {
  formOverlay.classList.remove('open', 'above-detail', 'above-projects');
  editingId = null;
  subtaskParentId = null;
  document.getElementById('new-task').value = '';
  document.getElementById('new-desc').value = '';
  document.getElementById('sel-due').value = '';
  document.getElementById('sel-time').value = '';
  document.getElementById('sel-repeat-n').value = '';
  document.getElementById('sel-repeat-unit').value = '';
  document.querySelectorAll('#repeat-days-picker .day-btn').forEach(b => b.classList.remove('active'));
  setCatSelectValues([]);
  setProjSelectValue('');
  syncRepeatN();
  document.querySelector('.form-modal-title').textContent = 'Nueva tarea';
  document.querySelector('.btn-add').textContent = 'Agregar';
}

function editTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('new-task').value = t.text;
  document.getElementById('new-desc').value = t.desc || '';
  setCatSelectValues(getTaskCats(t));
  document.getElementById('sel-pri').value = t.pri;
  document.getElementById('sel-due').value = t.due || '';
  document.getElementById('sel-time').value = t.dueTime || '';
  setProjSelectValue(t.project || '');
  if (t.repeat) {
    const repStr = String(t.repeat);
    if (repStr.startsWith('dw:')) {
      document.getElementById('sel-repeat-unit').value = 'dw';
      const activeDays = repStr.slice(3).split(',').map(s => s.trim());
      document.querySelectorAll('#repeat-days-picker .day-btn').forEach(b => {
        b.classList.toggle('active', activeDays.includes(b.dataset.day));
      });
    } else {
      const parts = repStr.includes(':') ? repStr.split(':') : [repStr, 'd'];
      document.getElementById('sel-repeat-n').value = parts[0];
      document.getElementById('sel-repeat-unit').value = parts[1];
    }
  } else {
    document.getElementById('sel-repeat-n').value = '';
    document.getElementById('sel-repeat-unit').value = '';
    document.querySelectorAll('#repeat-days-picker .day-btn').forEach(b => b.classList.remove('active'));
  }
  syncRepeatN();
  document.querySelector('.form-modal-title').textContent = 'Editar tarea';
  document.querySelector('.btn-add').textContent = 'Guardar';
  initDatePicker();
  formOverlay.classList.toggle('above-detail', detailStack.length > 0);
  formOverlay.classList.add('open');
  setTimeout(() => document.getElementById('new-task').focus(), 200);
}

fab.addEventListener('click', () => {
  navOpen ? closeNav() : openNav();
});

// Ítem: Nueva nota → abre el formulario de tarea
document.getElementById('nav-nueva-nota').addEventListener('click', () => {
  closeNav();
  openForm();
});

// Ítems futuros (placeholder)
document.querySelectorAll('.nav-fab-item[data-nav]').forEach(btn => {
  if (btn.dataset.nav === 'nueva-nota') return;
  if (btn.dataset.nav === 'ajustes') return; // wired below
  if (btn.dataset.nav === 'proyectos') return; // wired in initProjects
  if (btn.dataset.nav === 'estadistica') return; // wired in initStats
  btn.addEventListener('click', () => {
    closeNav();
    // TODO: implementar sección correspondiente
  });
});
function syncRepeatN() {
  const n = document.getElementById('sel-repeat-n');
  const unit = document.getElementById('sel-repeat-unit').value;
  const isDw = unit === 'dw';
  const hasUnit = !!unit;
  const picker = document.getElementById('repeat-days-picker');

  n.disabled = !hasUnit || isDw;
  if (!hasUnit || isDw) n.value = '';
  if (picker) picker.classList.toggle('hidden', !isDw);
}
document.getElementById('sel-repeat-unit').addEventListener('change', syncRepeatN);
syncRepeatN();

// ── Day-picker toggle ──
const repeatDaysPicker = document.getElementById('repeat-days-picker');
if (repeatDaysPicker) {
  repeatDaysPicker.addEventListener('click', e => {
    const btn = e.target.closest('.day-btn');
    if (btn) btn.classList.toggle('active');
  });
}

formClose.addEventListener('click', closeForm);
formOverlay.addEventListener('click', e => { if (e.target === formOverlay) closeForm(); });
// Cat multi-select toggle
document.getElementById('cat-multi-trigger').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('cat-multi-dropdown').classList.toggle('open');
});
document.getElementById('proj-select-trigger').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('proj-select-dropdown').classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!e.target.closest('#cat-multi-wrap')) {
    const dd = document.getElementById('cat-multi-dropdown');
    if (dd) dd.classList.remove('open');
  }
  if (!e.target.closest('#proj-select-wrap')) {
    const dd = document.getElementById('proj-select-dropdown');
    if (dd) dd.classList.remove('open');
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeForm(); closeTaskDetail(); if (typeof closeSettings === 'function') closeSettings(); if (typeof closeProjects === 'function') closeProjects(); if (typeof closeStats === 'function') closeStats(); } });

// ══════════════════════════════════════════
// SETTINGS  (inicializado desde initSettings() dentro de init())
// ══════════════════════════════════════════
let settingsOverlay = null;
let catForm = null, addCatBtn = null, catCancel = null;
let catSaveBtn = null, catNameIn = null, catIconIn = null;
let paletteEl = null, emojiGrid = null;
let selectedColor = CAT_PALETTE[0].hex;
let selectedEmoji = '📁';
let editingCatKey = null;

async function openSettings() {
  settingsOverlay.classList.add('open');
  settingsOverlay.setAttribute('aria-hidden', 'false');
  await renderSettingsCats();
  renderStorageUsage();
}

function renderStorageUsage() {
  const valueEl  = document.getElementById('storage-usage-value');
  const fillEl   = document.getElementById('storage-usage-fill');
  const detailEl = document.getElementById('storage-usage-detail');
  if (!valueEl) return;

  const fmt = bytes => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Estimate: serialize each store to JSON
  const tasksBytes = new TextEncoder().encode(JSON.stringify(tasks)).length;
  const catsBytes  = new TextEncoder().encode(JSON.stringify(
    Object.entries(CATS).filter(([k]) => !(['trabajo','personal','salud','otro'].includes(k)))
  )).length;
  const projBytes  = new TextEncoder().encode(JSON.stringify(PROJECTS)).length;
  const total = tasksBytes + catsBytes + projBytes;

  // IndexedDB quota hint (if available)
  const QUOTA_ESTIMATE = 5 * 1024 * 1024; // 5 MB conservative reference
  const pct = Math.min(Math.round(total / QUOTA_ESTIMATE * 100), 100);

  valueEl.textContent = fmt(total);
  fillEl.style.width = pct + '%';
  fillEl.style.background = pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--gold2)' : 'var(--gold)';
  detailEl.innerHTML =
    `<span>Tareas: ${fmt(tasksBytes)}</span>` +
    `<span>Proyectos: ${fmt(projBytes)}</span>` +
    `<span>Categorías: ${fmt(catsBytes)}</span>` +
    `<span>${tasks.length} tarea${tasks.length !== 1 ? 's' : ''}</span>`;

  // Use Storage API for real quota if supported
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(({ usage, quota }) => {
      if (!usage || !quota) return;
      const pctReal = Math.min(Math.round(usage / quota * 100), 100);
      valueEl.textContent = fmt(usage) + ' de ' + fmt(quota);
      fillEl.style.width = pctReal + '%';
      fillEl.style.background = pctReal > 80 ? 'var(--red)' : pctReal > 50 ? 'var(--gold2)' : 'var(--gold)';
    }).catch(() => {});
  }
}
function closeSettings() {
  if (!settingsOverlay) return;
  settingsOverlay.classList.remove('open');
  settingsOverlay.setAttribute('aria-hidden', 'true');
  hideCatForm();
}

async function initSettings() {
  settingsOverlay = document.getElementById('settings-overlay');
  catForm    = document.getElementById('settings-cat-form');
  addCatBtn  = document.getElementById('settings-add-cat-btn');
  catCancel  = document.getElementById('cat-cancel');
  catSaveBtn = document.getElementById('cat-save');
  catNameIn  = document.getElementById('cat-name');
  catIconIn  = document.getElementById('cat-icon');
  paletteEl  = document.getElementById('settings-palette');
  emojiGrid  = document.getElementById('settings-emoji-grid');

  if (!settingsOverlay) { console.warn('Settings overlay not found'); return; }

  // ── Drag-and-drop de respaldo sobre el panel de ajustes ──
  const dropOverlay = document.getElementById('settings-drop-overlay');
  let _dragCounter = 0;
  settingsOverlay.addEventListener('dragenter', e => {
    if (!settingsOverlay.classList.contains('open')) return;
    const hasFile = e.dataTransfer && [...e.dataTransfer.items].some(i => i.kind === 'file');
    if (!hasFile) return;
    e.preventDefault();
    _dragCounter++;
    dropOverlay.classList.add('active');
  });
  settingsOverlay.addEventListener('dragleave', e => {
    _dragCounter--;
    if (_dragCounter <= 0) { _dragCounter = 0; dropOverlay.classList.remove('active'); }
  });
  settingsOverlay.addEventListener('dragover', e => {
    if (!settingsOverlay.classList.contains('open')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  settingsOverlay.addEventListener('drop', e => {
    e.preventDefault();
    _dragCounter = 0;
    dropOverlay.classList.remove('active');
    if (!settingsOverlay.classList.contains('open')) return;
    const file = e.dataTransfer.files[0];
    if (file) importData(file);
  });

  // Cerrar ajustes
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });

  // Nav: Ajustes
  document.querySelector('.nav-fab-item[data-nav="ajustes"]').addEventListener('click', () => {
    closeNav();
    openSettings();
  });

  // Poblar paleta de colores
  for (const col of CAT_PALETTE) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'settings-color-swatch' + (col.hex === selectedColor ? ' selected' : '');
    sw.style.background = col.hex;
    sw.title = col.name;
    sw.dataset.hex = col.hex;
    sw.addEventListener('click', () => {
      selectedColor = col.hex;
      paletteEl.querySelectorAll('.settings-color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      updateCatPreview();
    });
    paletteEl.appendChild(sw);
  }

  // Poblar grid de emojis sugeridos
  const SUGGESTED_EMOJIS = ['📁','⭐','🎯','🏋️','🎵','✈️','🍕','📷','💡','🛒',
    '🎮','🐾','🌍','💬','🔬','🎨','🏠','💼','📚','🌿','💰','👤','📌','🏅',
    '🚗','🧘','🎤','📝','🔧','💻'];
  for (const em of SUGGESTED_EMOJIS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-emoji-btn' + (em === selectedEmoji ? ' selected' : '');
    btn.textContent = em;
    btn.addEventListener('click', () => {
      selectedEmoji = em;
      catIconIn.value = em;
      emojiGrid.querySelectorAll('.settings-emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateCatPreview();
    });
    emojiGrid.appendChild(btn);
  }

  catNameIn.addEventListener('input', updateCatPreview);
  catIconIn.addEventListener('input', () => {
    const v = catIconIn.value.trim();
    if (v) {
      selectedEmoji = v;
      emojiGrid.querySelectorAll('.settings-emoji-btn').forEach(b => b.classList.remove('selected'));
    }
    updateCatPreview();
  });

  addCatBtn.addEventListener('click', () => showCatForm(null));
  catCancel.addEventListener('click', hideCatForm);

  catSaveBtn.addEventListener('click', async () => {
    const name = catNameIn.value.trim();
    if (!name) { catNameIn.focus(); return; }
    const icon = catIconIn.value.trim() || selectedEmoji;
    const key = editingCatKey || ('c_' + Date.now());
    const catRecord = { key, name, icon, color: selectedColor };
    await saveCustomCat(catRecord);
    if (editingCatKey) delete CATS[editingCatKey];
    CATS[key] = { color: selectedColor, label: icon + ' ' + name, custom: true };
    markDirty();
    hideCatForm();
    await renderSettingsCats();
    rebuildCatSelect();
    rebuildFilterButtons();
    showToast('✓ Categoría guardada');
  });

  // ── Gestión de datos ──
  document.getElementById('data-export').addEventListener('click', exportData);
  document.getElementById('data-import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importData(file);
  });

  document.getElementById('data-clear').addEventListener('click', () => {
    document.getElementById('data-clear-confirm').style.display = 'flex';
    document.getElementById('data-import-status').textContent = '';
    document.getElementById('data-import-status').className = 'settings-data-status';
  });
  document.getElementById('data-clear-cancel').addEventListener('click', () => {
    document.getElementById('data-clear-confirm').style.display = 'none';
  });
  document.getElementById('data-clear-ok').addEventListener('click', clearAllData);

  // ── Nube ──
  document.getElementById('cloud-upload').addEventListener('click', () => uploadBackup(false));
  document.getElementById('cloud-download').addEventListener('click', downloadBackupFromCloud);

  // ── Secret de backup ──
  const secretInput = document.getElementById('cloud-secret');
  const secretSave  = document.getElementById('cloud-secret-save');
  dbGetMeta('backupSecret').then(v => { if (v) { secretInput.value = '••••••••'; secretInput.dataset.saved = '1'; } });
  secretSave.addEventListener('click', async () => {
    const val = secretInput.value.trim();
    if (!val || val === '••••••••') return;
    await dbSetMeta('backupSecret', val);
    _backupSecret = val;
    secretInput.value = '••••••••';
    secretInput.dataset.saved = '1';
    showToast('✓ Clave guardada');
  });
  secretInput.addEventListener('focus', () => {
    if (secretInput.dataset.saved === '1') { secretInput.value = ''; secretInput.dataset.saved = ''; }
  });

  // ── OpenRouter API Key ──
  const orInput = document.getElementById('openrouter-key');
  const orSave  = document.getElementById('openrouter-key-save');
  dbGetMeta('openRouterKey').then(v => { if (v) { orInput.value = '••••••••'; orInput.dataset.saved = '1'; } });
  if (orSave) {
    orSave.addEventListener('click', async () => {
      const val = orInput.value.trim();
      if (!val || val === '••••••••') return;
      await dbSetMeta('openRouterKey', val);
      orInput.value = '••••••••';
      orInput.dataset.saved = '1';
      showToast('✓ Clave de IA guardada');
    });
  }
  if (orInput) {
    orInput.addEventListener('focus', () => {
      if (orInput.dataset.saved === '1') { orInput.value = ''; orInput.dataset.saved = ''; }
    });
  }

  // ── Maker / Manager categories ──
  const makerGrid = document.getElementById('maker-cats-grid');
  const makerSave = document.getElementById('maker-cats-save');
  if (makerGrid) {
    const saved = await dbGetMeta('makerCategories').catch(() => null) || [];
    makerGrid.innerHTML = Object.entries(CATS).map(([key, cat]) => {
      const active = saved.includes(key) ? 'active' : '';
      const safeIcon = Array.from(cat.label.trim())[0] || '';
      const safeName = cat.label.trim().substring(safeIcon.length).trim();
      return `<button type="button" class="maker-cat-btn ${active}" data-key="${key}"
        style="--cat-color:${cat.color}" title="${cat.label}">
        <span class="maker-cat-icon">${safeIcon}</span>
        <span class="maker-cat-name">${safeName}</span>
      </button>`;
    }).join('');
    makerGrid.addEventListener('click', e => {
      const btn = e.target.closest('.maker-cat-btn');
      if (btn) btn.classList.toggle('active');
    });
  }
  if (makerSave) {
    makerSave.addEventListener('click', async () => {
      const selected = [...document.querySelectorAll('.maker-cat-btn.active')].map(b => b.dataset.key);
      await dbSetMeta('makerCategories', selected);
      showToast('✓ Configuración de métricas guardada');
    });
  }
}


// ── Borrar todos los datos ──
async function clearAllData() {
  const statusEl = document.getElementById('data-import-status');
  const confirmEl = document.getElementById('data-clear-confirm');
  try {
    await dbClear();
    for (const c of await dbGetAllCats()) await dbDeleteCat(c.key);
    for (const p of await dbGetAllProjects()) await dbDeleteProject(p.id);

    tasks = [];
    CATS = { ...CATS_DEFAULT };
    await loadProjects();

    rebuildCatSelect();
    rebuildProjectSelect();
    rebuildFilterButtons();
    await renderSettingsCats();
    await render();

    confirmEl.style.display = 'none';
    statusEl.textContent = '✓ Datos borrados.';
    statusEl.className = 'settings-data-status ok';
    markDirty();
    showToast('✓ Datos borrados');
  } catch (err) {
    confirmEl.style.display = 'none';
    statusEl.textContent = 'Error al borrar los datos.';
    statusEl.className = 'settings-data-status err';
    console.error('clearAllData:', err);
  }
}

// ── Restaurar desde payload (compartido por importData y la nube) ──
async function restoreFromPayload(payload) {
  if (!payload || !Array.isArray(payload.tasks)) throw new Error('Payload inválido');
  const incoming = {
    tasks:      Array.isArray(payload.tasks)      ? payload.tasks      : [],
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    projects:   Array.isArray(payload.projects)   ? payload.projects   : []
  };
  await dbClear();
  for (const t of incoming.tasks)      await dbPut(t);
  for (const c of await dbGetAllCats()) await dbDeleteCat(c.key);
  for (const c of incoming.categories) await dbPutCat(c);
  for (const p of await dbGetAllProjects()) await dbDeleteProject(p.id);
  for (const p of incoming.projects)   await dbPutProject(p);
  
  if (payload.meta) {
    if (payload.meta.openRouterKey) {
      await dbSetMeta('openRouterKey', payload.meta.openRouterKey);
    }
    if (Array.isArray(payload.meta.makerCategories)) {
      await dbSetMeta('makerCategories', payload.meta.makerCategories);
    }
  }

  tasks = await dbGetAll();
  CATS  = { ...CATS_DEFAULT };
  await loadCustomCats();
  await loadProjects();
  rebuildCatSelect();
  rebuildProjectSelect();
  rebuildFilterButtons();
  if (document.getElementById('settings-cats-default')) await renderSettingsCats();
  await render();
  markDirty();
  return incoming.tasks.length;
}

// ── Exportar datos ──
async function exportData() {
  try {
    const [taskList, catList, projList, orKey, makerCats] = await Promise.all([
      dbGetAll(), dbGetAllCats(), dbGetAllProjects(), dbGetMeta('openRouterKey'),
      dbGetMeta('makerCategories')
    ]);
    const payload = {
      version: 1,
      exported: new Date().toISOString(),
      tasks: taskList,
      categories: catList,
      projects: projList,
      meta: {
        openRouterKey: orKey || null,
        makerCategories: makerCats || []
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daily-planner-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Datos exportados');
  } catch (err) {
    showToast('✗ Error al exportar');
    console.error('exportData:', err);
  }
}

// ── Importar desde archivo JSON ──
async function importData(file) {
  const statusEl = document.getElementById('data-import-status');
  statusEl.className = 'settings-data-status';
  statusEl.textContent = 'Procesando…';
  const setStatus = (msg, isOk) => {
    statusEl.textContent = msg;
    statusEl.className = 'settings-data-status ' + (isOk ? 'ok' : 'err');
  };
  try {
    const text = await file.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { setStatus('El archivo no es JSON válido.', false); return; }
    if (!payload || !Array.isArray(payload.tasks)) {
      setStatus('Formato no reconocido: falta la clave "tasks".', false);
      return;
    }
    const count = await restoreFromPayload(payload);
    setStatus('✓ Datos restaurados (' + count + ' tareas).', true);
    showToast('✓ Importación completada');
  } catch (err) {
    setStatus('Error inesperado al importar.', false);
    console.error('importData:', err);
  }
}

// ── Cloud backup: estado visual ──
function setCloudStatus(msg, type) {
  const txt = document.getElementById('cloud-status');
  const dot = document.getElementById('cloud-status-dot');
  if (txt) { txt.textContent = msg; txt.className = 'cloud-status' + (type ? ' ' + type : ''); }
  if (dot) { dot.className = 'cloud-status-dot' + (type ? ' ' + type : ''); }
}

// ── Cloud backup: subir ──
async function uploadBackup(silent = false) {
  if (silent && !_dataDirty) return;
  if (!silent) setCloudStatus('Subiendo…', '');
  try {
    const headers = await getCloudHeaders();
    // Si no tenemos sha, obtenerlo primero para no crear conflicto en GitHub
    if (!_backupSha) {
      const chk = await fetch('/api/backup', { headers });
      if (chk.ok) {
        const chkData = await chk.json();
        if (chkData.exists) _backupSha = chkData.sha;
      }
    }
    const [taskList, catList, projList, orKey, makerCats] = await Promise.all([
      dbGetAll(), dbGetAllCats(), dbGetAllProjects(), dbGetMeta('openRouterKey'),
      dbGetMeta('makerCategories')
    ]);
    const payload = {
      version: 1,
      exported: new Date().toISOString(),
      tasks: taskList,
      categories: catList,
      projects: projList,
      meta: {
        openRouterKey: orKey || null,
        makerCategories: makerCats || []
      }
    };
    const r = await fetch('/api/backup', {
      method: 'POST',
      headers: await getCloudHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ payload, sha: _backupSha })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    _backupSha = data.sha;
    _dataDirty = false;
    await dbSetMeta('lastBackupTime', payload.exported);
    const t = new Date();
    const timeStr = t.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    setCloudStatus('Backup: ' + timeStr, 'ok');
    if (!silent) showToast('☁ Backup guardado en la nube');
  } catch (err) {
    setCloudStatus('Error al subir', 'err');
    if (!silent) showToast('✗ Error al subir el backup');
    console.error('uploadBackup:', err);
  }
}

// ── Cloud backup: descargar y restaurar ──
async function downloadBackupFromCloud() {
  setCloudStatus('Descargando…', '');
  try {
    const headers = await getCloudHeaders();
    const r = await fetch('/api/backup', { headers });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.exists) {
      setCloudStatus('No hay backup en la nube', '');
      showToast('No hay backup en la nube');
      return;
    }
    _backupSha = data.sha;
    await restoreFromPayload(data.content);
    await dbSetMeta('lastBackupTime', data.content.exported);
    setCloudStatus('Restaurado desde la nube', 'ok');
    showToast('☁ Datos restaurados desde la nube');
  } catch (err) {
    setCloudStatus('Error al descargar', 'err');
    showToast('✗ Error al restaurar desde la nube');
    console.error('downloadBackupFromCloud:', err);
  }
}

// ── Al arrancar: comparar datos locales con backup en la nube ──
async function syncOnLoad() {
  try {
    const headers = await getCloudHeaders();
    const r = await fetch('/api/backup', { headers });
    if (!r.ok) return;
    const remote = await r.json();
    if (!remote.exists) return;

    _backupSha = remote.sha;
    const lastSynced = await dbGetMeta('lastBackupTime');

    if (!lastSynced || remote.content.exported > lastSynced) {
      showSyncModal(remote);
    } else {
      const t = new Date(remote.content.exported);
      const timeStr = t.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      setCloudStatus('Sincronizado · ' + timeStr, 'ok');
    }
  } catch (_) {
    // API no disponible (desarrollo local sin Vercel CLI) — silencioso
  }
}

// ── Modal de sincronización (no descartable) ──
function showSyncModal(remote) {
  const overlay = document.getElementById('sync-modal');
  const msgEl   = document.getElementById('sync-modal-msg');
  const dateStr = new Date(remote.content.exported).toLocaleString('es', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const count = Array.isArray(remote.content.tasks) ? remote.content.tasks.length : '?';
  msgEl.textContent =
    'Se encontró un backup del ' + dateStr + ' con ' + count + ' tarea(s). ¿Qué deseas hacer?';
  overlay.style.display = 'flex';

  document.getElementById('sync-restore').onclick = async () => {
    overlay.style.display = 'none';
    setCloudStatus('Restaurando…', '');
    try {
      const count2 = await restoreFromPayload(remote.content);
      await dbSetMeta('lastBackupTime', remote.content.exported);
      setCloudStatus('Restaurado desde la nube', 'ok');
      showToast('☁ ' + count2 + ' tareas restauradas desde la nube');
    } catch (err) {
      setCloudStatus('Error al restaurar', 'err');
      console.error('sync restore:', err);
    }
  };

  document.getElementById('sync-keep-local').onclick = async () => {
    overlay.style.display = 'none';
    // Marcar como visto para no volver a preguntar; el próximo upload sustituirá el backup remoto
    await dbSetMeta('lastBackupTime', remote.content.exported);
    setCloudStatus('Datos locales conservados', 'ok');
  };
}

// ── Render categorías en ajustes ──
async function renderSettingsCats() {
  // Predeterminadas
  const defEl = document.getElementById('settings-cats-default');
  defEl.innerHTML = '';
  for (const [key, cat] of Object.entries(CATS_DEFAULT)) {
    const chip = document.createElement('div');
    chip.className = 'settings-cat-chip';
    chip.innerHTML = `<span class="tag-dot" style="background:${cat.color}"></span>${cat.label}`;
    defEl.appendChild(chip);
  }

  // Personalizadas
  const cusEl = document.getElementById('settings-cats-custom');
  cusEl.innerHTML = '';
  const customs = await getCustomCats();
  const grp = document.getElementById('settings-custom-group');
  grp.style.display = customs.length ? 'flex' : 'none';
  for (const c of customs) {
    const chip = document.createElement('div');
    chip.className = 'settings-cat-chip';
    chip.innerHTML =
      `<span class="tag-dot" style="background:${c.color}"></span>${c.icon} ${c.name}` +
      `<button class="settings-cat-chip-edit" data-key="${c.key}" title="Editar">✎</button>` +
      `<button class="settings-cat-chip-del" data-key="${c.key}" title="Eliminar">✕</button>`;
    cusEl.appendChild(chip);
  }
  cusEl.querySelectorAll('.settings-cat-chip-edit').forEach(btn => {
    btn.addEventListener('click', () => showCatForm(btn.dataset.key));
  });
  cusEl.querySelectorAll('.settings-cat-chip-del').forEach(btn => {
    btn.addEventListener('click', () => deleteCustomCat(btn.dataset.key));
  });
}

async function deleteCustomCat(key) {
  await deleteCustomCatDB(key);
  delete CATS[key];
  markDirty();
  await renderSettingsCats();
  rebuildCatSelect();
  rebuildFilterButtons();
}

// ── Formulario de nueva categoría ──
function updateCatPreview() {
  if (!catNameIn) return;
  const name = catNameIn.value.trim() || 'Vista previa';
  const icon = catIconIn.value.trim() || selectedEmoji;
  document.getElementById('preview-dot').style.background = selectedColor;
  document.getElementById('preview-label').textContent = icon + ' ' + name;
}

function showCatForm(editKey) {
  editingCatKey = editKey || null;
  document.getElementById('settings-cat-form-title').textContent =
    editKey ? 'Editar categoría' : 'Nueva categoría';
  catNameIn.value = '';
  catIconIn.value = selectedEmoji;
  if (editKey) {
    // Lee directamente desde la BD para tener icon y name separados
    getCustomCats().then(list => {
      const found = list.find(x => x.key === editKey);
      if (found) {
        catNameIn.value = found.name;
        catIconIn.value = found.icon;
        selectedEmoji = found.icon;
        selectedColor = found.color;
        paletteEl.querySelectorAll('.settings-color-swatch').forEach(s => {
          s.classList.toggle('selected', s.dataset.hex === selectedColor);
        });
        updateCatPreview();
        catNameIn.focus();
      }
    });
  }
  updateCatPreview();
  catForm.classList.add('visible');
  addCatBtn.style.display = 'none';
  if (!editKey) catNameIn.focus();
}
function hideCatForm() {
  if (!catForm) return;
  catForm.classList.remove('visible');
  addCatBtn.style.display = '';
  editingCatKey = null;
}

// ══════════════════════════════════════════
// PROJECTS  (inicializado desde initProjects() dentro de init())
// ══════════════════════════════════════════
let projOverlay = null, projList = null;
let projForm = null, projAddBtn = null, projCancel = null;
let projSaveBtn = null, projNameIn = null, projDescIn = null;
let editingProjId = null;
let projConfirmOverlay = null, pendingDeleteProjId = null;

function openProjects() {
  projOverlay.classList.add('open');
  projOverlay.setAttribute('aria-hidden', 'false');
  renderProjectList();
}
function closeProjects() {
  if (!projOverlay) return;
  projOverlay.classList.remove('open');
  projOverlay.setAttribute('aria-hidden', 'true');
  hideProjForm();
  closeProjectDetail(false);
}

function openProjectDetail(projId) {
  currentDetailProjId = projId;
  const p = getProjectById(projId);
  if (!p) return;
  document.getElementById('proj-detail-name').textContent = p.name;
  const descEl = document.getElementById('proj-detail-desc');
  descEl.textContent = p.desc || '';
  renderProjectDetailTasks();
  document.getElementById('proj-views-wrap').classList.add('show-detail');
}
function closeProjectDetail(slide = true) {
  currentDetailProjId = null;
  if (slide) document.getElementById('proj-views-wrap').classList.remove('show-detail');
}
function renderProjectDetailTasks() {
  if (!currentDetailProjId) return;
  const container = document.getElementById('proj-detail-tasks');
  if (!container) return;
  const projTasks = tasks.filter(t => String(t.project) === String(currentDetailProjId) && !t.parentId);
  if (!projTasks.length) {
    container.innerHTML = '<div class="proj-detail-empty">No hay tareas en este proyecto aún.</div>';
    return;
  }
  const pending = sortTasks(projTasks.filter(t => !t.done));
  const done    = sortTasks(projTasks.filter(t => t.done));
  let html = '';
  if (pending.length) {
    html += `<div class="proj-detail-tasks-section-label">Pendientes · ${pending.length}</div>`;
    html += pending.map(t => renderTaskItem(t)).join('');
  }
  if (done.length) {
    html += `<div class="proj-detail-tasks-section-label" style="margin-top:10px">Completadas · ${done.length}</div>`;
    html += done.map(t => renderTaskItem(t)).join('');
  }
  container.innerHTML = html;
}
function openFormForProject(projId) {
  rebuildProjectSelect();
  setProjSelectValue(String(projId));
  document.querySelector('.form-modal-title').textContent = 'Nueva tarea';
  document.querySelector('.btn-add').textContent = 'Agregar';
  formOverlay.classList.add('above-projects');
  openForm();
}

function renderProjectList() {
  if (!projList) return;
  if (!PROJECTS.length) {
    projList.innerHTML = '<div class="projects-empty">No hay proyectos aún. ¡Crea el primero!</div>';
    return;
  }
  projList.innerHTML = PROJECTS.map(p => {
    const count = tasks.filter(t => String(t.project) === String(p.id)).length;
    const countLabel = count === 1 ? '1 tarea' : count + ' tareas';
    const descHtml = p.desc ? `<div class="project-card-desc">${escHtml(p.desc)}</div>` : '';
    return `<div class="project-card" data-proj-id="${p.id}">
      <div class="project-card-body" style="cursor:pointer">
        <div class="project-card-name">${escHtml(p.name)}</div>
        ${descHtml}
        <div class="project-card-count">${countLabel}</div>
      </div>
      <div class="project-card-actions">
        <button class="proj-edit" data-proj-edit="${p.id}" title="Editar">✎</button>
        <button class="proj-del" data-proj-del="${p.id}" title="Eliminar">✕</button>
      </div>
    </div>`;
  }).join('');

  // Wire edit/delete buttons
  projList.querySelectorAll('[data-proj-edit]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); showProjForm(Number(btn.dataset.projEdit)); });
  });
  projList.querySelectorAll('[data-proj-del]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); confirmDeleteProject(Number(btn.dataset.projDel)); });
  });
  projList.querySelectorAll('.project-card-body').forEach(body => {
    body.addEventListener('click', () => openProjectDetail(Number(body.closest('[data-proj-id]').dataset.projId)));
  });
}

function showProjForm(editId) {
  editingProjId = editId || null;
  document.getElementById('project-form-title').textContent =
    editId ? 'Editar proyecto' : 'Nuevo proyecto';
  projNameIn.value = '';
  projDescIn.value = '';
  if (editId) {
    const p = getProjectById(editId);
    if (p) {
      projNameIn.value = p.name;
      projDescIn.value = p.desc || '';
    }
  }
  projForm.classList.add('visible');
  projAddBtn.style.display = 'none';
  projNameIn.focus();
}

function hideProjForm() {
  if (!projForm) return;
  projForm.classList.remove('visible');
  projAddBtn.style.display = '';
  editingProjId = null;
}

function confirmDeleteProject(id) {
  pendingDeleteProjId = id;
  const p = getProjectById(id);
  const count = tasks.filter(t => String(t.project) === String(id)).length;
  document.getElementById('project-confirm-text').textContent =
    count > 0
      ? `El proyecto "${p ? p.name : ''}" tiene ${count} tarea${count === 1 ? '' : 's'}. ¿Qué deseas hacer?`
      : `¿Eliminar el proyecto "${p ? p.name : ''}"?`;
  // Hide "delete all" if no tasks
  document.getElementById('project-confirm-delete').style.display = count > 0 ? '' : 'none';
  document.getElementById('project-confirm-keep').textContent = count > 0 ? 'Conservar tareas' : 'Eliminar';
  projConfirmOverlay.classList.add('open');
}

async function executeDeleteProject(keepTasks) {
  const id = pendingDeleteProjId;
  if (!id) return;
  pendingDeleteProjId = null;
  projConfirmOverlay.classList.remove('open');

  const affected = tasks.filter(t => String(t.project) === String(id));
  if (keepTasks) {
    for (const t of affected) {
      t.project = '';
      await dbPut(t);
    }
  } else {
    for (const t of affected) {
      tasks = tasks.filter(tk => tk.id !== t.id);
      await dbDelete(t.id);
    }
  }

  await deleteProjectDB(id);
  markDirty();
  if (filterMode === 'proj:' + id) { filterMode = 'all'; document.getElementById('filter-toggle-label').textContent = 'Filtros'; document.getElementById('filters-toggle').classList.remove('filtered'); }
  rebuildProjectSelect();
  rebuildFilterButtons();
  renderProjectList();
  render();
  showToast('🗑 Proyecto eliminado');
}

function initProjects() {
  projOverlay = document.getElementById('projects-overlay');
  projList = document.getElementById('projects-list');
  projForm = document.getElementById('project-form');
  projAddBtn = document.getElementById('projects-add-btn');
  projCancel = document.getElementById('project-cancel');
  projSaveBtn = document.getElementById('project-save');
  projNameIn = document.getElementById('project-name');
  projDescIn = document.getElementById('project-desc');
  projConfirmOverlay = document.getElementById('project-confirm-overlay');
  subtaskCompleteOverlay = document.getElementById('subtask-complete-overlay');

  if (!projOverlay) return;

  // Nav button
  const navBtn = document.querySelector('.nav-fab-item[data-nav="proyectos"]');
  if (navBtn) {
    navBtn.addEventListener('click', () => {
      closeNav();
      openProjects();
    });
  }

  // Close overlay
  document.getElementById('projects-close').addEventListener('click', closeProjects);
  projOverlay.addEventListener('click', e => { if (e.target === projOverlay) closeProjects(); });

  // Add button
  projAddBtn.addEventListener('click', () => showProjForm(null));
  projCancel.addEventListener('click', hideProjForm);

  // Save
  projSaveBtn.addEventListener('click', async () => {
    const name = projNameIn.value.trim();
    if (!name) { showToast('✏️ Escribe un nombre'); projNameIn.focus(); return; }
    const desc = projDescIn.value.trim();

    if (editingProjId) {
      const existing = getProjectById(editingProjId);
      if (existing) {
        existing.name = name;
        existing.desc = desc;
        await saveProject(existing);
      }
      markDirty();
      showToast('✎ Proyecto actualizado');
    } else {
      const proj = { id: Date.now(), name, desc };
      await saveProject(proj);
      markDirty();
      showToast('✓ Proyecto creado');
    }

    hideProjForm();
    rebuildProjectSelect();
    rebuildFilterButtons();
    renderProjectList();
    render();
  });

  // Confirm dialog buttons
  document.getElementById('project-confirm-keep').addEventListener('click', () => executeDeleteProject(true));
  document.getElementById('project-confirm-delete').addEventListener('click', () => executeDeleteProject(false));
  document.getElementById('project-confirm-cancel').addEventListener('click', () => {
    pendingDeleteProjId = null;
    projConfirmOverlay.classList.remove('open');
  });

  // Subtask complete dialog buttons
  document.getElementById('subtask-complete-free').addEventListener('click', () => executeCompleteParent('free'));
  document.getElementById('subtask-complete-all').addEventListener('click', () => executeCompleteParent('all'));
  document.getElementById('subtask-complete-cancel').addEventListener('click', () => executeCompleteParent('cancel'));

  // Project detail
  document.getElementById('proj-back-btn').addEventListener('click', closeProjectDetail);
  document.getElementById('proj-detail-close').addEventListener('click', closeProjects);
  document.getElementById('proj-add-task-btn').addEventListener('click', () => {
    if (currentDetailProjId) openFormForProject(currentDetailProjId);
  });
}

// ══════════════════════════════════════════
// STATS  (inicializado desde initStats() dentro de init())
// ══════════════════════════════════════════
let statsOverlay = null;
let _statsMonthOffset = 0; // 0 = current month, -1 = previous, etc.

function openStats() {
  _statsMonthOffset = 0;
  statsOverlay.classList.add('open');
  statsOverlay.setAttribute('aria-hidden', 'false');
  renderStats();
}
function closeStats() {
  statsOverlay.classList.remove('open');
  statsOverlay.setAttribute('aria-hidden', 'true');
}

async function renderStats() {
  const done = tasks.filter(t => t.done);

  // ── Global metrics ──
  document.getElementById('stats-total-done').textContent = done.length;
  document.getElementById('stats-pri-high').textContent = done.filter(t => t.pri === 'high').length;
  document.getElementById('stats-pri-mid').textContent = done.filter(t => t.pri === 'mid').length;
  document.getElementById('stats-pri-low').textContent = done.filter(t => t.pri === 'low').length;

  // Days since first task (use task.id as creation timestamp)
  const allTimes = tasks.map(t => t.id).filter(Boolean);
  const daysSinceDateEl = document.getElementById('stats-days-since-date');
  if (allTimes.length) {
    const firstMs = Math.min(...allTimes);
    const daysSince = Math.floor((Date.now() - firstMs) / 86400000);
    document.getElementById('stats-days-since').textContent = daysSince;
    if (daysSinceDateEl) {
      const firstDate = new Date(firstMs);
      daysSinceDateEl.textContent = firstDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  } else {
    document.getElementById('stats-days-since').textContent = '—';
    if (daysSinceDateEl) daysSinceDateEl.textContent = 'Sin tareas aún';
  }

  // Weekly streak: count consecutive weeks (ending this week) with ≥1 completion
  const { count: streak, startDate: streakStart } = calcWeekStreak(done);
  document.getElementById('stats-streak').textContent = streak;
  const streakSinceEl = document.getElementById('stats-streak-since');
  if (streakSinceEl) {
    if (streak > 0 && streakStart) {
      streakSinceEl.textContent = 'desde el ' + streakStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    } else {
      streakSinceEl.textContent = 'Sin racha activa';
    }
  }

  // Historial de rachas
  const allStreaks = calcAllStreaks(done);
  const historyEl = document.getElementById('stats-streak-history');
  const streakCard = document.getElementById('stats-streak-card');
  if (historyEl) {
    if (allStreaks.length <= 1) {
      // Solo hay una racha (la actual o ninguna): no tiene sentido mostrar historial
      historyEl.classList.add('hidden');
      if (streakCard) streakCard.style.cursor = 'default';
    } else {
      const currentIso = isoWeek(new Date());
      historyEl.innerHTML = `<div class="streak-history-title">Historial de rachas</div>` +
        allStreaks.map((s, i) => {
          const startMon = isoWeekToMonday(s.start);
          const endMon   = isoWeekToMonday(s.end);
          // End label: last day of that week (Sunday)
          const endSun = new Date(endMon); endSun.setDate(endMon.getDate() + 6);
          const isActive = s.end === currentIso || s.end >= currentIso;
          const badge = isActive ? '<span class="streak-badge-active">activa</span>' : '';
          const best  = i === 0 && !isActive ? '<span class="streak-badge-best">récord</span>' : '';
          const dateRange = startMon.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) +
            ' – ' + endSun.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
          return `<div class="streak-history-row">
            <span class="streak-history-weeks">${s.weeks} sem.</span>
            <span class="streak-history-range">${dateRange}</span>
            <span>${badge}${best}</span>
          </div>`;
        }).join('');
      if (streakCard) {
        streakCard.style.cursor = 'pointer';
        streakCard.onclick = () => historyEl.classList.toggle('hidden');
      }
    }
  }

  renderBreakdown(done, 'total');

  // ── Global Cycle Time ──
  const globalCycle = calcCycleTime(done);
  const ctGlobalEl = document.getElementById('stats-cycletime-global');
  const ctGlobalSubEl = document.getElementById('stats-cycletime-global-sub');
  if (ctGlobalEl) ctGlobalEl.textContent = globalCycle !== null ? globalCycle + ' d' : '—';
  if (ctGlobalSubEl) ctGlobalSubEl.textContent = globalCycle !== null ? 'desde creación hasta done' : 'Sin datos aún';

  // ── Global Impact Factor ──
  const makerCats = await dbGetMeta('makerCategories').catch(() => null) || [];
  const impGlobal = calcImpactFactor(done, makerCats);
  const impGlobalEl = document.getElementById('stats-impact-global');
  const impGlobalSubEl = document.getElementById('stats-impact-global-sub');
  if (impGlobalEl) {
    if (impGlobal) {
      impGlobalEl.textContent = impGlobal.pct + '%';
      if (impGlobalSubEl) impGlobalSubEl.textContent = `${impGlobal.maker} Maker · ${impGlobal.manager} Manager`;
    } else {
      impGlobalEl.textContent = '—';
      if (impGlobalSubEl) impGlobalSubEl.textContent = makerCats.length ? 'Sin tareas' : 'Configura en Ajustes → Métricas';
    }
  }

  // ── Month section ──
  await renderMonthSection();
}

function calcWeekStreak(done) {
  // Build a Set of ISO week strings (YYYY-Www) for weeks with ≥1 completion
  const weeksWithDone = new Set();
  for (const t of done) {
    if (!t.due) continue;
    const d = new Date(t.due + 'T00:00:00');
    weeksWithDone.add(isoWeek(d));
  }
  // Walk backwards from current week, count streak and find start Monday
  let count = 0;
  let startDate = null;
  const cursor = new Date();
  while (true) {
    const wk = isoWeek(cursor);
    if (!weeksWithDone.has(wk)) break;
    count++;
    // Record the Monday of this week as new (earlier) start
    const monday = new Date(cursor);
    const dayOfWeek = monday.getDay() || 7;
    monday.setDate(monday.getDate() - (dayOfWeek - 1));
    startDate = new Date(monday);
    cursor.setDate(cursor.getDate() - 7);
  }
  return { count, startDate };
}

function calcAllStreaks(done) {
  // Build sorted array of unique ISO weeks with completions
  const weekSet = new Set();
  for (const t of done) {
    if (!t.due) continue;
    weekSet.add(isoWeek(new Date(t.due + 'T00:00:00')));
  }
  if (!weekSet.size) return [];

  // Sort weeks chronologically
  const sortedWeeks = [...weekSet].sort();

  // Group into consecutive runs
  const streaks = [];
  let runStart = sortedWeeks[0];
  let runEnd   = sortedWeeks[0];
  let runLen   = 1;

  for (let i = 1; i < sortedWeeks.length; i++) {
    const prev = sortedWeeks[i - 1];
    const curr = sortedWeeks[i];
    // Check if curr is exactly one week after prev
    const prevDate = isoWeekToMonday(prev);
    prevDate.setDate(prevDate.getDate() + 7);
    const expectedNext = isoWeek(prevDate);
    if (curr === expectedNext) {
      runEnd = curr;
      runLen++;
    } else {
      streaks.push({ start: runStart, end: runEnd, weeks: runLen });
      runStart = curr; runEnd = curr; runLen = 1;
    }
  }
  streaks.push({ start: runStart, end: runEnd, weeks: runLen });

  // Sort descending by length, then by recency
  return streaks.sort((a, b) => b.weeks - a.weeks || b.end.localeCompare(a.end));
}

function isoWeekToMonday(isoWeekStr) {
  // e.g. '2026-W18' -> Date of that Monday
  const [yearStr, wStr] = isoWeekStr.split('-W');
  const year = Number(yearStr), week = Number(wStr);
  const jan4 = new Date(year, 0, 4); // Jan 4 is always in week 1
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (dayOfWeek - 1) + (week - 1) * 7);
  return monday;
}

function isoWeek(d) {
  // Returns 'YYYY-Www' for the ISO week containing date d
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7; // Mon=1..Sun=7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const year = tmp.getUTCFullYear();
  const week = Math.ceil(((tmp - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ─── Métricas de rendimiento ─────────────────────────────────────────────────

/** Win Rate: tareas con due en el mes completadas ese mismo día / total planificadas */
function calcWinRate(allTasks, viewYear, viewMonth) {
  const planned = allTasks.filter(t => {
    if (!t.due) return false;
    const d = new Date(t.due + 'T00:00:00');
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  if (!planned.length) return null;
  const completedOnTime = planned.filter(t => t.done && t.doneAt === t.due);
  return Math.round(completedOnTime.length / planned.length * 100);
}

/** Cycle Time en días: (doneAt - creación) promedio, excluyendo subtareas */
function calcCycleTime(doneTasks) {
  const valid = doneTasks.filter(t => !t.parentId && t.doneAt);
  if (!valid.length) return null;
  const total = valid.reduce((sum, t) => {
    const created = new Date(t.id); // id = ms timestamp
    created.setHours(0, 0, 0, 0); // normalizar a medianoche para contar días calendario
    const doneDate = new Date(t.doneAt + 'T00:00:00');
    return sum + Math.max(0, (doneDate - created) / 86400000);
  }, 0);
  return Math.round(total / valid.length * 10) / 10; // 1 decimal
}

/** Drawdown: cuenta de snoozedDates por semana ISO dentro del mes */
function calcDrawdownByWeek(allTasks, viewYear, viewMonth) {
  const weekCounts = {};
  allTasks.forEach(t => {
    if (!t.snoozedDates) return;
    t.snoozedDates.forEach(dStr => {
      const d = new Date(dStr + (dStr.includes('T') ? '' : 'T00:00:00'));
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const wk = isoWeek(d);
        weekCounts[wk] = (weekCounts[wk] || 0) + 1;
      }
    });
  });
  const sorted = Object.keys(weekCounts).sort();
  return sorted.map(wk => ({ week: wk, count: weekCounts[wk] }));
}

/** Factor de impacto: % de tareas completadas que son Maker */
function calcImpactFactor(doneTasks, makerCats) {
  if (!makerCats || !makerCats.length) return null;
  const total = doneTasks.length;
  if (!total) return null;
  const makerCount = doneTasks.filter(t => getTaskCats(t).some(c => makerCats.includes(c))).length;
  return { maker: makerCount, manager: total - makerCount, pct: Math.round(makerCount / total * 100) };
}

// ─────────────────────────────────────────────────────────────────────────────

async function renderMonthSection() {
  const today = new Date();
  const viewYear  = today.getFullYear() + Math.floor((today.getMonth() + _statsMonthOffset) / 12);
  const viewMonth = ((today.getMonth() + _statsMonthOffset) % 12 + 12) % 12;
  const isCurrentMonth = _statsMonthOffset === 0;

  // Days in the viewed month up to today (if current) or full month (if past)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;

  const done = tasks.filter(t => t.done);
  const monthDone = done.filter(t => {
    if (!t.due) return false;
    const d = new Date(t.due + 'T00:00:00');
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });

  // Daily counts
  const dailyCounts = new Array(lastDay).fill(0);
  for (const t of monthDone) {
    const day = new Date(t.due + 'T00:00:00').getDate();
    if (day <= lastDay) dailyCounts[day - 1]++;
  }

  const monthName = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  document.getElementById('stats-month-title').textContent = 'Evolución · ' + monthName;
  document.getElementById('stats-chart-legend').textContent =
    `1 – ${lastDay} de ${monthName}`;

  let monthSnoozedCount = 0;
  tasks.forEach(t => {
    if (t.snoozedDates) {
      t.snoozedDates.forEach(dStr => {
        const d = new Date(dStr);
        if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) monthSnoozedCount++;
      });
    }
  });

  document.getElementById('stats-month-done').textContent = monthDone.length;
  document.getElementById('stats-month-high').textContent = monthDone.filter(t => t.pri === 'high').length;
  document.getElementById('stats-month-mid').textContent = monthDone.filter(t => t.pri === 'mid').length;
  document.getElementById('stats-month-low').textContent = monthDone.filter(t => t.pri === 'low').length;
  const snoozedEl = document.getElementById('stats-month-snoozed');
  if (snoozedEl) snoozedEl.textContent = monthSnoozedCount;
  const snoozedPctEl = document.getElementById('stats-month-snoozed-pct');
  if (snoozedPctEl) {
    if (monthDone.length > 0 && monthSnoozedCount > 0) {
      const pct = Math.round((monthSnoozedCount / monthDone.length) * 100);
      snoozedPctEl.textContent = pct + '% del total';
    } else {
      snoozedPctEl.textContent = '';
    }
  }

  document.getElementById('stats-month-label').textContent =
    `Completadas en ${new Date(viewYear, viewMonth, 1).toLocaleDateString('es-ES', { month: 'long' })}`;

  // Disable next button if already at current month
  document.getElementById('stats-month-next').disabled = isCurrentMonth;

  drawChart(dailyCounts, lastDay);
  renderBreakdown(monthDone, 'month');

  // ── Métricas de rendimiento ──
  const makerCats = await dbGetMeta('makerCategories').catch(() => null) || [];
  const globalDone = tasks.filter(t => t.done);
  const globalCycle = calcCycleTime(globalDone);

  // Win Rate
  const wr = calcWinRate(tasks, viewYear, viewMonth);
  const wrEl = document.getElementById('stats-winrate');
  const wrBar = document.getElementById('stats-winrate-bar');
  const wrSub = document.getElementById('stats-winrate-sub');
  if (wrEl) {
    if (wr !== null) {
      wrEl.textContent = wr + '%';
      if (wrBar) wrBar.style.width = wr + '%';
      if (wrSub) {
        const label = wr >= 90 ? 'ejecución excelente' : wr >= 70 ? 'ejecución sólida' : wr >= 50 ? 'ejecución regular' : 'margen de mejora';
        wrSub.textContent = label;
      }
    } else {
      wrEl.textContent = '—';
      if (wrBar) wrBar.style.width = '0%';
      if (wrSub) wrSub.textContent = 'Sin tareas planificadas este mes';
    }
  }

  // Cycle Time mensual
  const cycleMes = calcCycleTime(monthDone);
  const ctMonthEl = document.getElementById('stats-cycletime-month');
  const ctMonthSub = document.getElementById('stats-cycletime-month-sub');
  if (ctMonthEl) {
    ctMonthEl.textContent = cycleMes !== null ? cycleMes + ' d' : '—';
    if (ctMonthSub) {
      if (cycleMes !== null && globalCycle !== null) {
        const diff = cycleMes - globalCycle;
        const arrow = diff > 0 ? '↑' : '↓';
        const sign = diff > 0 ? '+' : '';
        ctMonthSub.textContent = `${arrow} ${sign}${Math.round(diff * 10) / 10} d vs. global (${globalCycle} d)`;
      } else {
        ctMonthSub.textContent = 'Sin datos este mes';
      }
    }
  }

  // Drawdown sparkline
  const drawdownData = calcDrawdownByWeek(tasks, viewYear, viewMonth);
  const sparkEl = document.getElementById('stats-drawdown-sparkline');
  const drawdownWrap = document.getElementById('stats-drawdown-wrap');
  if (sparkEl) {
    if (drawdownData.length) {
      const maxCount = Math.max(...drawdownData.map(d => d.count));
      sparkEl.innerHTML = drawdownData.map(d => {
        const hPct = maxCount > 0 ? Math.round(d.count / maxCount * 100) : 0;
        const cleanWeek = d.week.replace(viewYear + '-W', 'Semana ');
        return `<div class="spark-bar-wrap" title="${cleanWeek}: ${d.count} pospuestas">
          <div class="spark-bar" style="height:${hPct}%"></div>
          <div class="spark-bar-val">${d.count}</div>
        </div>`;
      }).join('');
      const totalSnoozes = drawdownData.reduce((s, d) => s + d.count, 0);
      const subEl = document.getElementById('stats-drawdown-sub');
      if (subEl) subEl.textContent = `${totalSnoozes} pospuestas en ${drawdownData.length} semana${drawdownData.length > 1 ? 's' : ''}`;
      if (drawdownWrap) drawdownWrap.classList.remove('hidden');
    } else {
      if (drawdownWrap) drawdownWrap.classList.add('hidden');
    }
  }

  // Factor de Impacto mensual
  const impMonth = calcImpactFactor(monthDone, makerCats);
  const impRatioEl = document.getElementById('stats-impact-ratio');
  const impBarEl = document.getElementById('stats-impact-bar');
  const impSubEl = document.getElementById('stats-impact-sub');
  const impCardEl = document.getElementById('stats-impact-card');
  if (impCardEl) {
    if (!makerCats.length) {
      impCardEl.classList.add('stats-perf-card-muted');
      if (impRatioEl) impRatioEl.textContent = '—';
      if (impBarEl) impBarEl.style.width = '0%';
      if (impSubEl) impSubEl.textContent = 'Configura las categorías Maker en Ajustes → Métricas';
    } else if (impMonth) {
      impCardEl.classList.remove('stats-perf-card-muted');
      if (impRatioEl) impRatioEl.textContent = impMonth.pct + '%';
      if (impBarEl) impBarEl.style.width = impMonth.pct + '%';
      if (impSubEl) impSubEl.textContent = `${impMonth.maker} Maker · ${impMonth.manager} Manager · ${impMonth.pct}% trabajo profundo`;
    } else {
      impCardEl.classList.remove('stats-perf-card-muted');
      if (impRatioEl) impRatioEl.textContent = '—';
      if (impBarEl) impBarEl.style.width = '0%';
      if (impSubEl) impSubEl.textContent = 'Sin tareas completadas este mes';
    }
  }
}

function renderBreakdown(done, prefix) {
  const el = document.getElementById(`stats-breakdown-${prefix}`);
  if (!el) return;
  let html = '';

  // Categories with at least 1 completion
  const catRows = Object.entries(CATS)
    .map(([key, cat]) => ({ key, cat, count: done.filter(t => getTaskCats(t).includes(key)).length }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count);

  if (catRows.length) {
    html += `<div class="stats-break-head">Por categoría</div>`;
    html += catRows.map(e =>
      `<div class="stats-break-row">
        <span class="stats-break-dot" style="background:${e.cat.color}"></span>
        <span class="stats-break-name">${e.cat.label}</span>
        <span class="stats-break-count">${e.count}</span>
      </div>`
    ).join('');
  }

  // Projects with at least 1 completion
  const projRows = PROJECTS
    .map(p => ({ p, count: done.filter(t => String(t.project) === String(p.id)).length }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count);

  if (projRows.length) {
    html += `<div class="stats-break-head">Por proyecto</div>`;
    html += projRows.map(e =>
      `<div class="stats-break-row">
        <span class="stats-break-icon">◫</span>
        <span class="stats-break-name">${e.p.name}</span>
        <span class="stats-break-count">${e.count}</span>
      </div>`
    ).join('');
  }

  el.innerHTML = html;
}

let _chartPoints = [];

function drawChart(data, days) {
  const canvas = document.getElementById('stats-chart');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement.clientWidth - 32;
  const cssH = 200;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padL = 32, padR = 12, padT = 16, padB = 28;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;
  const max = Math.max(...data, 1);

  // Grid lines
  const steps = Math.min(max, 4);
  ctx.strokeStyle = 'rgba(160,140,100,0.12)';
  ctx.lineWidth = 1;
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(160,140,100,0.5)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= steps; i++) {
    const val = Math.round(max * i / steps);
    const y = padT + h - (val / max) * h;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + w, y);
    ctx.stroke();
    ctx.fillText(val, padL - 6, y);
  }

  // X labels (day numbers)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = days > 15 ? (days > 25 ? 5 : 3) : 1;
  for (let i = 0; i < days; i++) {
    if ((i + 1) % step === 0 || i === 0) {
      const x = padL + (i / (days - 1 || 1)) * w;
      ctx.fillText(i + 1, x, padT + h + 6);
    }
  }

  if (days >= 2) {
    // Area fill
    ctx.beginPath();
    for (let i = 0; i < days; i++) {
      const x = padL + (i / (days - 1)) * w;
      const y = padT + h - (data[i] / max) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(padL + w, padT + h);
    ctx.lineTo(padL, padT + h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(139,94,16,0.12)';
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < days; i++) {
      const x = padL + (i / (days - 1)) * w;
      const y = padT + h - (data[i] / max) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgb(139,94,16)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Dots + store positions
  _chartPoints = [];
  for (let i = 0; i < days; i++) {
    const x = padL + (i / (days - 1 || 1)) * w;
    const y = padT + h - (data[i] / max) * h;
    _chartPoints.push({ x, y, day: i + 1, count: data[i] });
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = data[i] > 0 ? 'rgb(139,94,16)' : 'rgba(139,94,16,0.3)';
    ctx.fill();
  }

  // Tooltip interaction
  const tip = document.getElementById('stats-chart-tooltip');
  const showTip = (cx, cy) => {
    let nearest = null, minDist = Infinity;
    for (const p of _chartPoints) {
      const dist = Math.hypot(cx - p.x, cy - p.y);
      if (dist < minDist) { minDist = dist; nearest = p; }
    }
    if (!nearest || minDist > 28) { tip.classList.remove('visible'); return; }
    const label = nearest.count === 1 ? '1 completada' : `${nearest.count} completadas`;
    tip.innerHTML = `<strong>Día ${nearest.day}</strong><br>${label}`;
    tip.classList.add('visible');
    // Clamp within container bounds
    const containerW = canvas.parentElement.clientWidth;
    const containerH = cssH;
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    let left = nearest.x - tipW / 2;
    let top = nearest.y - tipH - 10;
    // horizontal clamp
    if (left < 4) left = 4;
    if (left + tipW > containerW - 4) left = containerW - tipW - 4;
    // vertical: if not enough space above, show below
    if (top < 4) top = nearest.y + 14;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };

  if (!canvas._tipWired) {
    canvas._tipWired = true;
    canvas.addEventListener('mousemove', e => showTip(e.offsetX, e.offsetY));
    canvas.addEventListener('mouseleave', () => tip.classList.remove('visible'));
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      showTip(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
    canvas.addEventListener('touchend', () => tip.classList.remove('visible'));
  }
}

function initStats() {
  statsOverlay = document.getElementById('stats-overlay');
  document.getElementById('stats-close').addEventListener('click', closeStats);
  statsOverlay.addEventListener('click', e => { if (e.target === statsOverlay) closeStats(); });

  document.getElementById('stats-month-prev').addEventListener('click', () => {
    _statsMonthOffset--;
    renderMonthSection();
  });
  document.getElementById('stats-month-next').addEventListener('click', () => {
    if (_statsMonthOffset < 0) { _statsMonthOffset++; renderMonthSection(); }
  });

  const navBtn = document.querySelector('.nav-fab-item[data-nav="estadistica"]');
  if (navBtn) {
    navBtn.addEventListener('click', () => {
      closeNav();
      openStats();
    });
  }
}

// ══════════════════════════════════════════
// IA INTEGRATION (OpenRouter)
// ══════════════════════════════════════════

async function callOpenRouterAPI(prompt, systemMsg, isJson) {
  const apiKey = await dbGetMeta('openRouterKey');
  if (!apiKey) {
    showToast('⚠️ Falta configurar la API Key de OpenRouter en Ajustes');
    return null;
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'Daily Planner App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-small-2603',
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: prompt }
        ],
        response_format: isJson ? { type: 'json_object' } : undefined
      })
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('OpenRouter Error:', err);
    showToast('✗ Error conectando con la IA');
    return null;
  }
}

// ── Magic Input Logic ──
const magicInputText = document.getElementById('magic-input-text');
const btnMagicGen = document.getElementById('btn-magic-generate');
const magicLoading = document.getElementById('magic-loading');

if (btnMagicGen) {
  btnMagicGen.addEventListener('click', async () => {
    const prompt = magicInputText.value.trim();
    if (!prompt) return;

    btnMagicGen.disabled = true;
    magicLoading.style.display = 'inline';

    const systemMsg = `Eres un asistente que extrae información de tareas. Devuelve única y estrictamente un objeto JSON con esta estructura:
{
  "title": "String, resumen o título corto",
  "desc": "String opcional, elaboraciones extraídas",
  "due": "String opcional formato YYYY-MM-DD",
  "time": "String opcional formato HH:MM (24h)",
  "pri": "String opcional entre 'low', 'mid', 'high' (por defecto 'mid')",
  "repeat": "String opcional. Si la tarea se repite en días específicos de la semana usa formato 'dw:N,N,...' donde N son números de día (0=Dom,1=Lun,2=Mar,3=Mié,4=Jue,5=Vie,6=Sáb). Ejemplos: 'dw:1,2,3,4,5' para lunes a viernes, 'dw:1,3,5' para lunes/miércoles/viernes, 'dw:6,0' para fin de semana. Para intervalo fijo usa 'N:unit' donde unit es h/d/w/m/y. Omite este campo si no hay recurrencia."
}
No incluyas texto fuera del JSON. Hoy es ${new Date().toISOString().slice(0,10)}`;

    const response = await callOpenRouterAPI(prompt, systemMsg, true);
    
    if (response) {
      try {
        let jsonStr = response;
        if (jsonStr.includes('\`\`\`json')) {
           jsonStr = jsonStr.split('\`\`\`json')[1].split('\`\`\`')[0];
        } else if (jsonStr.includes('\`\`\`')) {
           jsonStr = jsonStr.split('\`\`\`')[1].split('\`\`\`')[0];
        }
        const data = JSON.parse(jsonStr);

        if (data.title) document.getElementById('new-task').value = data.title;
        if (data.desc) document.getElementById('new-desc').value = data.desc;
        if (data.due) document.getElementById('sel-due').value = data.due;
        if (data.time) document.getElementById('sel-time').value = data.time;
        if (data.pri) document.getElementById('sel-pri').value = data.pri;
        if (data.repeat) {
          const repStr = String(data.repeat);
          if (repStr.startsWith('dw:')) {
            document.getElementById('sel-repeat-unit').value = 'dw';
            const activeDays = repStr.slice(3).split(',').map(s => s.trim());
            document.querySelectorAll('#repeat-days-picker .day-btn').forEach(b => {
              b.classList.toggle('active', activeDays.includes(b.dataset.day));
            });
          } else if (repStr.includes(':')) {
            const parts = repStr.split(':');
            document.getElementById('sel-repeat-n').value = parts[0];
            document.getElementById('sel-repeat-unit').value = parts[1];
          }
          syncRepeatN();
        }
        
        magicInputText.value = '';
        showToast('✨ Formulario rellenado con IA');
      } catch (e) {
        console.error('Error parseando JSON IA:', e);
        showToast('✗ La IA devolvió un formato no reconocido');
      }
    }
    
    btnMagicGen.disabled = false;
    magicLoading.style.display = 'none';
  });
}

// ── Breakdown Logic ──
async function handleAIBreakdown(taskId, btnEl) {
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  
  const originalText = btnEl.innerHTML;
  btnEl.disabled = true;
  btnEl.innerHTML = '<span class="btn-icon" style="color:var(--gold);">⏳</span> Procesando...';

  const systemMsg = `Eres un organizador de tareas. A partir de una tarea, devuelve única y estrictamente un JSON con un array de strings bajo la clave "subtasks". Ejemplo: { "subtasks": ["Paso 1", "Paso 2"] }. El nivel de desglose debe ser secuencial, directo a la acción.`;
  const prompt = `Desglosa la tarea principal en pasos viables: "${t.text}". ${t.desc ? 'Contexto de la tarea: ' + t.desc : ''}`;

  const response = await callOpenRouterAPI(prompt, systemMsg, true);

  if (response) {
      try {
        let jsonStr = response;
        if (jsonStr.includes('\`\`\`json')) {
           jsonStr = jsonStr.split('\`\`\`json')[1].split('\`\`\`')[0];
        } else if (jsonStr.includes('\`\`\`')) {
           jsonStr = jsonStr.split('\`\`\`')[1].split('\`\`\`')[0];
        }
        const data = JSON.parse(jsonStr);
        if (data.subtasks && Array.isArray(data.subtasks)) {
           for (const sub of data.subtasks) {
               const newSub = {
                 id: 't_' + Date.now() + Math.floor(Math.random()*1000),
                 text: sub,
                 done: false,
                 createdAt: todayISO(),
                 createdTime: new Date().toLocaleTimeString('en-GB'),
                 parentId: taskId
               };
               tasks.push(newSub);
               await dbPut(newSub);
               // Add tiny delay to ensure timestamps/ids are ordered
               await new Promise(r => setTimeout(r, 10));
           }
           renderDetailBody(taskId);
           markDirty();
           render();
           showToast('✨ Desglose completado');
        }
      } catch(e) {
        console.error('Error parseando JSON desglose:', e);
        showToast('✗ La IA devolvió un formato no válido');
      }
  }

  btnEl.disabled = false;
  btnEl.innerHTML = originalText;
}

// ── Snooze Granular History Logic ──
const snoozeDetailOverlay = document.getElementById('snooze-detail-overlay');
const btnSnoozeDetail = document.getElementById('btn-snooze-detail');
const snoozeDetailClose = document.getElementById('snooze-detail-close');
const snoozeDetailBody = document.getElementById('snooze-detail-body');

if (btnSnoozeDetail && snoozeDetailOverlay) {
  btnSnoozeDetail.addEventListener('click', () => {
    snoozeDetailOverlay.classList.add('open');
    snoozeDetailOverlay.setAttribute('aria-hidden', 'false');
    renderSnoozeGranularDetail();
  });

  snoozeDetailClose.addEventListener('click', () => {
    snoozeDetailOverlay.classList.remove('open');
    snoozeDetailOverlay.setAttribute('aria-hidden', 'true');
  });

  snoozeDetailOverlay.addEventListener('click', (e) => {
    if (e.target === snoozeDetailOverlay) {
      snoozeDetailOverlay.classList.remove('open');
      snoozeDetailOverlay.setAttribute('aria-hidden', 'true');
    }
  });

  function renderSnoozeGranularDetail() {
    const today = new Date();
    // Assuming _statsMonthOffset is globally accessible from stats module
    const offset = typeof _statsMonthOffset !== 'undefined' ? _statsMonthOffset : 0;
    const viewYear  = today.getFullYear() + Math.floor((today.getMonth() + offset) / 12);
    const viewMonth = ((today.getMonth() + offset) % 12 + 12) % 12;

    let historyItems = [];
    tasks.forEach(t => {
      if (t.snoozedDates && t.snoozedDates.length > 0) {
        let countInMonth = 0;
        t.snoozedDates.forEach(dStr => {
          const d = new Date(dStr);
          if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) countInMonth++;
        });
        if (countInMonth > 0) {
          historyItems.push({ task: t, count: countInMonth });
        }
      }
    });

    historyItems.sort((a, b) => b.count - a.count); // sort by highest snoozed first

    if (historyItems.length === 0) {
      snoozeDetailBody.innerHTML = '<div class="detail-no-subtasks" style="text-align:center; margin-top:20px; color:var(--text-muted);">No hay tareas pospuestas este mes.</div>';
    } else {
      let html = '';
      historyItems.forEach(item => {
        const t = item.task;
        // Fallback safely if escHtml is not in global scope
        const safeTitle = typeof escHtml === 'function' ? escHtml(t.text) : t.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        let metaHtml = '';
        if (typeof getTaskCats === 'function' && typeof CATS !== 'undefined') {
          const taskCats = getTaskCats(t);
          metaHtml += taskCats.map(key => {
            const c = CATS[key] || CATS.otro;
            return `<span class="tag"><span class="tag-dot" style="background:${c.color}"></span>${c.label}</span>`;
          }).join('');
        }
        if (typeof getProjectBadge === 'function') metaHtml += getProjectBadge(t);
        if (typeof getPriLabel === 'function') metaHtml += getPriLabel(t.pri);
        if (typeof getDueBadge === 'function') metaHtml += getDueBadge(t);
        
        html += `
          <div class="snooze-item">
            <div class="snooze-item-top">
              <div class="snooze-item-title">${safeTitle}</div>
              <div class="snooze-item-badge">x${item.count}</div>
            </div>
            ${metaHtml ? `<div class="snooze-item-meta">${metaHtml}</div>` : ''}
          </div>
        `;
      });
      snoozeDetailBody.innerHTML = html;
    }
  }
}

// ── Toggle Magic Input Logic ──
const btnToggleMagic = document.getElementById('btn-toggle-magic');
const magicInputWrap = document.getElementById('magic-input-wrap');

if (btnToggleMagic && magicInputWrap) {
  // Toggle listener
  btnToggleMagic.addEventListener('click', (e) => {
    e.preventDefault();
    magicInputWrap.classList.toggle('hidden');
    if (!magicInputWrap.classList.contains('hidden')) {
      document.getElementById('magic-input-text').focus();
    }
  });

  // Re-hide when form opens to start clean by overriding the original function slightly
  const originalOpenForm = typeof openForm === 'function' ? openForm : null;
  if (originalOpenForm && !window.__magicPatched) {
    window.__magicPatched = true;
    window.openForm = function(initialCat) {
      if (magicInputWrap) magicInputWrap.classList.add('hidden');
      if (document.getElementById('magic-input-text')) {
          document.getElementById('magic-input-text').value = '';
      }
      return originalOpenForm(initialCat);
    };
  }
}
