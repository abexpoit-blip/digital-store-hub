const express = require('express');
const XLSX = require('xlsx');
const { db } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  let sales;
  if (q) {
    sales = db.prepare(
      `SELECT * FROM sales WHERE LOWER(COALESCE(username,'')) LIKE ?
        OR CAST(user_id AS TEXT) LIKE ? OR LOWER(category) LIKE ?
        ORDER BY id DESC LIMIT 300`
    ).all(`%${q.toLowerCase()}%`, `%${q}%`, `%${q.toLowerCase()}%`);
  } else {
    sales = db.prepare('SELECT * FROM sales ORDER BY id DESC LIMIT 300').all();
  }
  res.render('orders', { sales, q });
});

// Download Excel for a particular sale: pulls stock matching category & qty if available,
// otherwise just exports the sale info row. Note: bot deletes stock on sale, so for
// historical orders the IDs may not be retrievable. This works for fresh orders.
router.get('/:id/excel', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) return res.status(404).send('Sale not found');

  const wb = XLSX.utils.book_new();
  const headerRows = [
    ['Order ID', sale.id],
    ['User ID', sale.user_id],
    ['Username', sale.username],
    ['Category', sale.category],
    ['Quantity', sale.qty],
    ['Total', sale.total + '৳'],
    ['Date', `${sale.date} ${sale.time || ''}`],
    [],
    ['#', 'Data (delivered)'],
  ];
  // Fresh stock matching category — best-effort lookup
  const stockSample = db.prepare(
    'SELECT data FROM stock WHERE category = ? ORDER BY id DESC LIMIT ?'
  ).all(sale.category, sale.qty || 1);

  stockSample.forEach((s, i) => headerRows.push([i + 1, s.data]));
  if (!stockSample.length) headerRows.push(['—', '(historical — IDs not stored separately)']);

  const ws = XLSX.utils.aoa_to_sheet(headerRows);
  ws['!cols'] = [{ wch: 14 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, ws, `Order-${sale.id}`);

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="order-${sale.id}-${sale.category}.xlsx"`);
  res.send(buf);
});

module.exports = router;
