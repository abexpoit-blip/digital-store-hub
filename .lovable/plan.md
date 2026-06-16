
# Telegram Poll System — Plan

## কী বানাবো (সহজ ভাষায়)

Admin একটা **question + কয়েকটা option** দেবে (যেমন "আজকের সেরা VPN কোনটা?" — Option A, B, C, D)। সেটা **সব registered user-এর Telegram-এ** Telegram-এর native Poll হিসেবে পৌঁছে যাবে। User tap করে vote দেবে → vote DB-তে save হবে → admin web panel-এ result (কে কত vote, কোন option কত %) দেখবে।

কোনো reward নেই — শুধু feedback/survey collect।

---

## কোথায় কী কাজ হবে

| Component | কাজ |
|---|---|
| **`store.db` (SQLite)** | নতুন ২টা table: `polls`, `poll_votes` |
| **Web admin (`vps-admin/`)** | নতুন `/polls` page — create, list, send-to-all, result দেখা |
| **Telegram bot (Python)** | ২টা addition: `/newpoll` admin command + `poll_answer` handler (vote save) |

---

## Database (২টা নতুন table — bot-এর কিছু touch না)

```sql
CREATE TABLE polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,          -- ["A","B","C"]
  is_anonymous INTEGER DEFAULT 0,       -- 0 = vote কে দিল track হবে
  allows_multiple INTEGER DEFAULT 0,
  created_by TEXT,                      -- 'web-admin' / telegram admin id
  created_at INTEGER NOT NULL,
  sent_count INTEGER DEFAULT 0,         -- কতজনের কাছে পাঠানো হয়েছে
  status TEXT DEFAULT 'draft'           -- draft / sent / closed
);

CREATE TABLE poll_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  tg_poll_id TEXT NOT NULL,            -- Telegram-এর poll id (per-user unique)
  user_id INTEGER NOT NULL,
  username TEXT,
  option_ids TEXT NOT NULL,            -- "[0,2]" JSON array
  voted_at INTEGER NOT NULL,
  UNIQUE(tg_poll_id, user_id)
);
CREATE INDEX idx_pv_poll ON poll_votes(poll_id);

-- Map: যখন bot poll send করবে, প্রতি user-এর জন্য আলাদা tg_poll_id আসে
CREATE TABLE poll_sent_map (
  tg_poll_id TEXT PRIMARY KEY,
  poll_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  sent_at INTEGER NOT NULL
);
```

---

## Web admin changes (`vps-admin/`)

1. **`routes/polls.js`** (নতুন) — endpoints:
   - `GET /polls` → list সব poll + result summary
   - `GET /polls/new` → create form
   - `POST /polls/create` → DB-তে save (status=draft)
   - `POST /polls/:id/send` → bot-এর `pending_polls` flag set করে দেবে; bot পরের poll cycle-এ pickup করে সব user-কে পাঠাবে (queue table দিয়ে)। অথবা সহজ পথ: web থেকে directly Telegram API call করে (LOVABLE_API_KEY/connector নেই — bot token .env-এ আছে)। **সহজ পথটাই নেব** — `node-fetch` দিয়ে `https://api.telegram.org/bot<TOKEN>/sendPoll` সরাসরি call, sequentially সব user-এর কাছে।
   - `GET /polls/:id` → result detail (option-wise count, voter list)
   - `POST /polls/:id/close` → status=closed + Telegram `stopPoll` call
   - `POST /polls/:id/delete`

2. **`views/polls.ejs`, `views/poll-new.ejs`, `views/poll-detail.ejs`** (নতুন)

3. **`views/partials/header.ejs`** — sidebar-এ `📊 Polls` link add

4. **`server.js`** — `app.use('/polls', requireLogin, require('./routes/polls'))`

5. **`.env`** — `BOT_TOKEN=...` add করতে হবে (web থেকেও sendPoll/stopPoll call করার জন্য)

---

## Bot changes (Python — VPS-এ আলাদা bot file)

আমি Python snippet তৈরি করে দেব (`vps-admin/bot-snippet-polls.py`), যেটা user নিজের bot file-এ paste করবে:

1. **`poll_answer` handler** — যখন user vote দেয়:
   ```python
   @dp.poll_answer()  # বা PollAnswerHandler
   async def on_poll_answer(poll_answer):
       # tg_poll_id, user_id, option_ids
       # → store.db-এর poll_votes table-এ INSERT OR REPLACE
   ```

2. **`/newpoll` admin command** (optional — admin chat থেকে quick create):
   ```
   /newpoll প্রশ্ন | option1 | option2 | option3
   ```
   → DB-তে poll save + সব user-কে broadcast

3. **Broadcast function** — `users` table থেকে সব tg_id নিয়ে loop করে `bot.send_poll(...)` call করে, প্রতিটার returned `poll.id`-কে `poll_sent_map`-এ save করে।

---

## Result দেখা (web admin)

`/polls/:id` page-এ:
- Question + options
- প্রতি option-এর vote count + %
- Total voter count / sent count
- Voter list (username + কোন option choose করেছে + time) — searchable table
- "Export CSV" button
- "Close Poll" button (vote bন্ধ হবে)

---

## Files যা create/modify হবে

**নতুন files:**
- `vps-admin/routes/polls.js`
- `vps-admin/views/polls.ejs`
- `vps-admin/views/poll-new.ejs`
- `vps-admin/views/poll-detail.ejs`
- `vps-admin/bot-snippet-polls.py` (Python paste-snippet — bot integration instructions সহ)
- `vps-admin/migrations/add-polls.sql` (manually run করার জন্য — তবে আমরা `db.js`-এর `CREATE TABLE IF NOT EXISTS` block-এ যোগ করব auto-create হবে)

**Modify:**
- `vps-admin/db.js` — ৩টা নতুন `CREATE TABLE IF NOT EXISTS` যোগ
- `vps-admin/server.js` — `/polls` route mount
- `vps-admin/views/partials/header.ejs` — sidebar link
- `vps-admin/.env.example` — `BOT_TOKEN=` line add

---

## Deployment flow (পরে যা চালাতে হবে)

```bash
cd /root/digital-store-hub && git stash && git pull && \
cd vps-admin && npm install && \
echo "BOT_TOKEN=আপনার_বট_টোকেন" >> .env && \
pm2 restart nexusx-admin --update-env && \
sleep 3 && pm2 logs nexusx-admin --lines 25 --nostream
```

তারপর Python bot file-এ snippet paste করে bot restart।

---

## এগোতে রাজি?

হ্যাঁ বললে আমি সব file লিখে দেব। **একটা প্রশ্ন বাকি**: poll কি **সব registered user**-কে পাঠাবে (default), নাকি admin-কে **user filter** (যেমন "শুধু যাদের balance > 0" বা "শেষ ৭ দিনে active") দিতে চান prepare করব?
