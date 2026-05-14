// Public (no-auth) routes — buyer-facing Excel download via signed link.
// URL format: /o/:saleId/:sig
//   sig = first 16 hex chars of HMAC-SHA256(DOWNLOAD_SECRET, String(saleId))
// Bot (Python) generates the same signature and sends the link to the user
// after a successful purchase.
const express = require('express');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { db } = require('../db');

const router = express.Router();

function sign(saleId) {
  const secret = process.env.DOWNLOAD_SECRET || 'change-me-download-secret';
  return crypto.createHmac('sha256', secret).update(String(saleId)).digest('hex').slice(0, 16);
}

router.get('/:saleId/:sig', (req, res) => {
  const saleId = parseInt(req.params.saleId, 10);
  if (!saleId) return res.status(400).send('Invalid order');
  const expected = sign(saleId);
  if (expected !== String(req.params.sig).toLowerCase()) {
    return res.status(403).send('Invalid or expired link');
  }
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!sale) return res.status(404).send('Order not found');

  // Pull actual delivered items from delivery_archive (real IDs that user got)
  let items = [];
  try {
    items = db.prepare(
      'SELECT stock_id, data, delivered_at FROM delivery_archive WHERE sale_id = ? ORDER BY id ASC'
    ).all(saleId);
  } catch (_) {}

  const wb = XLSX.utils.book_new();
  const rows = [
    ['Order ID', sale.id],
    ['User ID', sale.user_id],
    ['Username', sale.username || '-'],
    ['Category', sale.category],
    ['Quantity', sale.qty],
    ['Total', (sale.total || 0) + ' Tk'],
    ['Date', `${sale.date || ''} ${sale.time || ''}`.trim()],
    [],
    ['#', 'UID', 'PASS', 'COOKIES'],
  ];
  if (items.length) {
    items.forEach((it, i) => {
      const parts = (it.data || '').split(' ');
      const uid = parts[0] || '';
      const pass = parts[1] || '';
      const cookies = parts.slice(2).join(' ');
      rows.push([i + 1, uid, pass, cookies]);
    });
  } else {
    rows.push(['—', 'No archived items found for this order', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, `Order-${sale.id}`);

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="order-${sale.id}-${sale.category}.xlsx"`);
  res.send(buf);
});

// Helper exposed for admin views — they can show the public link too
router.sign = sign;
module.exports = router;
