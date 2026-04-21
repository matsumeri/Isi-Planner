require('dotenv').config();
const express   = require('express');
const path      = require('path');
const { createClient } = require('@libsql/client');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Cliente Turso ─────────────────────────────────────────────────────────────
const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── Inicializar tablas en Turso ───────────────────────────────────────────────
async function initDB() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS month_data (
       year       INTEGER NOT NULL,
       month      INTEGER NOT NULL,
       sueldo     REAL    DEFAULT 0,
       expenses   TEXT    DEFAULT '[]',
       notes      TEXT    DEFAULT '',
       updated_at TEXT    DEFAULT (datetime('now')),
       PRIMARY KEY (year, month)
     )`,
    `CREATE TABLE IF NOT EXISTS expense_templates (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       name       TEXT    NOT NULL,
       category   TEXT    DEFAULT 'general',
       icon       TEXT    DEFAULT '💰',
       sort_order INTEGER DEFAULT 99
     )`,
  ], 'write');

  const { rows } = await db.execute('SELECT COUNT(*) as n FROM expense_templates');
  if (Number(rows[0].n) === 0) {
    const defaults = [
      ['Arriendo',      'vivienda',  '🏠', 1],
      ['Tomas',         'familia',   '👨‍👩‍👧', 2],
      ['Agua',          'servicios', '💧', 3],
      ['Luz',           'servicios', '⚡', 4],
      ['Tarjeta Nac',   'credito',   '💳', 5],
      ['Tarjeta Int',   'credito',   '💳', 6],
      ['Dante',         'familia',   '👦', 7],
      ['Fabiola',       'familia',   '👩', 8],
      ['Todo Movistar', 'telefonia', '📱', 9],
      ['Claro',         'telefonia', '📡', 10],
      ['Claro M',       'telefonia', '📡', 11],
      ['Jessica',       'familia',   '👧', 12],
      ['Casa Avanza',   'credito',   '🏦', 13],
      ['Casa Alanza',   'credito',   '🏦', 14],
      ['Fabiola 2',     'familia',   '👩', 15],
      ['Tricot',        'compras',   '🛍️', 16],
    ];
    await db.batch(
      defaults.map(([name, category, icon, sort_order]) => ({
        sql:  'INSERT INTO expense_templates (name, category, icon, sort_order) VALUES (?, ?, ?, ?)',
        args: [name, category, icon, sort_order],
      })),
      'write'
    );
  }
  console.log('✅ Turso conectado y tablas listas');
}

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API: Mes ──────────────────────────────────────────────────────────────────
app.get('/api/month/:year/:month', async (req, res) => {
  try {
    const y = Number(req.params.year);
    const m = Number(req.params.month);
    const { rows } = await db.execute({ sql: 'SELECT * FROM month_data WHERE year = ? AND month = ?', args: [y, m] });
    if (rows.length > 0) {
      const row = rows[0];
      return res.json({ ...row, year: y, month: m, expenses: JSON.parse(row.expenses) });
    }
    const tpl = await db.execute('SELECT * FROM expense_templates ORDER BY sort_order');
    const expenses = tpl.rows.map(t => ({
      id: `t_${t.id}`, name: t.name, icon: t.icon, category: t.category,
      amount: 0, saldoAnterior: 0, saldoAnteAnterior: 0, paid: false, notes: '',
    }));
    res.json({ year: y, month: m, sueldo: 0, expenses, notes: '' });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/month/:year/:month', async (req, res) => {
  try {
    const y = Number(req.params.year);
    const m = Number(req.params.month);
    const { sueldo, expenses, notes } = req.body;
    await db.execute({
      sql:  `INSERT OR REPLACE INTO month_data (year, month, sueldo, expenses, notes, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [y, m, Number(sueldo) || 0, JSON.stringify(expenses || []), notes || ''],
    });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/months', async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT year, month, sueldo, expenses, updated_at FROM month_data ORDER BY year DESC, month DESC');
    res.json(rows.map(r => ({ ...r, expenses: JSON.parse(r.expenses) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/month/:year/:month/copy-previous', async (req, res) => {
  try {
    const y = Number(req.params.year);
    const m = Number(req.params.month);
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;
    const { rows } = await db.execute({ sql: 'SELECT * FROM month_data WHERE year = ? AND month = ?', args: [prevY, prevM] });
    if (rows.length === 0) return res.status(404).json({ error: 'No existe mes anterior' });
    const prev     = rows[0];
    const expenses = JSON.parse(prev.expenses).map(e => ({ ...e, amount: 0, paid: false }));
    await db.execute({
      sql:  `INSERT OR REPLACE INTO month_data (year, month, sueldo, expenses, notes, updated_at) VALUES (?, ?, ?, ?, '', datetime('now'))`,
      args: [y, m, prev.sueldo, JSON.stringify(expenses)],
    });
    res.json({ year: y, month: m, sueldo: prev.sueldo, expenses, notes: '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/templates', async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM expense_templates ORDER BY sort_order');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/templates', async (req, res) => {
  try {
    const { name, category, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'nombre requerido' });
    const result = await db.execute({ sql: 'INSERT INTO expense_templates (name, category, icon) VALUES (?, ?, ?)', args: [name, category || 'general', icon || '💰'] });
    res.json({ id: Number(result.lastInsertRowid), name, category, icon });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM expense_templates WHERE id = ?', args: [Number(req.params.id)] });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: CGE Luz ──────────────────────────────────────────────────────────────
app.post('/api/luz-deuda', async (req, res) => {
  const ctaCto = (req.body && req.body.cta_cto) || '2249414';
  try {
    const response = await fetch('https://orchestrator-portalescge-prd.lfr.cloud/consultarDeudaPorCuentaContrato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ITEM: { CANAL: 'OVIRTUAL', CTA_CTO: ctaCto }, url: 'OFVCGE_P' }),
    });
    if (!response.ok) return res.status(response.status).json({ success: false, error: `CGE respondió con estado ${response.status}` });
    const data  = await response.json();
    const monto = extractAmount(data);
    res.json({ success: true, data, monto });
  } catch (err) { res.status(502).json({ success: false, error: err.message }); }
});

// ── API: Aguas Andinas ────────────────────────────────────────────────────────
app.post('/api/agua-deuda', async (req, res) => {
  const clienteId = (req.body && req.body.cliente_id) || '96697-5';
  for (const ep of [
    { url: 'https://clientes.aguasandinas.cl/api/v1/deuda', body: { cliente: clienteId } },
    { url: 'https://api.aguasandinas.cl/consultarDeuda',    body: { numeroCliente: clienteId } },
  ]) {
    try {
      const r = await fetch(ep.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ep.body), signal: AbortSignal.timeout(6000) });
      if (r.ok) { const data = await r.json(); return res.json({ success: true, data, monto: extractAmount(data) }); }
    } catch { /* continuar */ }
  }
  res.json({ success: false, manual: true, error: 'API de Aguas Andinas no disponible. Ingresa el monto manualmente.', portal: 'https://clientes.aguasandinas.cl', clienteId });
});

// ── Helper: extraer monto ─────────────────────────────────────────────────────
function extractAmount(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;
  for (const key of ['MONTO_TOTAL','TOTAL_DEUDA','totalDeuda','monto','amount','AMOUNT','deuda','DEUDA','SALDO','saldo','TOTAL','total','MONTO','valor','VALOR']) {
    if (obj[key] !== undefined) { const val = parseFloat(String(obj[key]).replace(/[^0-9.-]/g, '')); if (!isNaN(val) && val > 0) return val; }
  }
  for (const val of Object.values(obj)) { if (typeof val === 'object') { const found = extractAmount(val, depth + 1); if (found !== null) return found; } }
  return null;
}

// ── Arrancar ──────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`\n🚀 ISI Planner → http://localhost:${PORT}\n`));
}).catch(err => {
  console.error('❌ Error conectando a Turso:', err.message);
  process.exit(1);
});
