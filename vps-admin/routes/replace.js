const express = require('express');
const { db, logAudit } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const status = req.query.status || 'pending';
  const q = (req.query.q || '').trim();

  let sql = 'SELECT * FROM replace_requests WHERE status = ?';
  const params = [status];
  if (q) {
    sql += ` AND (LOWER(COALESCE(username,'')) LIKE ? OR CAST(user_id AS TEXT) LIKE ?
             OR LOWER(COALESCE(old_data,'')) LIKE ? OR LOWER(COALESCE(category,'')) LIKE ?)`;
    const like = `%${q.toLowerCase()}%`;
    params.push(like, `%${q}%`, like, like);
  }
  sql += ' ORDER BY created_at DESC LIMIT 500';

  const rows = db.prepare(sql).all(...params);
  const counts = {
    pending: db.prepare("SELECT COUNT(*) AS c FROM replace_requests WHERE status='pending'").get().c,
    collected: db.prepare("SELECT COUNT(*) AS c FROM replace_requests WHERE status='collected'").get().c,
  };
  res.render('replace', { rows, status, counts, q, msg: req.query.msg || null });
});

router.post('/:id/collect', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare("UPDATE replace_requests SET status='collected', collected_at=? WHERE id=?")
    .run(Date.now(), id);
  logAudit('admin', 'replace_collected', `id=${id}`);
  res.redirect('/replace?msg=' + encodeURIComponent('✅ Marked collected'));
});

router.post('/:id/delete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM replace_requests WHERE id = ?').run(id);
  logAudit('admin', 'replace_delete', `id=${id}`);
  res.redirect('/replace?msg=' + encodeURIComponent('🗑️ Deleted'));
});

// Bulk: delete all collected (cleanup history)
router.post('/bulk/delete-collected', (req, res) => {
  const r = db.prepare("DELETE FROM replace_requests WHERE status='collected'").run();
  logAudit('admin', 'replace_bulk_delete_collected', `count=${r.changes}`);
  res.redirect('/replace?status=collected&msg=' +
    encodeURIComponent(`🗑️ ${r.changes} collected entries deleted`));
});

// Bulk: dedupe pending (in case index wasn't applied yet)
router.post('/bulk/dedupe', (req, res) => {
  const r = db.prepare(`
    DELETE FROM replace_requests
    WHERE status='pending' AND id NOT IN (
      SELECT MIN(id) FROM replace_requests
      WHERE status='pending'
      GROUP BY user_id, COALESCE(category,''), COALESCE(old_data,'')
    )
  `).run();
  logAudit('admin', 'replace_dedupe', `removed=${r.changes}`);
  res.redirect('/replace?msg=' + encodeURIComponent(`🧹 ${r.changes} duplicate entries removed`));
});

module.exports = router;
