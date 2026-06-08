#!/usr/bin/env python3
"""
=====================================================================
 V2 Patch: store.py — Manual সরাও, Binance polish, Auto direct link
=====================================================================
 কী পরিবর্তন:
   1. Deposit menu: শুধু ২টা option (⚡ Auto bKash/Nagad + 🪙 Binance USDT)
   2. Manual deposit (screenshot ছাড়া sender number flow) সরানো হলো
   3. Auto: amount দিলে সরাসরি payment URL — bold clickable button + plain link
   4. Binance: প্রথমে ডলার (English digit) → $1=122৳ → screenshot → admin approve/reject
   5. বাংলায় বিস্তারিত instruction + premium emoji 💎🌟✨
   6. User কে "deposit request পাঠানো হয়েছে, admin check করবে" notice

 কীভাবে চালাবেন (VPS এ):
   cd /root
   python3 apply-v2-patch.py
   pm2 restart nexus-bot && pm2 logs nexus-bot --lines 30

 Revert:
   ls -t store.py.backup-* | head -1 | xargs -I{} cp {} store.py
   pm2 restart nexus-bot
=====================================================================
"""
import os, sys, shutil, time, py_compile, re

STORE_PY = "store.py"
BACKUP   = f"{STORE_PY}.backup-v2-{int(time.time())}"

# ============== HELPER (idempotent — already-patched হলে skip) ==============
NEW_HELPER = '''
# ===== ZiniPay Auto-Deposit Helper (v2) =====
import requests as _zp_requests
VPS_ADMIN_URL   = os.environ.get("VPS_ADMIN_URL", "http://localhost:3000")
DOWNLOAD_SECRET = os.environ.get("DOWNLOAD_SECRET", "")

def create_zinipay_invoice(user_id: int, username: str, amount: int):
    try:
        r = _zp_requests.post(
            f"{VPS_ADMIN_URL}/zinipay/create-invoice",
            json={"secret": DOWNLOAD_SECRET, "user_id": user_id,
                  "username": username, "amount": int(amount)},
            timeout=15,
        )
        data = r.json()
        if r.ok and data.get("ok"):
            return data.get("payment_url")
        print(f"[zinipay] create failed: {r.status_code} {data}")
        return None
    except Exception as e:
        print(f"[zinipay] exception: {e}")
        return None
# ===== /ZiniPay Helper =====
'''

# ============== NEW dep_start (2 options only) ==============
NEW_DEP_START = r'''@dp.callback_query(F.data == "deposit")
async def dep_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    kb = InlineKeyboardBuilder()
    kb.row(types.InlineKeyboardButton(text="⚡ Auto Payment (bKash / Nagad)", callback_data="dep_auto"))
    kb.row(types.InlineKeyboardButton(text="💎 Binance USDT", callback_data="dep_binance"))
    await c.message.answer(
        "🌟 *ডিপোজিট পদ্ধতি বাছাই করুন* 🌟\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "⚡ *Auto Payment* — সবচেয়ে দ্রুত ও সহজ\n"
        "   ▸ bKash / Nagad সাপোর্ট\n"
        "   ▸ এক ক্লিকে পেমেন্ট পেজ\n"
        "   ▸ ১০-৩০ সেকেন্ডে ব্যালেন্স যোগ\n"
        "   ▸ মিনিমাম ১০৳\n\n"
        "💎 *Binance USDT* — ডলারে পেমেন্ট\n"
        "   ▸ Rate: *$1 = 122৳* (fixed)\n"
        "   ▸ Screenshot পাঠাবেন\n"
        "   ▸ Admin ম্যানুয়ালি অ্যাপ্রুভ করবে\n"
        "   ▸ মিনিমাম 1$\n"
        "━━━━━━━━━━━━━━━━━━━━━",
        reply_markup=kb.as_markup(),
        parse_mode="Markdown"
    )

@dp.callback_query(F.data == "dep_auto")
async def dep_auto_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    await c.message.answer(
        "⚡ *Auto Payment*\n\n"
        "💰 কত টাকা ডিপোজিট করবেন? \n"
        "শুধু সংখ্যা লিখুন (যেমন: `100`)\n\n"
        "ℹ️ মিনিমাম ১০৳ — Submit করলেই পেমেন্ট লিংক পাবেন।",
        parse_mode="Markdown"
    )
    await state.update_data(deposit_method="auto")
    await state.set_state(ShopStates.waiting_for_deposit_amount)

@dp.callback_query(F.data == "dep_binance")
async def dep_binance_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    await c.message.answer(
        "💎 *Binance USDT Deposit*\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        f"🏦 *Binance UID:* `{BINANCE_ID}`\n"
        "💱 *Rate:* `$1 = 122৳` (fixed)\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        "💵 কত ডলার পাঠাবেন? \n"
        "শুধু সংখ্যা লিখুন (যেমন: `5` মানে $5)\n\n"
        "ℹ️ মিনিমাম 1$ = 122৳",
        parse_mode="Markdown"
    )
    await state.update_data(deposit_method="binance")
    await state.set_state(ShopStates.waiting_for_deposit_amount)
'''

# ============== NEW dep_amt (auto → direct URL, binance → $→৳→screenshot) ==============
NEW_DEP_AMT = r'''@dp.message(ShopStates.waiting_for_deposit_amount)
async def dep_amt(m: types.Message, state: FSMContext):
    if m.text.startswith("/"): return
    val_str = to_english_num(m.text).strip()
    _data = await state.get_data()
    _method = _data.get("deposit_method", "auto")

    # ============ AUTO (ZiniPay) ============
    if _method == "auto":
        if not val_str.isdigit() or int(val_str) < 10:
            return await m.answer("⚠️ মিনিমাম *১০ টাকা*। শুধু সংখ্যা লিখুন (যেমন: `100`)", parse_mode="Markdown")
        amt = int(val_str)
        username = f"@{m.from_user.username}" if m.from_user.username else m.from_user.first_name
        wait_msg = await m.answer("⏳ পেমেন্ট লিংক তৈরি হচ্ছে...")
        payment_url = create_zinipay_invoice(m.from_user.id, username, amt)
        try: await wait_msg.delete()
        except: pass
        if not payment_url:
            await m.answer("❌ পেমেন্ট gateway এ সমস্যা। একটু পরে আবার চেষ্টা করুন অথবা 💎 Binance ব্যবহার করুন।")
            await state.clear()
            return
        kb = InlineKeyboardBuilder()
        kb.row(types.InlineKeyboardButton(text=f"💳 এখনই পেমেন্ট করুন — {amt}৳", url=payment_url))
        await m.answer(
            f"✨ *পেমেন্ট লিংক রেডি* ✨\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💰 Amount: *{amt}৳*\n"
            f"⚡ Method: bKash / Nagad (Auto)\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔗 নিচের বোতামে ট্যাপ করুন — সরাসরি পেমেন্ট পেজে চলে যাবেন।\n\n"
            f"✅ পেমেন্ট সফল হলে *১০-৩০ সেকেন্ডে* ব্যালেন্স অটো যোগ হবে।\n"
            f"🔔 কোনো screenshot বা confirmation message পাঠাতে হবে না।",
            reply_markup=kb.as_markup(),
            parse_mode="Markdown",
            disable_web_page_preview=True
        )
        await state.clear()
        return

    # ============ BINANCE ($→BDT→screenshot) ============
    if _method == "binance":
        # ডলার amount পাছ — শুধু সংখ্যা / দশমিক
        clean = val_str.replace("$", "").replace("usd", "").replace("USD", "").strip()
        try:
            usd = float(clean)
        except:
            return await m.answer("⚠️ শুধু সংখ্যা লিখুন (যেমন: `5` মানে $5)", parse_mode="Markdown")
        if usd < 1:
            return await m.answer("⚠️ মিনিমাম *$1*। আবার লিখুন।", parse_mode="Markdown")
        bdt_amount = int(round(usd * 122))
        await state.update_data(amount_text=str(bdt_amount), usd_amount=str(usd))
        await m.answer(
            f"💎 *Binance Deposit Confirm*\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 You send: *${usd}*\n"
            f"💱 Rate: `$1 = 122৳`\n"
            f"💰 You'll get: *{bdt_amount}৳*\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🏦 Binance UID: `{BINANCE_ID}`\n\n"
            f"📸 *এখন পেমেন্টের screenshot পাঠান* (বাধ্যতামূলক)\n"
            f"⚠️ Screenshot ছাড়া রিকোয়েস্ট গ্রহণ হবে না।",
            parse_mode="Markdown"
        )
        await state.set_state(ShopStates.waiting_for_screenshot)
        return

    # Fallback
    await m.answer("⚠️ Session expired। আবার /start দিন।")
    await state.clear()
'''


def die(msg):
    print(f"\n❌ {msg}\n"); sys.exit(1)


def main():
    if not os.path.exists(STORE_PY):
        die(f"{STORE_PY} এই folder এ নাই। `cd /root` করে আবার চালান।")

    shutil.copy2(STORE_PY, BACKUP)
    print(f"✅ Backup: {BACKUP}")

    with open(STORE_PY, "r", encoding="utf-8") as f:
        src = f.read()

    # 1) Helper — add if missing
    if "create_zinipay_invoice" not in src:
        import_lines = list(re.finditer(r'^(?:import |from )\S.*$', src, re.MULTILINE))
        if not import_lines: die("Kono import line nai")
        pos = import_lines[-1].end()
        src = src[:pos] + "\n" + NEW_HELPER + src[pos:]
        print("✅ Helper added")
    else:
        print("ℹ️  Helper already exists (skip)")

    # 2) Replace dep_start block — from `@dp.callback_query(F.data == "deposit")` 
    #    up to (but not including) `@dp.message(ShopStates.waiting_for_deposit_num)`
    #    OR `@dp.message(ShopStates.waiting_for_deposit_amount)` whichever comes first
    pat_start = re.compile(
        r'@dp\.callback_query\(F\.data == "deposit"\)\s*\n'
        r'async def dep_start\(.*?\n'
        r'(?=@dp\.message\(ShopStates\.waiting_for_deposit_(?:num|amount)\))',
        re.DOTALL
    )
    if not pat_start.search(src):
        die("dep_start block পাওয়া যায়নি")
    src = pat_start.sub(NEW_DEP_START + "\n", src, count=1)
    print("✅ dep_start replaced (2 options, manual removed)")

    # 3) Remove leftover dep_num handler if exists (manual flow remnant)
    pat_num = re.compile(
        r'@dp\.message\(ShopStates\.waiting_for_deposit_num\)\s*\n'
        r'async def \w+\(.*?\n'
        r'(?=@dp\.(?:message|callback_query))',
        re.DOTALL
    )
    if pat_num.search(src):
        src = pat_num.sub("", src, count=1)
        print("✅ Old dep_num (manual sender-number) handler removed")
    else:
        print("ℹ️  No dep_num handler found (already clean)")

    # 4) Replace dep_amt
    pat_amt = re.compile(
        r'@dp\.message\(ShopStates\.waiting_for_deposit_amount\)\s*\n'
        r'async def dep_amt\(.*?\n'
        r'(?=@dp\.message\(ShopStates\.waiting_for_screenshot\))',
        re.DOTALL
    )
    if not pat_amt.search(src):
        die("dep_amt block পাওয়া যায়নি")
    src = pat_amt.sub(NEW_DEP_AMT + "\n", src, count=1)
    print("✅ dep_amt replaced (auto=direct link, binance=$→৳→screenshot)")

    with open(STORE_PY, "w", encoding="utf-8") as f:
        f.write(src)

    try:
        py_compile.compile(STORE_PY, doraise=True)
        print("✅ Syntax OK")
    except py_compile.PyCompileError as e:
        shutil.copy2(BACKUP, STORE_PY)
        die(f"Syntax error — backup restored: {e}")

    print(f"\n🎉 V2 patch successful!\n")
    print(f"   • Backup: {BACKUP}")
    print(f"   • Restart: pm2 restart nexus-bot && pm2 logs nexus-bot --lines 30")
    print(f"   • Revert:  cp {BACKUP} {STORE_PY} && pm2 restart nexus-bot\n")


if __name__ == "__main__":
    main()
