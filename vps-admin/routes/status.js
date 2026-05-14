const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DEPLOY_LOG = process.env.DEPLOY_LOG || '/root/deploy.log';
const PM2_NAME = process.env.PM2_NAME || 'nexusx-admin';

function run(cmd, timeout = 5000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: (stdout || '').toString(), err: (stderr || err?.message || '').toString() });
    });
  });
}

function readTail(file, lines = 80) {
  try {
    if (!fs.existsSync(file)) return { exists: false, content: '' };
    const data = fs.readFileSync(file, 'utf8');
    const arr = data.trim().split('\n');
    return { exists: true, content: arr.slice(-lines).join('\n'), mtime: fs.statSync(file).mtime };
  } catch (e) {
    return { exists: false, content: 'Error reading: ' + e.message };
  }
}

router.get('/', async (req, res) => {
  const [pm2List, pm2Info, gitLog, uptime, dbStat] = await Promise.all([
    run(`pm2 jlist`),
    run(`pm2 describe ${PM2_NAME}`),
    run(`cd ${path.resolve(__dirname, '..')} && git log -5 --pretty=format:"%h | %ar | %s"`),
    run(`uptime`),
    run(`ls -lh ${process.env.DB_PATH || '/var/www/cruzercc/backend/data/store.db'}`),
  ]);

  let pm2App = null;
  try {
    const list = JSON.parse(pm2List.out || '[]');
    pm2App = list.find((p) => p.name === PM2_NAME) || list[0] || null;
  } catch {}

  const deployLog = readTail(DEPLOY_LOG, 60);
  const errorLog = await run(`pm2 logs ${PM2_NAME} --err --lines 50 --nostream --raw`);
  const outLog = await run(`pm2 logs ${PM2_NAME} --out --lines 30 --nostream --raw`);

  res.render('status', {
    title: 'System Status',
    pm2App,
    pm2Info: pm2Info.out,
    gitLog: gitLog.out,
    uptime: uptime.out.trim(),
    dbStat: dbStat.out.trim(),
    deployLog,
    errorLog: errorLog.out,
    outLog: outLog.out,
    msg: req.query.msg || null,
  });
});

router.post('/restart', async (req, res) => {
  const r = await run(`pm2 restart ${PM2_NAME}`, 10000);
  res.redirect('/status?msg=' + encodeURIComponent(r.ok ? '✅ Restarted ' + PM2_NAME : '❌ ' + r.err));
});

router.post('/deploy', async (req, res) => {
  // Trigger manual deploy via deploy.sh if present
  const script = process.env.DEPLOY_SCRIPT || '/root/deploy.sh';
  if (!fs.existsSync(script)) {
    return res.redirect('/status?msg=' + encodeURIComponent('❌ deploy.sh not found at ' + script));
  }
  const r = await run(`bash ${script} >> ${DEPLOY_LOG} 2>&1`, 60000);
  res.redirect('/status?msg=' + encodeURIComponent(r.ok ? '✅ Deploy triggered — check log below' : '❌ ' + r.err));
});

module.exports = router;
