#!/usr/bin/env bash
# =====================================================================
#  ZiniPay One-Click Setup
#  ব্যবহার:  bash setup-zinipay.sh
#  এই script যা করে:
#   1. আপনার থেকে ZiniPay API key, Bot token, Bot username চায়
#   2. vps-admin/.env এ সব key লিখে দেয়
#   3. store.py খুঁজে বের করে patch apply করে
#   4. bot এর .env এ VPS_ADMIN_URL + DOWNLOAD_SECRET লিখে দেয়
#   5. python requests install করে
#   6. pm2 দিয়ে vps-admin আর bot restart করে
#   7. শেষে log দেখায়
# =====================================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  ZiniPay Auto Setup শুরু হচ্ছে...${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# ---------- STEP 1: vps-admin folder খোঁজা ----------
VPS_ADMIN_DIR=""
for p in /root/vps-admin /home/ubuntu/vps-admin /root/nexus-x/vps-admin /var/www/vps-admin; do
  if [ -f "$p/server.js" ]; then VPS_ADMIN_DIR="$p"; break; fi
done
if [ -z "$VPS_ADMIN_DIR" ]; then
  VPS_ADMIN_DIR=$(dirname "$(find / -name "server.js" -path "*/vps-admin/*" -not -path "*/node_modules/*" 2>/dev/null | head -1)")
fi
if [ ! -f "$VPS_ADMIN_DIR/server.js" ]; then
  echo -e "${RED}❌ vps-admin folder পাওয়া যায়নি। Path manually দিন:${NC}"
  read -r VPS_ADMIN_DIR
fi
echo -e "${GREEN}✓ vps-admin path: $VPS_ADMIN_DIR${NC}"

# ---------- STEP 2: store.py খোঁজা ----------
STORE_PY=$(find / -name "store.py" -not -path "*/node_modules/*" -not -path "*/.local/*" 2>/dev/null | head -1)
if [ ! -f "$STORE_PY" ]; then
  echo -e "${RED}❌ store.py পাওয়া যায়নি। Full path দিন:${NC}"
  read -r STORE_PY
fi
BOT_DIR=$(dirname "$STORE_PY")
echo -e "${GREEN}✓ store.py path: $STORE_PY${NC}"
echo -e "${GREEN}✓ bot folder: $BOT_DIR${NC}"
echo ""

# ---------- STEP 3: User input ----------
echo -e "${YELLOW}নিচের তথ্যগুলো দিন (Enter চাপলে পুরানোটাই থাকবে):${NC}"
echo ""

# পুরানো values পড়া
OLD_ZINI=$(grep -E "^ZINIPAY_API_KEY=" "$VPS_ADMIN_DIR/.env" 2>/dev/null | cut -d= -f2- || echo "")
OLD_BOT_TOKEN=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$VPS_ADMIN_DIR/.env" 2>/dev/null | cut -d= -f2- || echo "")
OLD_BOT_USER=$(grep -E "^BOT_USERNAME=" "$VPS_ADMIN_DIR/.env" 2>/dev/null | cut -d= -f2- || echo "")

read -p "1) ZiniPay Brand/API Key [${OLD_ZINI:0:8}...]: " ZINIPAY_API_KEY
ZINIPAY_API_KEY=${ZINIPAY_API_KEY:-$OLD_ZINI}

read -p "2) Telegram Bot Token [${OLD_BOT_TOKEN:0:10}...]: " TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-$OLD_BOT_TOKEN}

read -p "3) Bot Username (without @) [${OLD_BOT_USER}]: " BOT_USERNAME
BOT_USERNAME=${BOT_USERNAME:-$OLD_BOT_USER}

ZINIPAY_PUBLIC_BASE="https://pay.nexus-x.cloud"

if [ -z "$ZINIPAY_API_KEY" ] || [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$BOT_USERNAME" ]; then
  echo -e "${RED}❌ সব field দিতে হবে। আবার চালান।${NC}"
  exit 1
fi

# ---------- STEP 4: vps-admin/.env update ----------
echo ""
echo -e "${GREEN}→ vps-admin/.env update করা হচ্ছে...${NC}"
ENV_FILE="$VPS_ADMIN_DIR/.env"
touch "$ENV_FILE"

# DOWNLOAD_SECRET না থাকলে generate করো
DOWNLOAD_SECRET=$(grep -E "^DOWNLOAD_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
if [ -z "$DOWNLOAD_SECRET" ]; then
  DOWNLOAD_SECRET=$(openssl rand -hex 32)
fi

update_env() {
  local key=$1
  local value=$2
  local file=$3
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    # Use | as sed delimiter to avoid issues with / in values
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

update_env "ZINIPAY_API_KEY" "$ZINIPAY_API_KEY" "$ENV_FILE"
update_env "TELEGRAM_BOT_TOKEN" "$TELEGRAM_BOT_TOKEN" "$ENV_FILE"
update_env "ZINIPAY_PUBLIC_BASE" "$ZINIPAY_PUBLIC_BASE" "$ENV_FILE"
update_env "BOT_USERNAME" "$BOT_USERNAME" "$ENV_FILE"
update_env "DOWNLOAD_SECRET" "$DOWNLOAD_SECRET" "$ENV_FILE"
echo -e "${GREEN}✓ vps-admin/.env saved${NC}"

# ---------- STEP 5: bot এর .env update ----------
echo -e "${GREEN}→ bot/.env update করা হচ্ছে...${NC}"
BOT_ENV="$BOT_DIR/.env"
touch "$BOT_ENV"
update_env "VPS_ADMIN_URL" "http://localhost:3000" "$BOT_ENV"
update_env "DOWNLOAD_SECRET" "$DOWNLOAD_SECRET" "$BOT_ENV"
echo -e "${GREEN}✓ bot/.env saved${NC}"

# ---------- STEP 6: python-dotenv + requests install ----------
echo -e "${GREEN}→ Python dependencies install করা হচ্ছে...${NC}"
# Python 3.12+ এ PEP 668 এর জন্য --break-system-packages দরকার
pip3 install --quiet --break-system-packages requests python-dotenv 2>/dev/null \
  || pip install --quiet --break-system-packages requests python-dotenv 2>/dev/null \
  || python3 -m pip install --quiet --break-system-packages requests python-dotenv 2>/dev/null \
  || { echo -e "${YELLOW}⚠ pip install ব্যর্থ — apt দিয়ে চেষ্টা করছি...${NC}"; apt install -y python3-requests python3-dotenv; }

# ---------- STEP 7: store.py এ dotenv ensure করা ----------
if ! grep -q "from dotenv import load_dotenv" "$STORE_PY"; then
  echo -e "${GREEN}→ store.py তে load_dotenv() add করা হচ্ছে...${NC}"
  # Backup আগে
  cp "$STORE_PY" "${STORE_PY}.predotenv-$(date +%s)"
  # First import line এর আগে inject
  python3 - <<PYEOF
import re
path = "$STORE_PY"
with open(path) as f:
    code = f.read()
if "load_dotenv" not in code:
    inject = "from dotenv import load_dotenv\nload_dotenv()\n"
    # Add after first import block
    lines = code.split("\n")
    insert_at = 0
    for i, l in enumerate(lines[:50]):
        if l.startswith("import ") or l.startswith("from "):
            insert_at = i + 1
    lines.insert(insert_at, inject)
    with open(path, "w") as f:
        f.write("\n".join(lines))
print("dotenv injected")
PYEOF
fi

# ---------- STEP 8: store.py patch (ZiniPay handlers) ----------
echo -e "${GREEN}→ store.py তে ZiniPay patch apply করা হচ্ছে...${NC}"
cp "$VPS_ADMIN_DIR/apply-zinipay-patch.py" "$BOT_DIR/apply-zinipay-patch.py"
cd "$BOT_DIR"
python3 apply-zinipay-patch.py || {
  echo -e "${YELLOW}⚠ Patch already applied বা manual check দরকার। চলতে থাকছি...${NC}"
}

# ---------- STEP 9: PM2 restart ----------
echo -e "${GREEN}→ Services restart করা হচ্ছে...${NC}"
cd "$VPS_ADMIN_DIR"
pm2 restart vps-admin --update-env 2>/dev/null || pm2 start server.js --name vps-admin --update-env

cd "$BOT_DIR"
pm2 restart bot --update-env 2>/dev/null || pm2 start store.py --name bot --interpreter python3 --update-env

pm2 save

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  ✅ Setup সফল!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${YELLOW}নিচের logs দেখুন (Ctrl+C দিয়ে বের হবেন):${NC}"
echo ""
sleep 2
pm2 logs --lines 20
