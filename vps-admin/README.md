# Basictrick Admin Panel — VPS Deployment Guide

## কী এটা?

আপনার Telegram bot (`store.db` SQLite) এর জন্য একটা **web-based admin panel**। বট এর কোনো কোড পরিবর্তন হয়নি — শুধু একই DB ফাইল share করে read/write করে।

---

## কী কী Feature আছে?

| Feature | কী করে |
|---------|--------|
| 🔐 Master password login | Single password দিয়ে owner login |
| 📊 Dashboard | Total user, balance, today's deposit, low-stock alert |
| 👥 Users | Search, balance adjust, ban/unban, history |
| 💰 Deposits | সব deposit log filter সহ |
| 📦 Stock | Excel upload, manual add, category-wise count |
| 🔄 Replace Requests | User এর replace request collect/delete |
| 📥 Orders | Excel format এ download |
| 📜 Audit Log | Admin এর সব action log |

---

## VPS এ Deploy করার পদ্ধতি (step by step)

### ১. Node.js install (যদি না থাকে)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

### ২. কোড upload

আপনার bot যেখানে আছে সেই folder এ `vps-admin` folder টা copy করুন।  
ধরুন bot আছে `/root/bot/` এ → `vps-admin` থাকবে `/root/bot/vps-admin/`।  
**গুরুত্বপূর্ণ:** `store.db` থাকবে `/root/bot/store.db` এ — `vps-admin` সেটা `../store.db` দিয়ে access করবে।

```bash
cd /root/bot/vps-admin
```

### ৩. Dependencies install

```bash
npm install
```

### ৪. Config setup

```bash
cp .env.example .env
nano .env
```

`.env` এ এই ৩টা জিনিস অবশ্যই change করুন:

```env
DB_PATH=../store.db
PORT=3000
SESSION_SECRET=<কোনো লম্বা random string>
ADMIN_PASSWORD=<আপনার master password>
```

> ⚠ `ADMIN_PASSWORD` শুধু প্রথমবার হ্যাশ হয়ে DB তে save হবে। এর পরে DB থেকেই verify হবে। পরে web এ login করে dashboard থেকে change করতে পারবেন।

### ৫. Test run

```bash
node server.js
```

`http://YOUR_VPS_IP:3000` এ গিয়ে login দেখুন।

### ৬. PM2 দিয়ে background এ চালান

```bash
sudo npm install -g pm2
pm2 start server.js --name basictrick-admin
pm2 save
pm2 startup    # output এর command টা copy-paste করে চালান
```

**Logs দেখতে:**
```bash
pm2 logs basictrick-admin
```

**Restart করতে:**
```bash
pm2 restart basictrick-admin
```

### ৭. (Optional) Domain + HTTPS

Nginx + Let's Encrypt দিয়ে domain বসাতে চাইলে — nginx এ এই reverse proxy বসান:

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

তারপর: `sudo certbot --nginx -d admin.yourdomain.com`

---

## Bot এ Replace Request Add করা

`vps-admin/bot-snippet.py` ফাইলটা খুলুন, ভেতরের instructions follow করুন। মূল কথা:

1. `save_replace_request()` function টা bot এর top এ add করুন।
2. আপনার existing replace handler এ ১ লাইন call add করুন।

বট restart দিন:
```bash
pm2 restart your-bot-name
```

এর পর user replace request দিলে web panel এ "🔄 Replace Requests" এ চলে আসবে।

---

## Excel Stock Upload Format

`stock.xlsx` ফাইলে দুইটা column:

| category | data |
|----------|------|
| fb61     | email1@x.com\|password1 |
| fb1000   | email2@x.com\|password2 |
| tempid   | sometempid123 |

প্রথম row header হবে। Upload → Preview দেখুন → Confirm।

---

## ⚠ গুরুত্বপূর্ণ Safety Notes

1. **DB backup নিন regularly:** `cp /root/bot/store.db /root/backups/store-$(date +%Y%m%d).db`
2. **Bot ও admin panel একই VPS এ থাকতে হবে** — একই `store.db` access করার জন্য।
3. SQLite WAL mode enabled — bot ও admin একসাথে read/write safe।
4. Master password শক্ত দিন। `.env` ফাইল কাউকে দেবেন না।
5. Port 3000 firewall এ open করুন (অথবা nginx দিয়ে proxy করুন — recommended)।

---

## Troubleshoot

| সমস্যা | সমাধান |
|--------|--------|
| `SQLITE_CANTOPEN` error | `.env` এ `DB_PATH` সঠিক কিনা দেখুন (relative to `vps-admin/`) |
| Port already in use | `.env` এ `PORT` change করুন |
| Login হচ্ছে না | DB তে `admin_auth` table delete করে server restart দিন → নতুন password .env থেকে নিবে |
| `better-sqlite3` install fail | `sudo apt install build-essential python3` তারপর `npm install` |

```bash
# Login reset করতে চাইলে:
sqlite3 /root/bot/store.db "DELETE FROM admin_auth;"
pm2 restart basictrick-admin
```
