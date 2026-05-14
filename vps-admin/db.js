// Database connection — shares the SAME store.db with the Telegram bot
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'store.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // matches bot — safe for concurrent reads/writes
db.pragma('busy_timeout = 5000');

// --- Add NEW tables only. Bot's existing tables are untouched. ---
db.exec(`
  CREATE TABLE IF NOT EXISTS replace_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT,
    category TEXT,
    old_data TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    collected_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS delivery_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    user_id INTEGER NOT NULL,
    username TEXT,
    category TEXT NOT NULL,
    stock_id INTEGER,
    data TEXT NOT NULL,
    source TEXT DEFAULT 'bot',
    delivered_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_delivery_user ON delivery_archive(user_id);
  CREATE INDEX IF NOT EXISTS idx_delivery_sale ON delivery_archive(sale_id);
`);

// Dedupe existing pending replace_requests, then create partial unique index
// to prevent the same user from submitting the same (category, old_data) twice while pending.
try {
  db.exec(`
    DELETE FROM replace_requests
    WHERE status='pending' AND id NOT IN (
      SELECT MIN(id) FROM replace_requests
      WHERE status='pending'
      GROUP BY user_id, COALESCE(category,''), COALESCE(old_data,'')
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_replace_pending_unique
      ON replace_requests(user_id, category, old_data)
      WHERE status='pending';
  `);
} catch (e) {
  console.warn('[db] replace dedupe/index skipped:', e.message);
}

function logAudit(actor, action, details = '') {
  db.prepare('INSERT INTO audit_log (actor, action, details, timestamp) VALUES (?, ?, ?, ?)')
    .run(actor, action, details, Date.now());
}

module.exports = { db, logAudit, DB_PATH };
