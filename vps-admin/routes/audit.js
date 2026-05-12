const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM audit_log ORDER BY id DESC LIMIT 500'
  ).all();
  res.render('audit', { rows });
});

module.exports = router;
