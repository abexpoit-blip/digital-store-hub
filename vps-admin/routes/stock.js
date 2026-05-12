const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { db, logAudit } = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const byCategory = db.prepare(
    'SELECT category, COUNT(*) AS c FROM stock GROUP BY category ORDER BY c DESC'
  ).all();

  const recent = db.prepare(
    'SELECT id, category, substr(data,1,80) AS preview FROM stock ORDER BY id DESC LIMIT 50'
  ).all();

  res.render('stock', { byCategory, recent, preview: null, msg: req.query.msg || null });
});

// Upload xlsx — preview rows
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/stock?msg=No+file');
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Expect headers: category, data    (or just two columns A, B)
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const normalized = rows.map(r => {
    const keys = Object.keys(r);
    const cat = (r.category ?? r.Category ?? r[keys[0]] ?? '').toString().trim();
    const data = (r.data ?? r.Data ?? r[keys[1]] ?? '').toString().trim();
    return { category: cat, data };
  }).filter(r => r.category && r.data);

  // Stash to session for confirm step
  req.session.pendingStock = normalized;
  res.render('stock', {
    byCategory: db.prepare('SELECT category, COUNT(*) AS c FROM stock GROUP BY category ORDER BY c DESC').all(),
    recent: db.prepare('SELECT id, category, substr(data,1,80) AS preview FROM stock ORDER BY id DESC LIMIT 50').all(),
    preview: normalized.slice(0, 200),
    previewCount: normalized.length,
    msg: null
  });
});

router.post('/confirm', (req, res) => {
  const pending = req.session.pendingStock || [];
  if (!pending.length) return res.redirect('/stock?msg=Nothing+to+confirm');

  const insert = db.prepare('INSERT INTO stock (category, data) VALUES (?, ?)');
  const tx = db.transaction((items) => {
    for (const it of items) insert.run(it.category, it.data);
  });
  tx(pending);

  logAudit('admin', 'stock_upload', `count=${pending.length}`);
  req.session.pendingStock = null;
  res.redirect('/stock?msg=' + encodeURIComponent(`✅ ${pending.length} items added`));
});

router.post('/cancel', (req, res) => {
  req.session.pendingStock = null;
  res.redirect('/stock?msg=Upload+cancelled');
});

router.post('/manual', (req, res) => {
  const category = (req.body.category || '').trim();
  const lines = (req.body.data || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!category || !lines.length) return res.redirect('/stock?msg=Empty');

  const insert = db.prepare('INSERT INTO stock (category, data) VALUES (?, ?)');
  const tx = db.transaction((items) => { for (const d of items) insert.run(category, d); });
  tx(lines);
  logAudit('admin', 'stock_manual', `category=${category} count=${lines.length}`);
  res.redirect('/stock?msg=' + encodeURIComponent(`✅ ${lines.length} items added to ${category}`));
});

router.post('/clear/:category', (req, res) => {
  const cat = req.params.category;
  const result = db.prepare('DELETE FROM stock WHERE category = ?').run(cat);
  logAudit('admin', 'stock_clear', `category=${cat} deleted=${result.changes}`);
  res.redirect('/stock?msg=' + encodeURIComponent(`Cleared ${result.changes} from ${cat}`));
});

module.exports = router;
