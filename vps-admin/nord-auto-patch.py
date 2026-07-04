#!/usr/bin/env python3
"""
NordVPN auto-delivery patcher.
- Creates nord_stock + nord_deliveries tables in /root/store.db
- Injects auto-deliver block into process_vpn_buy() inside /root/store.py
- Idempotent (safe to run multiple times). Backs up store.py before patching.

Usage:
    python3 vps-admin/nord-auto-patch.py
    pm2 restart nexus-bot
"""
import os
import re
import sys
import shutil
import sqlite3
from datetime import datetime

STORE_PY = "/root/store.py"
STORE_DB = "/root/store.db"
MARKER = "# === NORD_AUTO_DELIVER_V2 ==="
V1_MARKER = "# === NORD_AUTO_DELIVER_V1 ==="
V1_END = "# === END NORD_AUTO_DELIVER_V1 ==="

INJECT_BLOCK = r'''
    # === NORD_AUTO_DELIVER_V2 ===
    # NordVPN auto-delivery: 1 account -> max 3 users, no repeat per user.
    # V2 adds low-stock warning to admins (rate-limited, 1h per pkg).
    if vpn_id == 'nord':
        try:
            _nord_row = conn.execute(
                """SELECT id, data FROM nord_stock
                   WHERE pkg_id = ? AND delivered_count < 3
                     AND id NOT IN (SELECT stock_id FROM nord_deliveries WHERE user_id = ?)
                   ORDER BY delivered_count ASC, id ASC LIMIT 1""",
                (pkg_id, c.from_user.id),
            ).fetchone()
        except Exception:
            _nord_row = None
        if _nord_row:
            _stock_id, _vpn_info = _nord_row
            _order_id = str(uuid.uuid4())[:8]
            _now_ts = int(datetime.now().timestamp())
            _cur_time = datetime.now(timezone(timedelta(hours=6))).strftime("%I:%M %p")
            _uname = f"@{c.from_user.username}" if c.from_user.username else f"User {c.from_user.id}"
            try:
                conn.execute("BEGIN IMMEDIATE")
                _upd = conn.execute(
                    "UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?",
                    (price, c.from_user.id, price),
                )
                if _upd.rowcount != 1:
                    raise Exception("Insufficient balance during auto-deliver")
                conn.execute(
                    "UPDATE nord_stock SET delivered_count = delivered_count + 1 WHERE id = ? AND delivered_count < 3",
                    (_stock_id,),
                )
                conn.execute(
                    "INSERT INTO nord_deliveries (stock_id, user_id, order_id, delivered_at) VALUES (?, ?, ?, ?)",
                    (_stock_id, c.from_user.id, _order_id, _now_ts),
                )
                conn.execute(
                    "INSERT INTO sales (user_id, username, category, qty, total, date, time) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (c.from_user.id, _uname, f"VPN: {vpn_name}", 1, price,
                     datetime.now().strftime("%Y-%m-%d"), _cur_time),
                )
                conn.execute(
                    "INSERT INTO vpn_orders (order_id, user_id, vpn_name, duration, price, status, date, admin_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (_order_id, c.from_user.id, vpn_name, pkg_name, price,
                     'delivered', datetime.now().strftime("%Y-%m-%d"), 'AUTO'),
                )
                try:
                    conn.execute(
                        "INSERT INTO delivery_archive (sale_id, user_id, username, category, stock_id, data, source, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (None, c.from_user.id,
                         (f"@{c.from_user.username}" if c.from_user.username else None),
                         f"VPN: {vpn_name}", _stock_id, _vpn_info, 'bot-auto', _now_ts),
                    )
                except Exception:
                    pass
                conn.commit()
            except Exception as _e:
                try: conn.rollback()
                except: pass
                conn.close()
                return await c.message.answer(f"❌ Auto-delivery ব্যর্থ: {_e}\nAdmin কে জানান।")

            _emoji = VPN_EMOJIS.get(vpn_id, "⚛️")
            _user_msg = (
                f"🎉 **আপনার VPN অর্ডার ডেলিভারি সম্পন্ন হয়েছে!** 🎉\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"{_emoji} **ব্র্যান্ড:** {vpn_name}\n"
                f"📦 **প্যাকেজ:** {pkg_name}\n"
                f"⚡ **Auto-Delivered (Instant)**\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"🔐 **আপনার লগইন ডিটেইলস:**\n"
                f"```text\n{_vpn_info}\n```\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"💡 *(কপি করতে বক্সের উপর ক্লিক করুন)*\n"
                f"🆔 Order: `{_order_id}`"
            )
            try:
                await c.message.answer(_user_msg, parse_mode="Markdown")
            except Exception:
                await c.message.answer(_user_msg)

            try:
                _admins = conn.execute("SELECT user_id FROM admins").fetchall()
            except Exception:
                _admins = []
            conn.close()
            _udisp = f"@{c.from_user.username}" if c.from_user.username else "No Username"
            _admin_notify = (
                f"⚡ **AUTO-DELIVERED (Nord VPN)**\n"
                f"👤 {c.from_user.first_name} | {_udisp} | `{c.from_user.id}`\n"
                f"📦 {pkg_name} | 💰 {price}৳\n"
                f"🆔 Order: `{_order_id}` | Stock #{_stock_id}"
            )
            for _a in _admins:
                try: await bot.send_message(_a[0], _admin_notify)
                except: pass

            # --- Low-stock warning (rate-limited to 1 alert per pkg per hour) ---
            try:
                _wconn = sqlite3.connect('/root/store.db')
                _remaining = _wconn.execute(
                    "SELECT COALESCE(SUM(3 - delivered_count), 0) FROM nord_stock "
                    "WHERE pkg_id = ? AND delivered_count < 3",
                    (pkg_id,),
                ).fetchone()[0]
                _thr_row = _wconn.execute(
                    "SELECT value FROM config WHERE key = 'nord_warn_threshold'"
                ).fetchone()
                _thr = int(_thr_row[0]) if _thr_row else 3
                if _remaining <= _thr:
                    _last_row = _wconn.execute(
                        "SELECT value FROM config WHERE key = ?",
                        (f"nord_last_alert_{pkg_id}",),
                    ).fetchone()
                    _last = int(_last_row[0]) if _last_row else 0
                    if _now_ts - _last >= 3600:
                        _wconn.execute(
                            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
                            (f"nord_last_alert_{pkg_id}", str(_now_ts)),
                        )
                        _wconn.commit()
                        _wconn.close()
                        _lvl = "🚨 OUT OF STOCK" if _remaining <= 0 else "⚠️ Stock LOW"
                        _warn = (
                            f"{_lvl} — Nord VPN\n"
                            f"📦 Package: {pkg_name} ({pkg_id})\n"
                            f"🔻 Remaining slots: {_remaining}\n"
                            f"➕ Panel: /nord এ গিয়ে stock refill করুন।"
                        )
                        for _a in _admins:
                            try: await bot.send_message(_a[0], _warn)
                            except: pass
                    else:
                        _wconn.close()
                else:
                    _wconn.close()
            except Exception:
                try: _wconn.close()
                except: pass
            return
    # === END NORD_AUTO_DELIVER_V2 ===

'''


def ensure_tables():
    conn = sqlite3.connect(STORE_DB)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS nord_stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pkg_id TEXT NOT NULL,
            data TEXT NOT NULL,
            delivered_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_nord_stock_avail
            ON nord_stock(pkg_id, delivered_count);

        CREATE TABLE IF NOT EXISTS nord_deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stock_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            order_id TEXT,
            delivered_at INTEGER NOT NULL,
            UNIQUE(stock_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_nord_deliv_user
            ON nord_deliveries(user_id);
        CREATE INDEX IF NOT EXISTS idx_nord_deliv_stock
            ON nord_deliveries(stock_id);
    """)
    conn.commit()
    conn.close()
    print("[db] nord_stock + nord_deliveries tables ready")


def patch_store_py():
    if not os.path.exists(STORE_PY):
        print(f"[err] {STORE_PY} not found", file=sys.stderr)
        sys.exit(1)

    src = open(STORE_PY, "r", encoding="utf-8").read()

    if MARKER in src:
        print("[patch] already applied (marker found), skipping.")
        return

    # Locate process_vpn_buy function boundaries
    m = re.search(r'^async def process_vpn_buy\b', src, flags=re.MULTILINE)
    if not m:
        print("[err] process_vpn_buy() not found in store.py", file=sys.stderr)
        sys.exit(2)
    fn_start = m.start()
    # find start of NEXT top-level def/async def or decorator after this
    next_m = re.search(r'^(?:async def |def |@dp\.|@bot\.)',
                       src[m.end():], flags=re.MULTILINE)
    fn_end = m.end() + next_m.start() if next_m else len(src)
    fn_body = src[fn_start:fn_end]

    # Anchor: the balance-deduct line INSIDE this function
    anchor_re = re.compile(
        r'^([ \t]*)conn\.execute\("UPDATE users SET balance = balance - \? '
        r'WHERE user_id = \?"[^\n]*\n',
        flags=re.MULTILINE,
    )
    am = anchor_re.search(fn_body)
    if not am:
        print("[err] balance-deduct anchor not found inside process_vpn_buy",
              file=sys.stderr)
        sys.exit(3)

    indent = am.group(1)
    # Re-indent injected block to match anchor indent (block currently uses 4-space base)
    indented_block = "\n".join(
        (indent + line[4:]) if line.startswith("    ") else line
        for line in INJECT_BLOCK.splitlines()
    ) + "\n"

    new_fn_body = fn_body[:am.start()] + indented_block + fn_body[am.start():]
    new_src = src[:fn_start] + new_fn_body + src[fn_end:]

    # Backup
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = f"{STORE_PY}.bak-{ts}"
    shutil.copy2(STORE_PY, bak)
    print(f"[backup] {bak}")

    open(STORE_PY, "w", encoding="utf-8").write(new_src)
    print("[patch] injected NORD_AUTO_DELIVER_V1 into process_vpn_buy()")


def main():
    ensure_tables()
    patch_store_py()
    print("\n✅ Done. Now run:  pm2 restart nexus-bot")


if __name__ == "__main__":
    main()
