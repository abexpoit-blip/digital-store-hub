const express = require('express');
const { db, logAudit } = require('../db');
const router = express.Router();

// Ensure Nord tables exist (mirrors nord-auto-patch.py so panel works even before patch runs)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nord_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pkg_id TEXT NOT NULL,
      data TEXT NOT NULL,
      delivered_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_nord_stock_avail ON nord_stock(pkg_id, delivered_count);
    CREATE TABLE IF NOT EXISTS nord_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id TEXT,
      delivered_at INTEGER NOT NULL,
      UNIQUE(stock_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_nord_deliv_user ON nord_deliveries(user_id);
    CREATE INDEX IF NOT EXISTS idx_nord_deliv_stock ON nord_deliveries(stock_id);
  `);
  try { db.exec("ALTER TABLE nord_stock ADD COLUMN email TEXT"); } catch (_) {}
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_nord_stock_email ON nord_stock(email) WHERE email IS NOT NULL");
} catch (e) { console.warn('[nord] table init:', e.message); }

const MAX_USES = 2;

function loadPackages() {
  try {
    return db.prepare(
      "SELECT pkg_id, price FROM vpn_packages WHERE vpn_id='nord' ORDER BY pkg_id"
    ).all();
  } catch (_) { return []; }
}

function fmtPkg(pkg_id) {
  if (!pkg_id) return '';
  if (pkg_id.endsWith('d')) return `${pkg_id.slice(0,-1)} Days`;
  if (pkg_id.endsWith('m')) return `${pkg_id.slice(0,-1)} Months`;
  if (pkg_id.endsWith('y')) return `${pkg_id.slice(0,-1)} Years`;
  return pkg_id.toUpperCase();
}

router.get('/', (req, res) => {
  const packages = loadPackages();
  // Per-pkg summary
  const summary = packages.map(p => {
    const total = db.prepare('SELECT COUNT(*) c FROM nord_stock WHERE pkg_id=?').get(p.pkg_id).c;
    const active = db.prepare(
      'SELECT COUNT(*) c FROM nord_stock WHERE pkg_id=? AND delivered_count < ?'
    ).get(p.pkg_id, MAX_USES).c;
    const slotsLeft = db.prepare(
      'SELECT COALESCE(SUM(?-delivered_count),0) s FROM nord_stock WHERE pkg_id=? AND delivered_count < ?'
    ).get(MAX_USES, p.pkg_id, MAX_USES).s;
    return { ...p, pkg_label: fmtPkg(p.pkg_id), total, active, slotsLeft };
  });

  const activePkg = (req.query.pkg || (packages[0] && packages[0].pkg_id) || '').toLowerCase();
  let items = [];
  if (activePkg) {
    items = db.prepare(
      `SELECT s.id, s.pkg_id, s.data, s.email, s.delivered_count, s.created_at,
              (SELECT COUNT(*) FROM nord_deliveries d WHERE d.stock_id = s.id) AS delivered_users
         FROM nord_stock s
        WHERE s.pkg_id = ?
        ORDER BY (s.delivered_count >= ?) ASC, s.id DESC
        LIMIT 300`
    ).all(activePkg, MAX_USES);
  }

  const totalAccounts = db.prepare('SELECT COUNT(*) c FROM nord_stock').get().c;
  const totalDelivered = db.prepare('SELECT COUNT(*) c FROM nord_deliveries').get().c;
  const thrRow = db.prepare("SELECT value FROM config WHERE key='nord_warn_threshold'").get();
  const threshold = thrRow ? parseInt(thrRow.value, 10) : 3;
  const svcRow = db.prepare("SELECT value FROM config WHERE key='nord_service_enabled'").get();
  const svcVal = svcRow ? String(svcRow.value).toLowerCase() : 'on';
  const serviceOn = !['0','off','false','no','closed','disabled'].includes(svcVal);

  res.render('nord', {
    packages, summary, activePkg, items,
    totalAccounts, totalDelivered, MAX_USES, threshold, serviceOn,
    msg: req.query.msg || null
  });
});

// Toggle Nord service ON/OFF (bot will show "unavailable" when OFF)
router.post('/toggle', (req, res) => {
  const next = req.body.state === 'off' ? 'off' : 'on';
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('nord_service_enabled', ?)").run(next);
  logAudit('admin', 'nord_service_toggle', next);
  res.redirect('/nord?msg=' + encodeURIComponent(next === 'on'
    ? '✅ NordVPN সার্ভিস চালু হলো'
    : '⛔ NordVPN সার্ভিস বন্ধ করা হলো — user রা "unavailable" message পাবে'));
});

// Parse pasted blocks into {email, password} records.
// Accepted format per block (blank line separates blocks):
//   Nord                <- optional header, ignored
//   email@domain.com
//   passwordText
// A single-line block "email:password" or "email|password" is also supported.
function parseNordBlocks(raw) {
  const text = (raw || '').replace(/\r/g, '').trim();
  if (!text) return [];
  const blocks = text.split(/\n\s*\n+/); // separated by blank line(s)
  const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const out = [];
  for (const b of blocks) {
    const lines = b.split('\n').map(s => s.trim()).filter(Boolean)
      .filter(l => l.toLowerCase() !== 'nord');
    if (!lines.length) continue;
    let email = '', password = '';
    // single-line email:pass or email|pass
    if (lines.length === 1) {
      const m = lines[0].match(/^([\w.+-]+@[\w-]+\.[\w.-]+)[\s:|]+(.+)$/);
      if (m) { email = m[1]; password = m[2].trim(); }
    } else {
      // multi-line: pick the email line, rest = password
      const emailIdx = lines.findIndex(l => emailRe.test(l));
      if (emailIdx >= 0) {
        email = (lines[emailIdx].match(emailRe) || [''])[0];
        password = lines.filter((_, i) => i !== emailIdx).join(' ').trim();
      }
    }
    if (email && password) out.push({ email: email.toLowerCase(), password });
  }
  return out;
}

// Bulk add accounts for a pkg_id (new block-format parser + dedup by email)
router.post('/add', (req, res) => {
  const pkg_id = (req.body.pkg_id || '').trim().toLowerCase();
  if (!pkg_id) return res.redirect('/nord?msg=' + encodeURIComponent('❌ Package select করুন'));

  const records = parseNordBlocks(req.body.accounts || '');
  if (!records.length) {
    return res.redirect('/nord?pkg=' + pkg_id + '&msg=' +
      encodeURIComponent('❌ কোনো valid account পাওয়া যায়নি (email + password লাগবে)'));
  }

  const now = Math.floor(Date.now() / 1000);
  const insert = db.prepare(
    'INSERT INTO nord_stock (pkg_id, data, email, delivered_count, created_at) VALUES (?, ?, ?, 0, ?)'
  );
  let inserted = 0, skipped = 0;
  const dupEmails = [];
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      try {
        insert.run(pkg_id, JSON.stringify({ email: r.email, password: r.password }), r.email, now);
        inserted++;
      } catch (e) {
        if (e && /UNIQUE|unique/.test(String(e.message))) {
          skipped++; dupEmails.push(r.email);
        } else { throw e; }
      }
    }
    if (inserted > 0) {
      db.prepare("DELETE FROM config WHERE key = ?").run(`nord_last_alert_${pkg_id}`);
    }
  });
  tx(records);

  logAudit('admin', 'nord_stock_add', `pkg=${pkg_id} added=${inserted} dup=${skipped}`);
  let msg = `✅ ${inserted} account যোগ হয়েছে (${fmtPkg(pkg_id)})`;
  if (skipped > 0) msg += ` · ⏭ ${skipped} duplicate skip: ${dupEmails.slice(0,3).join(', ')}${dupEmails.length>3?'...':''}`;
  res.redirect('/nord?pkg=' + pkg_id + '&msg=' + encodeURIComponent(msg));
});

// Update low-stock warning threshold
router.post('/threshold', (req, res) => {
  const n = parseInt(req.body.threshold, 10);
  if (!Number.isFinite(n) || n < 0 || n > 999) {
    return res.redirect('/nord?msg=' + encodeURIComponent('❌ Threshold 0-999 হতে হবে'));
  }
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('nord_warn_threshold', ?)").run(String(n));
  logAudit('admin', 'nord_threshold_set', `value=${n}`);
  res.redirect('/nord?msg=' + encodeURIComponent(`✅ Warning threshold: ${n} slots`));
});

// Delete a stock row (only if not yet delivered; else force via confirm)
router.post('/delete/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const force = req.body.force === '1';
  const row = db.prepare('SELECT pkg_id, delivered_count FROM nord_stock WHERE id=?').get(id);
  if (!row) return res.redirect('/nord?msg=' + encodeURIComponent('❌ Not found'));
  if (row.delivered_count > 0 && !force) {
    return res.redirect('/nord?pkg=' + row.pkg_id + '&msg=' + encodeURIComponent('⚠️ এই account ইতিমধ্যে ডেলিভার — Force delete ব্যবহার করুন'));
  }
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM nord_deliveries WHERE stock_id=?').run(id);
    db.prepare('DELETE FROM nord_stock WHERE id=?').run(id);
  });
  tx();
  logAudit('admin', 'nord_stock_delete', `id=${id} pkg=${row.pkg_id} force=${force?1:0}`);
  res.redirect('/nord?pkg=' + row.pkg_id + '&msg=' + encodeURIComponent('🗑️ Deleted'));
});

// View which users got a particular account
router.get('/deliveries/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const stock = db.prepare('SELECT * FROM nord_stock WHERE id=?').get(id);
  if (!stock) return res.status(404).render('error', { message: 'Stock not found' });
  const rows = db.prepare(
    `SELECT d.*, u.username FROM nord_deliveries d
       LEFT JOIN users u ON u.user_id = d.user_id
      WHERE d.stock_id = ? ORDER BY d.delivered_at DESC`
  ).all(id);
  res.json({ stock, deliveries: rows });
});

module.exports = router;
