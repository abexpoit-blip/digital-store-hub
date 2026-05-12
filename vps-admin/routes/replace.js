const express = require('express');
const { db, logAudit } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db.prepare(
    `SELECT * FROM replace_requests WHERE status = ? ORDER BY created_at DESC LIMIT 300`
  ).all(status);
  const counts = {
    pending: db.prepare("SELECT COUNT(*) AS c FROM replace_requests WHERE status='pending'").get().c,
    collected: db.prepare("SELECT COUNT(*) AS c FROM replace_requests WHERE status='collected'").get().c,
  };
  res.render('replace', { rows, status, counts, msg: req.query.msg || null });
});

router.post('/:id/collect', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare("UPDATE replace_requests SET status='collected', collected_at=? WHERE id=?")
    .run(Date.now(), id);
  logAudit('admin', 'replace_collected', `id=${id}`);
  res.redirect('/replace?msg=Marked+collected');
});

router.post('/:id/delete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM replace_requests WHERE id = ?').run(id);
  logAudit('admin', 'replace_delete', `id=${id}`);
  res.redirect('/replace?msg=Deleted');
});

module.exports = router;
