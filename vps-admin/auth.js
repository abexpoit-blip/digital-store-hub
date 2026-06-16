const bcrypt = require('bcryptjs');
const { db } = require('./db');

// On boot: if no password hash stored, take from .env and hash it
function initAdminPassword() {
  const row = db.prepare('SELECT password_hash FROM admin_auth WHERE id = 1').get();
  if (!row) {
    const plain = process.env.ADMIN_PASSWORD || 'changeMeNow123';
    const hash = bcrypt.hashSync(plain, 10);
    db.prepare('INSERT INTO admin_auth (id, password_hash, updated_at) VALUES (1, ?, ?)')
      .run(hash, Date.now());
    console.log('[auth] Master password initialized from ADMIN_PASSWORD env var.');
  }
}

function verifyPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) return false;
  const row = db.prepare('SELECT password_hash FROM admin_auth WHERE id = 1').get();
  if (!row || typeof row.password_hash !== 'string') return false;
  try {
    return bcrypt.compareSync(plain, row.password_hash);
  } catch (e) {
    console.error('[auth] verifyPassword error:', e.message);
    return false;
  }
}

function changePassword(newPlain) {
  if (typeof newPlain !== 'string' || newPlain.length < 6) {
    throw new Error('Invalid new password');
  }
  const hash = bcrypt.hashSync(newPlain, 10);
  db.prepare('UPDATE admin_auth SET password_hash = ?, updated_at = ? WHERE id = 1')
    .run(hash, Date.now());
}

function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.redirect('/login');
}

module.exports = { initAdminPassword, verifyPassword, changePassword, requireLogin };
