// =====================================================================
//  ZiniPay automatic deposit gateway
//  Routes:
//    POST /zinipay/create-invoice  — bot calls this (shared-secret auth)
//    POST /zinipay/webhook         — ZiniPay calls this after payment
//    GET  /zinipay/return          — user redirected here after pay/cancel
//  All public (no admin login required). Webhook security = Verify API call.
// =====================================================================
const express = require('express');
const { db, logAudit } = require('../db');
const router = express.Router();

const ZINIPAY_API_KEY     = process.env.ZINIPAY_API_KEY || '';
const ZINIPAY_BASE        = 'https://api.zinipay.com/v1/payment';
const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN || '';
const SHARED_SECRET       = process.env.DOWNLOAD_SECRET || '';     // bot ↔ admin
const PUBLIC_BASE         = process.env.ZINIPAY_PUBLIC_BASE || 'https://pay.nexus-x.cloud';
const BOT_USERNAME        = process.env.BOT_USERNAME || 'btidsellerbot'; // without @

// ---------- ensure ZiniPay columns exist (idempotent) ----------
try {
  const cols = ['invoice_id TEXT', 'method TEXT'];
  for (const c of cols) {
    try { db.exec(`ALTER TABLE payment_logs ADD COLUMN ${c}`); } catch (_) {}
  }
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_pl_invoice ON payment_logs(invoice_id)`); } catch (_) {}
} catch (e) { console.warn('[zinipay] migrate skip:', e.message); }

// ---------- helpers ----------
async function tgNotify(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  } catch (e) { console.error('[zinipay] tg notify fail:', e.message); }
}

// =====================================================================
// 1) Bot creates invoice via this endpoint (shared-secret protected)
// =====================================================================
router.post('/create-invoice', express.json(), async (req, res) => {
  try {
    const { secret, user_id, username, amount } = req.body || {};
    if (!SHARED_SECRET || secret !== SHARED_SECRET) {
      return res.status(401).json({ ok: false, error: 'bad secret' });
    }
    const amt = parseInt(amount, 10);
    if (!user_id || !amt || amt < 10) {
      return res.status(400).json({ ok: false, error: 'invalid amount (min 10)' });
    }
    if (!ZINIPAY_API_KEY) {
      return res.status(500).json({ ok: false, error: 'ZINIPAY_API_KEY missing' });
    }

    const req_id = 'zp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    const payload = {
      cus_name: username || `user_${user_id}`,
      cus_email: `u${user_id}@bot.local`,
      amount: amt,
      redirect_url: `${PUBLIC_BASE}/zinipay/return?status=success&r=${req_id}`,
      cancel_url:   `${PUBLIC_BASE}/zinipay/return?status=cancel&r=${req_id}`,
      webhook_url:  `${PUBLIC_BASE}/zinipay/webhook`,
      metadata: { req_id, user_id: String(user_id) }
    };

    const r = await fetch(`${ZINIPAY_BASE}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'zini-api-key': ZINIPAY_API_KEY },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok || !data || (!data.payment_url && !data.url)) {
      console.error('[zinipay] create fail:', r.status, data);
      return res.status(502).json({ ok: false, error: 'zinipay create failed', detail: data });
    }
    const payment_url = data.payment_url || data.url;
    const invoice_id  = data.invoice_id || data.id || data.invoiceId || null;

    // Insert pending row
    db.prepare(
      `INSERT INTO payment_logs (req_id, user_id, username, amount, status, date, admin_name, timestamp, invoice_id, method)
       VALUES (?, ?, ?, ?, 'pending', ?, 'ZiniPay-Auto', ?, ?, 'zinipay')`
    ).run(
      req_id, user_id, username || '', amt,
      new Date().toISOString().slice(0, 10),
      Date.now() / 1000,
      invoice_id
    );

    res.json({ ok: true, payment_url, invoice_id, req_id });
  } catch (e) {
    console.error('[zinipay] create-invoice error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// =====================================================================
// 2) Webhook — ZiniPay POSTs { invoice_id, status } here
//    Security: re-Verify via API (ZiniPay webhooks have NO signature)
// =====================================================================
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('[zinipay webhook]', JSON.stringify(req.body));
    const invoice_id = req.body?.invoice_id || req.body?.invoiceId;
    if (!invoice_id) return res.status(400).send('no invoice_id');

    // Verify with ZiniPay
    const vr = await fetch(`${ZINIPAY_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'zini-api-key': ZINIPAY_API_KEY },
      body: JSON.stringify({ invoice_id })
    });
    const vdata = await vr.json();
    console.log('[zinipay verify]', vr.status, JSON.stringify(vdata));

    const status   = (vdata.status || vdata.payment_status || '').toString().toUpperCase();
    const verified = vr.ok && (status === 'COMPLETED' || status === 'SUCCESS' || status === 'TRUE' || vdata.status === true);

    // Find pending row by invoice_id
    const row = db.prepare(`SELECT * FROM payment_logs WHERE invoice_id = ?`).get(invoice_id);
    if (!row) {
      console.warn('[zinipay] no matching row for invoice', invoice_id);
      return res.status(200).send('ok (no row)');
    }
    if (row.status === 'approved') {
      return res.status(200).send('ok (already approved)');
    }

    if (!verified) {
      console.warn('[zinipay] verify failed for', invoice_id, status);
      return res.status(200).send('ok (not verified yet)');
    }

    const verifiedAmount = parseInt(vdata.amount || row.amount, 10);
    const txnId = vdata.transaction_id || vdata.trxId || vdata.trxID || '';
    const senderPhone = vdata.sender_number || vdata.sender || '';
    const payMethod = vdata.payment_method || 'bkash/nagad';

    // Atomic: approve payment + add balance
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE payment_logs
           SET status='approved', amount=?, transaction_id=?, sender_num=?, admin_name=?
         WHERE req_id=? AND status='pending'`
      ).run(verifiedAmount, txnId, senderPhone, `ZiniPay-${payMethod}`, row.req_id);

      // Ensure user row exists, then add balance
      db.prepare(`INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 0)`).run(row.user_id);
      db.prepare(`UPDATE users SET balance = COALESCE(balance,0) + ? WHERE user_id = ?`)
        .run(verifiedAmount, row.user_id);
    });
    tx();

    logAudit('zinipay-webhook', 'auto-approve', `user=${row.user_id} amt=${verifiedAmount} inv=${invoice_id} txn=${txnId}`);

    // Notify user on Telegram
    tgNotify(row.user_id,
      `✅ *Deposit Successful!*\n\n💰 Amount: *${verifiedAmount}৳*\n🧾 TXN: \`${txnId}\`\n💳 Method: ${payMethod}\n\nব্যালেন্স এ যোগ হয়েছে। ধন্যবাদ!`
    );

    res.status(200).send('ok');
  } catch (e) {
    console.error('[zinipay webhook] error:', e);
    res.status(200).send('ok'); // always 200 so ZiniPay doesn't retry forever
  }
});

// =====================================================================
// 3) Return page — user redirected here after pay/cancel
//    Instant redirect to Telegram bot — no admin URL exposure
// =====================================================================
router.get('/return', (req, res) => {
  const status = req.query.status === 'success' ? 'paid' : 'cancel';
  const tgUrl = `https://t.me/${BOT_USERNAME}?start=${status}`;
  res.set('Content-Type', 'text/html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Payment ${status}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0; url=${tgUrl}">
<style>body{font-family:system-ui;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}</style>
</head><body><div>
<h2>${status === 'paid' ? '✅ Payment Successful' : '❌ Payment Cancelled'}</h2>
<p>Telegram bot এ ফিরিয়ে নিচ্ছি...</p>
<p><a style="color:#60a5fa" href="${tgUrl}">এখানে ক্লিক করুন</a></p>
</div><script>setTimeout(()=>location.href=${JSON.stringify(tgUrl)},300)</script>
</body></html>`);
});

module.exports = router;
