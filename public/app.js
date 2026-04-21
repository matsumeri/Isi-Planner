/* =====================================================================
   ISI Planner — app.js  (lógica principal)
   ===================================================================== */

'use strict';

// ── Constantes ────────────────────────────────────────────────────────────────
const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const CATEGORY_LABELS = {
  vivienda:  '🏠 Vivienda',
  servicios: '⚡ Servicios',
  credito:   '💳 Crédito',
  telefonia: '📱 Telefonía',
  familia:   '👨‍👩‍👧 Familia',
  compras:   '🛍️ Compras',
  general:   '💰 General',
};

// Plantilla de gastos predeterminados (igual al servidor)
const DEFAULT_EXPENSES = [
  { id: 't_1',  name: 'Arriendo',      icon: '🏠', category: 'vivienda',  amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_2',  name: 'Tomas',         icon: '👨‍👩‍👧', category: 'familia',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_3',  name: 'Agua',          icon: '💧', category: 'servicios', amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_4',  name: 'Luz',           icon: '⚡', category: 'servicios', amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_5',  name: 'Tarjeta Nac',   icon: '💳', category: 'credito',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_6',  name: 'Tarjeta Int',   icon: '💳', category: 'credito',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_7',  name: 'Dante',         icon: '👦', category: 'familia',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_8',  name: 'Fabiola',       icon: '👩', category: 'familia',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_9',  name: 'Todo Movistar', icon: '📱', category: 'telefonia', amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_10', name: 'Claro',         icon: '📡', category: 'telefonia', amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_11', name: 'Claro M',       icon: '📡', category: 'telefonia', amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_12', name: 'Jessica',       icon: '👧', category: 'familia',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_13', name: 'Casa Avanza',   icon: '🏦', category: 'credito',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_14', name: 'Casa Alanza',   icon: '🏦', category: 'credito',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_15', name: 'Fabiola 2',     icon: '👩', category: 'familia',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
  { id: 't_16', name: 'Tricot',        icon: '🛍️', category: 'compras',   amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '' },
];

// Gastos que tienen botón de consulta API
const API_TYPES = {
  luz:  { name: 'Luz',  keywords: ['luz', 'cge', 'electricidad', 'electr', 'light'] },
  agua: { name: 'Agua', keywords: ['agua', 'aguas', 'water', 'andinas'] },
};

// ── Estado global ─────────────────────────────────────────────────────────────
let state = {
  year:     new Date().getFullYear(),
  month:    new Date().getMonth() + 1,
  sueldo:   0,
  expenses: [],
  notes:    '',
};
let activeFilter    = 'all';
let editingExpense  = null;   // ID del gasto en edición
let currentApiExpId = null;   // ID del gasto cuya API se está consultando
let saveTimer       = null;
const IS_GITHUB_PAGES = window.location.hostname.endsWith('github.io');
let deferredInstallPrompt = null;

async function apiFetch(path, options) {
  if (IS_GITHUB_PAGES) {
    throw new Error('API no disponible en GitHub Pages');
  }
  return fetch(path, options);
}

// ── Inicialización ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupInstallPrompt();
  registerSW();
  bindStaticEvents();
  await loadMonth(state.year, state.month);
  renderAll();
});

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showToast('ISI Planner instalada en tu pantalla de inicio', 'success');
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    const swPath = window.location.pathname.includes('/public/') ? '../sw.js' : './sw.js';
    navigator.serviceWorker.register(swPath).catch(() => {});
  }
}

// ── localStorage helpers ─────────────────────────────────────────────────────
function lsKey(year, month) { return `isi_${year}_${String(month).padStart(2,'0')}`; }

function lsSave(year, month, data) {
  try { localStorage.setItem(lsKey(year, month), JSON.stringify(data)); } catch {}
}

function lsLoad(year, month) {
  try {
    const raw = localStorage.getItem(lsKey(year, month));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Carga / guardado de datos ─────────────────────────────────────────────────
async function loadMonth(year, month) {
  if (IS_GITHUB_PAGES) {
    const cached = lsLoad(year, month);
    if (cached && Array.isArray(cached.expenses) && cached.expenses.length > 0) {
      state = { ...state, ...cached, year, month };
      showToast('Modo GitHub Pages — datos locales', 'info');
      return;
    }
    state = { ...state, year, month, sueldo: 0, expenses: DEFAULT_EXPENSES.map(e => ({ ...e })), notes: '' };
    showToast('Sin conexión — plantilla de gastos cargada', 'info');
    return;
  }

  // 1. Intentar desde servidor
  try {
    const res  = await apiFetch(`/api/month/${year}/${month}`);
    if (res.ok) {
      const data = await res.json();
      // Si el servidor devuelve expenses válidas, usarlas
      if (Array.isArray(data.expenses)) {
        // Si es mes nuevo sin gastos, usar plantilla predeterminada
        const expenses = data.expenses.length > 0 ? data.expenses : DEFAULT_EXPENSES.map(e => ({ ...e }));
        const merged   = { ...data, expenses, year, month };
        state = { ...state, ...merged };
        lsSave(year, month, merged);   // guardar en caché local
        return;
      }
    }
  } catch { /* sin red */ }

  // 2. Fallback a localStorage
  const cached = lsLoad(year, month);
  if (cached) {
    state = { ...state, ...cached, year, month };
    showToast('Modo sin conexión — datos locales', 'info');
    return;
  }

  // 3. Mes completamente nuevo sin conexión → plantilla en blanco
  state = { ...state, year, month, sueldo: 0, expenses: DEFAULT_EXPENSES.map(e => ({ ...e })), notes: '' };
  showToast('Sin conexión — plantilla de gastos cargada', 'info');
}

async function saveMonth() {
  const payload = { sueldo: state.sueldo, expenses: state.expenses, notes: state.notes };
  // Siempre guardar en localStorage primero
  lsSave(state.year, state.month, { ...payload, year: state.year, month: state.month });
  // Luego intentar sincronizar con servidor
  try {
    await apiFetch(`/api/month/${state.year}/${state.month}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch {
    // Sin red: ya se guardó en localStorage, se sincronizará luego
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveMonth, 800);
}

// ── Navegación de meses ───────────────────────────────────────────────────────
function changeMonth(delta) {
  let { year, month } = state;
  month += delta;
  if (month > 12) { month = 1;  year++; }
  if (month < 1)  { month = 12; year--; }
  state.year  = year;
  state.month = month;
  loadMonth(year, month).then(renderAll);
}

// ── Render principal ──────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderSummary();
  renderExpenses();
  renderNotes();
}

function renderHeader() {
  const label = `${MONTHS_ES[state.month - 1]} ${state.year}`;
  document.getElementById('month-label-btn').textContent = label;
  document.title = `ISI Planner — ${label}`;
}

function renderSummary() {
  const totGastos    = calcTotalGastos();
  const disponible   = state.sueldo - totGastos;
  const pct          = state.sueldo > 0 ? (totGastos / state.sueldo) * 100 : 0;
  const pctClamped   = Math.min(pct, 100);

  document.getElementById('sueldo-display').textContent   = formatCLP(state.sueldo);
  document.getElementById('total-gastos').textContent     = formatCLP(totGastos);
  document.getElementById('total-disponible').textContent = formatCLP(disponible);
  document.getElementById('gastos-percent').textContent   = `${pct.toFixed(0)}%`;

  const fill = document.getElementById('progress-fill');
  fill.style.width = `${pctClamped}%`;
  fill.classList.toggle('danger', pct > 85);

  document.getElementById('progress-text').textContent      = `${pct.toFixed(1)}% gastado`;
  document.getElementById('progress-remaining').textContent = disponible >= 0
    ? `${formatCLP(disponible)} disponible`
    : `${formatCLP(Math.abs(disponible))} sobre el sueldo`;

  const balCard = document.getElementById('total-disponible').closest('.summary-card');
  balCard.classList.toggle('negative', disponible < 0);
}

function calcTotalGastos() {
  return state.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

function renderExpenses() {
  const list = document.getElementById('expenses-list');
  list.innerHTML = '';

  if (!Array.isArray(state.expenses) || state.expenses.length === 0) {
    state.expenses = DEFAULT_EXPENSES.map(e => ({ ...e }));
  }

  const filtered = activeFilter === 'all'
    ? state.expenses
    : state.expenses.filter(e => e.category === activeFilter);

  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)">Sin gastos en esta categoría</div>`;
    return;
  }

  filtered.forEach(exp => {
    const row = buildExpenseRow(exp);
    list.appendChild(row);
  });
}

function buildExpenseRow(exp) {
  const div = document.createElement('div');
  div.className = `expense-row${exp.paid ? ' paid' : ''}`;
  div.dataset.id = exp.id;

  // Detectar tipo de API
  const apiType = detectApiType(exp);

  // Saldos anteriores (solo Luz)
  let saldosHtml = '';
  if (exp.saldoAnterior || exp.saldoAnteAnterior) {
    const parts = [];
    if (exp.saldoAnterior)    parts.push(`Sal. ant: ${formatCLP(exp.saldoAnterior)}`);
    if (exp.saldoAnteAnterior) parts.push(`Sal. ant-ant: ${formatCLP(exp.saldoAnteAnterior)}`);
    saldosHtml = `<div class="expense-saldos">${parts.join(' · ')}</div>`;
  }

  const metaHtml = CATEGORY_LABELS[exp.category]
    ? `<div class="expense-meta">${CATEGORY_LABELS[exp.category]}${exp.notes ? ' · ' + exp.notes : ''}</div>`
    : '';

  const apiBtn = apiType
    ? `<button class="action-btn api-btn" data-api="${apiType}" title="Consultar deuda ${apiType === 'luz' ? 'CGE' : 'Aguas Andinas'}">
         ${apiType === 'luz' ? '⚡' : '💧'}
       </button>`
    : '';

  div.innerHTML = `
    <div class="expense-icon">${exp.icon || '💰'}</div>
    <div class="expense-info">
      <div class="expense-name">${escHtml(exp.name)}</div>
      ${metaHtml}
      ${saldosHtml}
    </div>
    <div class="expense-amount ${!exp.amount ? 'zero' : ''}">${exp.amount ? formatCLP(exp.amount) : '—'}</div>
    <div class="expense-actions">
      ${apiBtn}
      <button class="action-btn paid-btn ${exp.paid ? 'is-paid' : ''}" title="${exp.paid ? 'Marcar como pendiente' : 'Marcar como pagado'}">
        ${exp.paid ? '✅' : '○'}
      </button>
      <button class="action-btn edit-btn" title="Editar">✏️</button>
    </div>
    <div class="paid-badge">Pagado</div>
  `;

  // Botones de la fila
  div.querySelector('.paid-btn').addEventListener('click', () => togglePaid(exp.id));
  div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(exp.id));
  if (apiType) {
    div.querySelector('.api-btn').addEventListener('click', () => openApiModal(apiType, exp.id));
  }

  return div;
}

function detectApiType(exp) {
  const name = (exp.name || '').toLowerCase();
  for (const [type, cfg] of Object.entries(API_TYPES)) {
    if (cfg.keywords.some(k => name.includes(k))) return type;
  }
  return null;
}

function renderNotes() {
  document.getElementById('notes-input').value = state.notes || '';
}

// ── Eventos de gastos ─────────────────────────────────────────────────────────
function togglePaid(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;
  exp.paid = !exp.paid;
  renderExpenses();
  renderSummary();
  scheduleSave();
}

// ── Modal: Editar/Agregar Gasto ───────────────────────────────────────────────
function openAddModal() {
  editingExpense = null;
  document.getElementById('expense-modal-title').textContent = '➕ Agregar Gasto';
  document.getElementById('expense-name').value         = '';
  document.getElementById('expense-amount').value       = '';
  document.getElementById('expense-notes').value        = '';
  document.getElementById('expense-paid').checked       = false;
  document.getElementById('expense-saldo-ant').value    = '';
  document.getElementById('expense-saldo-ant-ant').value= '';
  document.getElementById('expense-extra-fields').checked = false;
  document.getElementById('extra-fields-group').style.display = 'none';
  document.getElementById('delete-expense-btn').style.display = 'none';
  setSelectedIcon('💰');
  document.getElementById('expense-category').value = 'general';
  openModal('expense-modal');
}

function openEditModal(id) {
  editingExpense = id;
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('expense-modal-title').textContent = '✏️ Editar Gasto';
  document.getElementById('expense-name').value          = exp.name || '';
  document.getElementById('expense-amount').value        = exp.amount ? formatRaw(exp.amount) : '';
  document.getElementById('expense-notes').value         = exp.notes || '';
  document.getElementById('expense-paid').checked        = !!exp.paid;
  document.getElementById('expense-saldo-ant').value     = exp.saldoAnterior ? formatRaw(exp.saldoAnterior) : '';
  document.getElementById('expense-saldo-ant-ant').value = exp.saldoAnteAnterior ? formatRaw(exp.saldoAnteAnterior) : '';

  const hasExtra = !!(exp.saldoAnterior || exp.saldoAnteAnterior);
  document.getElementById('expense-extra-fields').checked = hasExtra;
  document.getElementById('extra-fields-group').style.display = hasExtra ? 'flex' : 'none';
  document.getElementById('delete-expense-btn').style.display = 'inline-flex';
  setSelectedIcon(exp.icon || '💰');
  document.getElementById('expense-category').value = exp.category || 'general';
  openModal('expense-modal');
}

function saveExpense() {
  const name    = document.getElementById('expense-name').value.trim();
  const amtRaw  = parseCLP(document.getElementById('expense-amount').value);
  const icon    = document.querySelector('.icon-opt.selected')?.dataset.icon || '💰';
  const cat     = document.getElementById('expense-category').value;
  const notes   = document.getElementById('expense-notes').value.trim();
  const paid    = document.getElementById('expense-paid').checked;
  const hasExtra= document.getElementById('expense-extra-fields').checked;
  const saldoAnt    = hasExtra ? parseCLP(document.getElementById('expense-saldo-ant').value)     : 0;
  const saldoAntAnt = hasExtra ? parseCLP(document.getElementById('expense-saldo-ant-ant').value) : 0;

  if (!name) { showToast('El nombre es obligatorio', 'error'); return; }

  if (editingExpense) {
    const exp = state.expenses.find(e => e.id === editingExpense);
    if (exp) Object.assign(exp, { name, amount: amtRaw, icon, category: cat, notes, paid, saldoAnterior: saldoAnt, saldoAnteAnterior: saldoAntAnt });
  } else {
    state.expenses.push({
      id: `e_${Date.now()}`,
      name, amount: amtRaw, icon, category: cat, notes, paid,
      saldoAnterior: saldoAnt, saldoAnteAnterior: saldoAntAnt,
    });
  }

  closeModal('expense-modal');
  renderExpenses();
  renderSummary();
  scheduleSave();
  showToast(editingExpense ? 'Gasto actualizado' : 'Gasto agregado', 'success');
}

function deleteExpense() {
  if (!editingExpense) return;
  if (!confirm('¿Eliminar este gasto?')) return;
  state.expenses = state.expenses.filter(e => e.id !== editingExpense);
  closeModal('expense-modal');
  renderExpenses();
  renderSummary();
  scheduleSave();
  showToast('Gasto eliminado', 'info');
}

// ── Modal: Sueldo ─────────────────────────────────────────────────────────────
function openSueldoModal() {
  document.getElementById('sueldo-input').value = formatRaw(state.sueldo);
  openModal('sueldo-modal');
  setTimeout(() => document.getElementById('sueldo-input').focus(), 50);
}

function saveSueldo() {
  const val = parseCLP(document.getElementById('sueldo-input').value);
  state.sueldo = val;
  closeModal('sueldo-modal');
  renderSummary();
  scheduleSave();
  showToast('Sueldo actualizado', 'success');
}

// ── Modal: API Luz ────────────────────────────────────────────────────────────
function openApiModal(type, expId) {
  currentApiExpId = expId;
  if (type === 'luz') {
    document.getElementById('luz-result').classList.add('hidden');
    document.getElementById('luz-error').classList.add('hidden');
    document.getElementById('luz-raw-json').classList.add('hidden');
    document.getElementById('luz-monto-manual').value = '';
    openModal('luz-modal');
  } else {
    document.getElementById('agua-result').classList.add('hidden');
    document.getElementById('agua-error').classList.add('hidden');
    document.getElementById('agua-monto-manual').value = '';
    openModal('agua-modal');
  }
}

async function fetchLuzDeuda() {
  const ctaCto  = document.getElementById('luz-cta-cto').value.trim();
  const btn     = document.getElementById('fetch-luz-btn');
  const resultEl= document.getElementById('luz-result');
  const errEl   = document.getElementById('luz-error');
  const cardEl  = document.getElementById('luz-result-card');
  const rawEl   = document.getElementById('luz-raw-json');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Consultando…';
  resultEl.classList.add('hidden');
  errEl.classList.add('hidden');

  try {
    const res  = await apiFetch('/api/luz-deuda', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cta_cto: ctaCto }),
    });
    const json = await res.json();

    if (!json.success) {
      errEl.textContent = json.error || 'Error consultando CGE';
      errEl.classList.remove('hidden');
      return;
    }

    // Mostrar resultado
    const monto = json.monto;
    cardEl.innerHTML = buildResultRows(json.data, monto);
    rawEl.textContent = JSON.stringify(json.data, null, 2);

    if (monto !== null) {
      document.getElementById('luz-monto-manual').value = formatRaw(monto);
    }

    resultEl.classList.remove('hidden');
    showToast('Deuda CGE consultada', 'success');
  } catch (e) {
    errEl.textContent = `Error de conexión: ${e.message}`;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 Consultar deuda en CGE';
  }
}

async function fetchAguaDeuda() {
  const clienteId = document.getElementById('agua-cliente-id').value.trim();
  const btn       = document.getElementById('fetch-agua-btn');
  const resultEl  = document.getElementById('agua-result');
  const errEl     = document.getElementById('agua-error');
  const cardEl    = document.getElementById('agua-result-card');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Consultando…';
  resultEl.classList.add('hidden');
  errEl.classList.add('hidden');

  try {
    const res  = await apiFetch('/api/agua-deuda', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cliente_id: clienteId }),
    });
    const json = await res.json();

    if (json.manual || !json.success) {
      errEl.querySelector('p').textContent = json.error || 'API no disponible';
      errEl.classList.remove('hidden');
      return;
    }

    const monto = json.monto;
    cardEl.innerHTML = buildResultRows(json.data, monto);
    if (monto !== null) {
      document.getElementById('agua-monto-manual').value = formatRaw(monto);
    }
    resultEl.classList.remove('hidden');
    showToast('Deuda Aguas Andinas consultada', 'success');
  } catch (e) {
    errEl.querySelector('p').textContent = `Error: ${e.message}`;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 Consultar deuda';
  }
}

function buildResultRows(data, monto) {
  const rows = [];
  if (monto !== null) {
    rows.push(`<div class="result-row"><span class="label">💰 Deuda total</span><span class="value monto">${formatCLP(monto)}</span></div>`);
  }
  // Extraer campos interesantes del objeto
  const interestingKeys = ['FECHA_VENCIMIENTO','fecha_vencimiento','vencimiento','VENCIMIENTO',
    'PERIODO','periodo','LECTURA','lectura','CONSUMO','consumo',
    'NOM_CLIENTE','nombre','NOMBRE','ESTADO','estado','status','STATUS'];
  if (data && typeof data === 'object') {
    flattenObject(data).forEach(([k, v]) => {
      if (interestingKeys.some(ik => k.toUpperCase().includes(ik.toUpperCase().slice(0,6)))) {
        rows.push(`<div class="result-row"><span class="label">${k}</span><span class="value">${v}</span></div>`);
      }
    });
  }
  if (rows.length === 0) {
    rows.push('<div class="result-row"><span class="label">Sin datos parseables. Ver respuesta completa.</span></div>');
  }
  return rows.join('');
}

function flattenObject(obj, prefix = '', result = []) {
  if (typeof obj !== 'object' || obj === null) return result;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      flattenObject(v, key, result);
    } else {
      result.push([key, v]);
    }
  }
  return result;
}

function applyLuzMonto() {
  const monto = parseCLP(document.getElementById('luz-monto-manual').value);
  if (!monto && monto !== 0) { showToast('Ingresa un monto', 'error'); return; }
  applyMontoToExpense(currentApiExpId, monto);
  closeModal('luz-modal');
}

function applyAguaMonto() {
  const monto = parseCLP(document.getElementById('agua-monto-manual').value);
  if (!monto && monto !== 0) { showToast('Ingresa un monto', 'error'); return; }
  applyMontoToExpense(currentApiExpId, monto);
  closeModal('agua-modal');
}

function applyMontoToExpense(id, monto) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;
  exp.amount = monto;
  renderExpenses();
  renderSummary();
  scheduleSave();
  showToast(`Monto actualizado: ${formatCLP(monto)}`, 'success');
}

// ── Historial ─────────────────────────────────────────────────────────────────
async function openHistory() {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '<div style="text-align:center;padding:1rem"><span class="spinner"></span></div>';
  openModal('history-modal');

  try {
    const res   = await apiFetch('/api/months');
    const months= await res.json();

    if (months.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem">Sin historial aún</div>';
      return;
    }

    listEl.innerHTML = '';
    months.forEach(m => {
      const totGastos = (m.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
      const disp      = (m.sueldo || 0) - totGastos;
      const item      = document.createElement('div');
      item.className  = 'history-item';
      item.innerHTML  = `
        <div>
          <div class="month-name">${MONTHS_ES[m.month - 1]} ${m.year}</div>
          <div class="month-stats">Sueldo: ${formatCLP(m.sueldo)} · ${(m.expenses || []).length} gastos</div>
        </div>
        <div>
          <div class="month-balance ${disp < 0 ? 'neg' : ''}">${formatCLP(disp)}</div>
          <div style="font-size:0.7rem;color:var(--text-muted);text-align:right">disponible</div>
        </div>
      `;
      item.addEventListener('click', () => {
        state.year  = m.year;
        state.month = m.month;
        closeModal('history-modal');
        loadMonth(m.year, m.month).then(renderAll);
      });
      listEl.appendChild(item);
    });
  } catch {
    listEl.innerHTML = '<div style="color:var(--danger);padding:1rem">Error cargando historial</div>';
  }
}

// ── Copiar mes anterior ───────────────────────────────────────────────────────
async function copyPreviousMonth() {
  if (!confirm('¿Copiar la estructura de gastos del mes anterior?')) return;
  try {
    const res  = await apiFetch(`/api/month/${state.year}/${state.month}/copy-previous`, { method: 'POST' });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    state = { ...state, ...data };
    renderAll();
    showToast('Gastos copiados del mes anterior', 'success');
  } catch {
    showToast('Error copiando mes anterior', 'error');
  }
}

// ── Instalar app / Exportar ──────────────────────────────────────────────────
async function handleInstallOrExport() {
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    showToast('La app ya está instalada', 'info');
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (choice && choice.outcome === 'accepted') {
      showToast('Instalando ISI Planner...', 'success');
    }
    return;
  }

  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  if (isIOS) {
    showToast('En iPhone: Compartir -> Agregar a pantalla de inicio', 'info');
    return;
  }

  if (isMobile) {
    showToast('En Android: menu del navegador -> Instalar app', 'info');
    return;
  }

  window.print();
}

// ── Tema ──────────────────────────────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.body.classList.toggle('light');
  const themeColor = document.getElementById('meta-theme');
  themeColor.content = isDark ? '#6366f1' : '#0f172a';
  // isDark significa que ahora es light (toggle invierte)
  localStorage.setItem('isi-theme', document.body.classList.contains('light') ? 'light' : 'dark');
}

function applyStoredTheme() {
  const stored = localStorage.getItem('isi-theme') || 'dark';
  if (stored === 'light') document.body.classList.add('light');
}

// ── Helpers de formato ────────────────────────────────────────────────────────
function formatCLP(n) {
  return new Intl.NumberFormat('es-CL', {
    style:                 'currency',
    currency:              'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function formatRaw(n) {
  // Sin símbolo ni separador de miles (para inputs)
  return Math.round(n || 0).toString();
}

function parseCLP(str) {
  if (str === undefined || str === null || str === '') return 0;
  const cleaned = String(str).replace(/[^0-9-]/g, '');
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? 0 : Math.max(0, val);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Helpers de modales ────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function setSelectedIcon(icon) {
  document.querySelectorAll('.icon-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.icon === icon);
  });
}

// ── Toasts ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${escHtml(msg)}`;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Bind de eventos estáticos ─────────────────────────────────────────────────
function bindStaticEvents() {
  applyStoredTheme();

  // Navegación de meses
  document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => changeMonth(+1));
  document.getElementById('month-label-btn').addEventListener('click', () => goToCurrentMonth());

  // Acciones del header
  document.getElementById('history-btn').addEventListener('click', openHistory);
  document.getElementById('copy-prev-btn').addEventListener('click', copyPreviousMonth);
  document.getElementById('export-btn').addEventListener('click', handleInstallOrExport);
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);

  // Sueldo
  document.getElementById('edit-sueldo-btn').addEventListener('click', openSueldoModal);
  document.getElementById('sueldo-card').addEventListener('dblclick', openSueldoModal);
  document.getElementById('save-sueldo-btn').addEventListener('click', saveSueldo);
  document.getElementById('sueldo-input').addEventListener('keydown', e => { if (e.key === 'Enter') saveSueldo(); });

  // Modal gasto
  document.getElementById('add-expense-btn').addEventListener('click', openAddModal);
  document.getElementById('save-expense-btn').addEventListener('click', saveExpense);
  document.getElementById('delete-expense-btn').addEventListener('click', deleteExpense);
  document.getElementById('expense-extra-fields').addEventListener('change', e => {
    document.getElementById('extra-fields-group').style.display = e.target.checked ? 'flex' : 'none';
  });

  // Ícono picker
  document.getElementById('icon-picker').addEventListener('click', e => {
    const opt = e.target.closest('.icon-opt');
    if (!opt) return;
    document.querySelectorAll('.icon-opt').forEach(el => el.classList.remove('selected'));
    opt.classList.add('selected');
  });

  // APIs
  document.getElementById('fetch-luz-btn').addEventListener('click', fetchLuzDeuda);
  document.getElementById('apply-luz-btn').addEventListener('click', applyLuzMonto);
  document.getElementById('fetch-agua-btn').addEventListener('click', fetchAguaDeuda);
  document.getElementById('apply-agua-btn').addEventListener('click', applyAguaMonto);

  // Raw JSON toggle
  document.getElementById('toggle-luz-raw').addEventListener('click', () => {
    document.getElementById('luz-raw-json').classList.toggle('hidden');
  });

  // Filtros de categoría
  document.getElementById('category-filters').addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.cat;
    renderExpenses();
  });

  // Cerrar modales con botones genéricos
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // Cerrar modal al click en overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Notas
  document.getElementById('notes-input').addEventListener('input', e => {
    state.notes = e.target.value;
    scheduleSave();
  });

  // Inputs CLP: formatear al perder foco
  document.addEventListener('focusout', e => {
    if (e.target.classList.contains('clp-input')) {
      const raw = parseCLP(e.target.value);
      e.target.value = raw > 0 ? formatRaw(raw) : '';
    }
  });

  // Tecla Escape cierra modales
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => closeModal(m.id));
    }
  });
}

function goToCurrentMonth() {
  const now = new Date();
  state.year  = now.getFullYear();
  state.month = now.getMonth() + 1;
  loadMonth(state.year, state.month).then(renderAll);
}
