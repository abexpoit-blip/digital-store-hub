const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { db, logAudit } = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function getCategories() {
  // Bot এর existing categories from stock table
  return db.prepare('SELECT category, COUNT(*) AS c FROM stock GROUP BY category ORDER BY category ASC').all();
}

function renderPage(extra = {}) {
  const byCategory = getCategories();
  const recent = db.prepare('SELECT id, category, substr(data,1,80) AS preview FROM stock ORDER BY id DESC LIMIT 50').all();
  return {
    byCategory,
    categories: byCategory.map(c => c.category),
    recent,
    preview: null,
    previewCount: 0,
    previewByCat: {},
    msg: null,
    ...extra,
  };
}

router.get('/', (req, res) => {
  res.render('stock', renderPage({ msg: req.query.msg || null }));
});

// Upload xlsx — preview rows
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/stock?msg=No+file');

  const mode = req.body.mode || 'single'; // 'single' or 'multi'
  const selectedCat = (req.body.category || '').trim();
  const newCat = (req.body.new_category || '').trim();
  const targetCategory = newCat || selectedCat;

  if (mode === 'single' && !targetCategory) {
    return res.redirect('/stock?msg=' + encodeURIComponent('❌ Single mode এ category select করুন'));
  }

  let wb;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (e) {
    return res.redirect('/stock?msg=' + encodeURIComponent('❌ Invalid Excel file: ' + e.message));
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Read as array-of-arrays so we don't depend on header names
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let normalized = [];
  if (mode === 'single') {
    // Every cell in column A becomes a stock entry under targetCategory.
    // Skip first row if it looks like a header (e.g. "data", "id", "category").
    const headerRe = /^(data|id|category|stock|item|value)$/i;
    let startIdx = 0;
    if (rows.length && rows[0][0] && headerRe.test(String(rows[0][0]).trim())) startIdx = 1;
    for (let i = startIdx; i < rows.length; i++) {
      const v = (rows[i][0] ?? '').toString().trim();
      if (v) normalized.push({ category: targetCategory, data: v });
    }
  } else {
    // Multi mode: column A = category, column B = data. Skip header row.
    let startIdx = 0;
    if (rows.length && /^category$/i.test(String(rows[0][0] || '').trim())) startIdx = 1;
    for (let i = startIdx; i < rows.length; i++) {
      const c = (rows[i][0] ?? '').toString().trim();
      const d = (rows[i][1] ?? '').toString().trim();
      if (c && d) normalized.push({ category: c, data: d });
    }
  }

  if (!normalized.length) {
    return res.redirect('/stock?msg=' + encodeURIComponent('❌ Excel এ valid data পাওয়া যায়নি'));
  }

  // Duplicate detection — check against existing stock
  const existSet = new Set(
    db.prepare('SELECT data FROM stock').all().map(r => r.data)
  );
  let duplicates = 0;
  const seen = new Set();
  const unique = [];
  for (const item of normalized) {
    const key = item.category + '||' + item.data;
    if (existSet.has(item.data) || seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    unique.push(item);
  }

  // Group preview by category
  const previewByCat = {};
  unique.forEach(it => { previewByCat[it.category] = (previewByCat[it.category] || 0) + 1; });

  req.session.pendingStock = unique;

  res.render('stock', renderPage({
    preview: unique.slice(0, 200),
    previewCount: unique.length,
    previewByCat,
    duplicates,
    msg: duplicates > 0 ? `ℹ️ ${duplicates} duplicate skip হয়েছে` : null,
  }));
});

router.post('/confirm', (req, res) => {
  const pending = req.session.pendingStock || [];
  if (!pending.length) return res.redirect('/stock?msg=Nothing+to+confirm');

  const insert = db.prepare('INSERT INTO stock (category, data) VALUES (?, ?)');
  const tx = db.transaction((items) => {
    for (const it of items) insert.run(it.category, it.data);
  });
  tx(pending);

  // Per-category breakdown for audit
  const breakdown = {};
  pending.forEach(p => { breakdown[p.category] = (breakdown[p.category] || 0) + 1; });
  const summary = Object.entries(breakdown).map(([k, v]) => `${k}:${v}`).join(', ');

  logAudit('admin', 'stock_upload', `total=${pending.length} (${summary})`);
  req.session.pendingStock = null;
  res.redirect('/stock?msg=' + encodeURIComponent(`✅ ${pending.length} items added (${summary})`));
});

router.post('/cancel', (req, res) => {
  req.session.pendingStock = null;
  res.redirect('/stock?msg=Upload+cancelled');
});

router.post('/manual', (req, res) => {
  const selectedCat = (req.body.category || '').trim();
  const newCat = (req.body.new_category || '').trim();
  const category = newCat || selectedCat;
  const lines = (req.body.data || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!category || !lines.length) {
    return res.redirect('/stock?msg=' + encodeURIComponent('❌ Category এবং data দুটোই লাগবে'));
  }

  // De-duplicate against existing stock
  const existSet = new Set(db.prepare('SELECT data FROM stock').all().map(r => r.data));
  const unique = lines.filter(d => !existSet.has(d));
  const duplicates = lines.length - unique.length;

  if (!unique.length) {
    return res.redirect('/stock?msg=' + encodeURIComponent(`❌ সব ${lines.length} item আগে থেকেই আছে`));
  }

  const insert = db.prepare('INSERT INTO stock (category, data) VALUES (?, ?)');
  const tx = db.transaction((items) => { for (const d of items) insert.run(category, d); });
  tx(unique);
  logAudit('admin', 'stock_manual', `category=${category} added=${unique.length} dup=${duplicates}`);
  res.redirect('/stock?msg=' + encodeURIComponent(
    `✅ ${unique.length} items added to ${category}` + (duplicates ? ` (${duplicates} duplicate skipped)` : '')
  ));
});

router.post('/clear/:category', (req, res) => {
  const cat = req.params.category;
  const result = db.prepare('DELETE FROM stock WHERE category = ?').run(cat);
  logAudit('admin', 'stock_clear', `category=${cat} deleted=${result.changes}`);
  res.redirect('/stock?msg=' + encodeURIComponent(`Cleared ${result.changes} from ${cat}`));
});

// Download sample Excel template
router.get('/sample/:mode', (req, res) => {
  const mode = req.params.mode === 'multi' ? 'multi' : 'single';
  const wb = XLSX.utils.book_new();
  let data;
  if (mode === 'single') {
    data = [['data'], ['example_id_1@mail.com|password1'], ['example_id_2@mail.com|password2']];
  } else {
    data = [['category', 'data'], ['fb61', 'id1@mail.com|pass1'], ['fb1000', 'id2@mail.com|pass2']];
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Stock');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=stock-sample-${mode}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

module.exports = router;
