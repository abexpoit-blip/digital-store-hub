const express = require('express');
const { db, logAudit } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  let users;
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    users = db.prepare(
      `SELECT * FROM users WHERE LOWER(username) LIKE ? OR CAST(user_id AS TEXT) LIKE ?
       ORDER BY balance DESC LIMIT 200`
    ).all(like, `%${q}%`);
  } else {
    users = db.prepare('SELECT * FROM users ORDER BY balance DESC LIMIT 200').all();
  }
  res.render('users', { users, q, msg: req.query.msg || null });
});

router.get('/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (!user) return res.status(404).render('error', { message: 'User not found' });

  const sales = db.prepare('SELECT * FROM sales WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(userId);
  const deposits = db.prepare(
    'SELECT * FROM payment_logs WHERE user_id = ? ORDER BY COALESCE(timestamp,0) DESC LIMIT 100'
  ).all(userId);
  const totalSpent = sales.reduce((a, b) => a + (b.total || 0), 0);
  const totalDeposited = deposits
    .filter(d => d.status === 'approved')
    .reduce((a, b) => a + (b.amount || 0), 0);

  res.render('user-detail', {
    user, sales, deposits, totalSpent, totalDeposited,
    msg: req.query.msg || null
  });
});

router.post('/:id/balance', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const delta = parseInt(req.body.delta, 10);
  const reason = (req.body.reason || '').trim();
  if (isNaN(delta)) return res.redirect(`/users/${userId}?msg=Invalid+amount`);

  const user = db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId);
  if (!user) return res.redirect('/users');

  const newBal = (user.balance || 0) + delta;
  db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBal, userId);
  logAudit('admin', 'balance_adjust',
    `user=${userId} delta=${delta} new=${newBal} reason="${reason}"`);
  res.redirect(`/users/${userId}?msg=` + encodeURIComponent(`Balance updated: ${delta > 0 ? '+' : ''}${delta}৳`));
});

router.post('/:id/ban', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const banned = req.body.banned === '1' ? 1 : 0;
  db.prepare('UPDATE users SET is_banned = ? WHERE user_id = ?').run(banned, userId);
  logAudit('admin', banned ? 'ban_user' : 'unban_user', `user=${userId}`);
  res.redirect(`/users/${userId}?msg=` + encodeURIComponent(banned ? 'User banned 🚫' : 'User unbanned ✅'));
});

module.exports = router;
