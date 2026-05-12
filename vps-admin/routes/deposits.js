const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const status = req.query.status || 'all';
  const q = (req.query.q || '').trim();

  let where = '1=1';
  const params = [];
  if (status !== 'all') { where += ' AND status = ?'; params.push(status); }
  if (q) {
    where += ' AND (LOWER(COALESCE(username,\'\')) LIKE ? OR CAST(user_id AS TEXT) LIKE ?)';
    params.push(`%${q.toLowerCase()}%`, `%${q}%`);
  }

  const deposits = db.prepare(
    `SELECT * FROM payment_logs WHERE ${where} ORDER BY COALESCE(timestamp,0) DESC LIMIT 300`
  ).all(...params);

  const summary = db.prepare(
    `SELECT status, COUNT(*) AS c, COALESCE(SUM(amount),0) AS s FROM payment_logs GROUP BY status`
  ).all();

  res.render('deposits', { deposits, summary, status, q });
});

module.exports = router;
