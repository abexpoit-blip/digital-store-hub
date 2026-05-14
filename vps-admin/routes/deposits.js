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
    // Search across user_id, username, sender phone/id, transaction id, req_id
    where += ` AND (
      LOWER(COALESCE(username,'')) LIKE ?
      OR CAST(user_id AS TEXT) LIKE ?
      OR LOWER(COALESCE(sender_num,'')) LIKE ?
      OR LOWER(COALESCE(transaction_id,'')) LIKE ?
      OR LOWER(COALESCE(req_id,'')) LIKE ?
    )`;
    const like = `%${q.toLowerCase()}%`;
    params.push(like, `%${q}%`, like, like, like);
  }

  const deposits = db.prepare(
    `SELECT * FROM payment_logs WHERE ${where} ORDER BY COALESCE(timestamp,0) DESC LIMIT 300`
  ).all(...params);

  // Enrich each deposit with telegram username from users table (reliable cross-reference)
  const userStmt = db.prepare('SELECT username, balance, is_banned FROM users WHERE user_id = ?');
  deposits.forEach(d => {
    if (d.user_id) {
      const u = userStmt.get(d.user_id);
      if (u) {
        d._tg_username = u.username;
        d._tg_balance = u.balance;
        d._tg_banned = u.is_banned;
      }
    }
  });

  const summary = db.prepare(
    `SELECT status, COUNT(*) AS c, COALESCE(SUM(amount),0) AS s FROM payment_logs GROUP BY status`
  ).all();

  res.render('deposits', { deposits, summary, status, q });
});

module.exports = router;
