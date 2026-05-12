
# Web Admin Panel — Plan

## গুরুত্বপূর্ণ কথা প্রথমে (Important architecture note)

আপনি চাইছেন **bot + web panel একই VPS এ same `store.db` SQLite ফাইল share করুক**। এটাই সঠিক সিদ্ধান্ত — কারণ:
- কোনো data migration লাগবে না (zero risk of data loss)
- Bot কোডে এক লাইনও change করতে হবে না
- Real-time sync (যা bot লিখবে, web সাথে সাথে দেখাবে)

কিন্তু এর মানে — **Lovable এর default Cloudflare hosting এ এই panel চলবে না** (Cloudflare Worker আপনার VPS এর ফাইল access করতে পারে না)। তাই আমরা একটা **Node.js + Express + better-sqlite3** based admin panel বানাবো যেটা আপনি **আপনার VPS এ pm2 দিয়ে bot এর পাশে চালাবেন**। Lovable এ আমরা শুধু code তৈরি করব, তারপর VPS এ deploy করব।

> বিকল্প: যদি আপনি চান Lovable এ host হোক, তাহলে SQLite থেকে Postgres এ migrate করতে হবে এবং bot code change করতে হবে — risky। তাই VPS-হোস্টেড পথই recommended.

---

## যা বানাবো (Phase 1 features)

1. **🔐 Login** — single master password (bcrypt hashed, env file এ রাখা), HTTP-only session cookie
2. **📊 Dashboard** — মোট user, আজকের deposit, total balance, low-stock alert, pending replace requests
3. **👥 User Management** — সব user list (telegram id, username, balance, join date), search, balance manual adjust (audit log সহ), user এর order history
4. **💰 Deposit Tracking** — সব deposit log (Bkash/Nagad/Binance), filter by date/method/user, total summary
5. **📦 Stock Upload (Excel)** — `.xlsx` upload করে bulk VPN/Ad account stock add. Format: `category | product | data` columns. Preview দেখাবে → confirm → DB তে insert
6. **🔄 Replace Requests** — bot এ user `/replace` দিলে DB তে save হবে → web এ admin দেখবে → "Mark Collected" button → delete. (এর জন্য bot code এ একটাই ছোট addition লাগবে — নিচে দেখুন)
7. **📥 Order Excel Export** — যখন user কেনে, তখনও bot এই system থেকে Excel format এ ID গুলো send করবে। Web এ admin চাইলে যেকোনো order এর Excel download করতে পারবে
8. **📜 Audit Log** — admin যা যা করল সব log

---

## Database changes (minimal & safe)

Existing tables একদমই touch করব না। শুধু ৩টা **নতুন table** add করব (bot এ effect পড়বে না):

```sql
CREATE TABLE IF NOT EXISTS replace_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, username TEXT, order_id TEXT,
  product