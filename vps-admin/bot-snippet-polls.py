# =========================================================================
# POLL SYSTEM — bot-side snippet
# এই snippet আপনার bot file-এ paste করুন (যেখানে অন্য handler গুলো আছে)।
# Requirements:
#   - python-telegram-bot v20+  (অথবা aiogram — নিচে দুটোর version-ই আছে)
#   - একই store.db ব্যবহার করে
# Paste করার পর bot restart করুন: pm2 restart <your-bot-name>
# =========================================================================

import json, time, sqlite3, os

DB_PATH = os.environ.get('DB_PATH', '/root/store.db')

def _db():
    c = sqlite3.connect(DB_PATH, timeout=5)
    c.execute('PRAGMA journal_mode=WAL')
    c.execute('PRAGMA busy_timeout=5000')
    return c

def save_poll_vote(tg_poll_id: str, user_id: int, username: str, option_ids: list):
    """User vote দিলে এটা call করুন। Web admin তখন result দেখাবে।"""
    con = _db()
    try:
        row = con.execute(
            'SELECT poll_id FROM poll_sent_map WHERE tg_poll_id = ?',
            (tg_poll_id,)
        ).fetchone()
        if not row:
            return  # এই poll আমাদের system-এর না
        poll_id = row[0]
        con.execute('''
            INSERT INTO poll_votes (poll_id, tg_poll_id, user_id, username, option_ids, voted_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(tg_poll_id, user_id) DO UPDATE SET
                option_ids = excluded.option_ids,
                voted_at   = excluded.voted_at,
                username   = excluded.username
        ''', (poll_id, tg_poll_id, user_id, username or '',
              json.dumps(list(option_ids)), int(time.time() * 1000)))
        con.commit()
    finally:
        con.close()


# ─────────────────────────────────────────────────────────────────────────
# OPTION A — python-telegram-bot (v20+)
# ─────────────────────────────────────────────────────────────────────────
# আপনার Application setup-এর কাছে এটা add করুন:
#
# from telegram.ext import PollAnswerHandler
#
# async def on_poll_answer(update, context):
#     pa = update.poll_answer
#     u  = pa.user
#     save_poll_vote(pa.poll_id, u.id, u.username or u.first_name or '', pa.option_ids)
#
# application.add_handler(PollAnswerHandler(on_poll_answer))


# ─────────────────────────────────────────────────────────────────────────
# OPTION B — aiogram v3
# ─────────────────────────────────────────────────────────────────────────
# from aiogram import F
# from aiogram.types import PollAnswer
#
# @dp.poll_answer()
# async def on_poll_answer(poll_answer: PollAnswer):
#     u = poll_answer.user
#     save_poll_vote(poll_answer.poll_id, u.id,
#                    u.username or u.first_name or '', poll_answer.option_ids)


# ─────────────────────────────────────────────────────────────────────────
# (Optional) Admin command: /newpoll প্রশ্ন | option1 | option2 | option3
# ─────────────────────────────────────────────────────────────────────────
ADMIN_IDS = {123456789}  # ← আপনার Telegram admin id দিন

async def cmd_newpoll_ptb(update, context):
    """python-telegram-bot version"""
    if update.effective_user.id not in ADMIN_IDS:
        return await update.message.reply_text('❌ Admin only')
    raw = update.message.text.partition(' ')[2].strip()
    parts = [p.strip() for p in raw.split('|') if p.strip()]
    if len(parts) < 3:
        return await update.message.reply_text('Usage: /newpoll প্রশ্ন | option1 | option2 | ...')
    question, options = parts[0], parts[1:11]

    con = _db()
    cur = con.execute('''INSERT INTO polls
        (question, options_json, is_anonymous, allows_multiple, created_by, created_at, status)
        VALUES (?, ?, 0, 0, ?, ?, 'sent')''',
        (question, json.dumps(options), f'tg:{update.effective_user.id}', int(time.time()*1000)))
    poll_id = cur.lastrowid
    user_ids = [r[0] for r in con.execute(
        'SELECT user_id FROM users WHERE COALESCE(is_banned,0)=0').fetchall()]
    con.commit()

    sent = failed = 0
    for uid in user_ids:
        try:
            msg = await context.bot.send_poll(chat_id=uid, question=question,
                                              options=options, is_anonymous=False)
            con.execute('''INSERT OR IGNORE INTO poll_sent_map
                (tg_poll_id, poll_id, user_id, chat_message_id, sent_at)
                VALUES (?, ?, ?, ?, ?)''',
                (msg.poll.id, poll_id, uid, msg.message_id, int(time.time()*1000)))
            sent += 1
        except Exception:
            failed += 1
        time.sleep(0.04)
    con.execute('UPDATE polls SET sent_count=?, failed_count=? WHERE id=?',
                (sent, failed, poll_id))
    con.commit(); con.close()
    await update.message.reply_text(f'✅ Sent: {sent}, Failed: {failed}\nView: /polls/{poll_id}')

# application.add_handler(CommandHandler('newpoll', cmd_newpoll_ptb))
