// Admin → send Telegram notice (broadcast to all users, or single user).
// Uses bot's Telegram Bot API directly (no need to talk to the bot process).
const express = require('express');
const { db, logAudit } = require('../db');
const router = express.Router();

const BOT_TOKEN = process.env.BOT_TOKEN || '';

async function tgSend(chatId, text) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN missing in .env');
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: !!j.ok, desc: j.description || '' };
}

router.get('/', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users WHERE COALESCE(is_banned,0)=0').get().c;
  res.render('notice', {
    msg: req.query.msg || null,
    totalUsers,
    botTokenSet: !!BOT_TOKEN,
  });
});

router.post('/send', async (req, res) => {
  const text = (req.body.text || '').trim();
  const target = (req.body.target || 'all').trim();
  if (!text) return res.redirect('/notice?msg=' + encodeURIComponent('❌ Message empty'));
  if (!BOT_TOKEN) return res.redirect('/notice?msg=' + encodeURIComponent('❌ BOT_TOKEN missing in .env'));

  let recipients = [];
  if (target === 'all') {
    recipients = db.prepare('SELECT user_id FROM users WHERE COALESCE(is_banned,0)=0').all().map(r => r.user_id);
  } else {
    const id = parseInt(target, 10);
    if (!id) return res.redirect('/notice?msg=' + encodeURIComponent('❌ Invalid user_id'));
    recipients = [id];
  }

  let sent = 0, failed = 0;
  for (const uid of recipients) {
    try {
      const r = await tgSend(uid, text);
      if (r.ok) sent++; else failed++;
    } catch (_) { failed++; }
    // tiny delay to respect Telegram rate limit (~30 msg/sec)
    await new Promise(r => setTimeout(r, 40));
  }

  logAudit('admin', 'notice_send', `target=${target} sent=${sent} failed=${failed}`);
  res.redirect('/notice?msg=' + encodeURIComponent(`✅ Sent: ${sent}, Failed: ${failed}`));
});

module.exports = router;
