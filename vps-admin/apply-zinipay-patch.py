#!/usr/bin/env python3
"""
=====================================================================
 ZiniPay Auto-Patch Script for store.py
=====================================================================
 কী করে এই script?
   1. store.py এর backup নেয় (store.py.backup-<timestamp>)
   2. উপরে ZiniPay helper function add করে (imports এর পর)
   3. dep_start handler (deposit menu) update করে — 3টা option button
   4. dep_amt handler update করে — auto branch + পুরানো manual branch
   5. Syntax verify করে — fail হলে নিজে revert করে দেয়

 কীভাবে চালাবেন:
   cd /root        # store.py যে folder এ আছে
   python3 apply-zinipay-patch.py

 Revert করতে চাইলে:
   cp store.py.backup-<timestamp> store.py
   pm2 restart bot
=====================================================================
"""

import os
import sys
import shutil
import time
import py_compile
import re

STORE_PY = "store.py"
BACKUP   = f"{STORE_PY}.backup-{int(time.time())}"

# ============== 1. NEW IMPORTS + HELPER ==============
NEW_HELPER = '''
# ===== ZiniPay Auto-Deposit Helper (added by patch) =====
import requests as _zp_requests
VPS_ADMIN_URL   = os.environ.get("VPS_ADMIN_URL", "http://localhost:3000")
DOWNLOAD_SECRET = os.environ.get("DOWNLOAD_SECRET", "")

def create_zinipay_invoice(user_id: int, username: str, amount: int):
    """admin panel এর /zinipay/create-invoice কে call করে — returns payment_url or None"""
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

# ============== 2. NEW dep_start ==============
NEW_DEP_START = r'''@dp.callback_query(F.data == "deposit")
async def dep_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    kb = InlineKeyboardBuilder()
    kb.row(types.InlineKeyboardButton(text="⚡ Auto (bKash/Nagad)", callback_data="dep_auto"))
    kb.row(types.InlineKeyboardButton(text="📝 Manual (Screenshot)", callback_data="dep_manual"))
    kb.row(types.InlineKeyboardButton(text="🪙 Binance", callback_data="dep_binance"))
    await c.message.answer(
        "💳 **Deposit Method বাছাই করুন**\\n\\n"
        "⚡ **Auto** — bKash/Nagad এ পাঠান, ১০-৩০ সেকেন্ডে balance যোগ হবে\\n"
        "📝 **Manual** — screenshot দিন, admin approve করবে\\n"
        "🪙 **Binance** — UID দিয়ে USDT পাঠান\\n\\n"
        "⚠️ মিনিমাম ১০৳ (Binance 1$)",
        reply_markup=kb.as_markup()
    )

@dp.callback_query(F.data == "dep_auto")
async def dep_auto_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    await c.message.answer("💰 কত টাকা deposit করবেন? (মিনিমাম 10, যেমন: 100)")
    await state.update_data(deposit_method="auto")
    await state.set_state(ShopStates.waiting_for_deposit_amount)

@dp.callback_query(F.data == "dep_manual")
async def dep_manual_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    msg = (f"📝 **Manual Deposit**\\n1️⃣ **Bkash:** `{BKASH_NUMBER}`\\n2️⃣ **Nagad:** `{NAGAD_NUMBER}`\\n\\n"
           f"⚠️ মিনিমাম ১০৳\\nটাকা পাঠানোর পর sender নাম্বার লিখুন:")
    await c.message.answer(msg)
    await state.update_data(deposit_method="manual")
    await state.set_state(ShopStates.waiting_for_deposit_num)

@dp.callback_query(F.data == "dep_binance")
async def dep_binance_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    msg = (f"🪙 **Binance Deposit**\\n🏦 UID: `{BINANCE_ID}`\\n\\nমিনিমাম 1$ (= 122৳)\\nUSDT পাঠানোর পর sender UID লিখুন:")
    await c.message.answer(msg)
    await state.update_data(deposit_method="binance")
    await state.set_state(ShopStates.waiting_for_deposit_num)
'''

# ============== 3. NEW dep_amt (auto branch + existing logic) ==============
NEW_DEP_AMT = r'''@dp.message(ShopStates.waiting_for_deposit_amount)
async def dep_amt(m: types.Message, state: FSMContext):
    if m.text.startswith("/"): return
    val_str = to_english_num(m.text).strip()
    _data = await state.get_data()
    _method = _data.get("deposit_method", "manual")

    # ----- AUTO (ZiniPay) branch -----
    if _method == "auto":
        if not val_str.isdigit() or int(val_str) < 10:
            return await m.answer("⚠️ মিনিমাম ১০ টাকা। সংখ্যায় লিখুন (যেমন: 100)")
        amt = int(val_str)
        username = f"@{m.from_user.username}" if m.from_user.username else m.from_user.first_name
        await m.answer("⏳ Invoice তৈরি হচ্ছে...")
        payment_url = create_zinipay_invoice(m.from_user.id, username, amt)
        if not payment_url:
            await m.answer("❌ Payment gateway error। Manual deposit ব্যবহার করুন বা পরে চেষ্টা করুন।")
            await state.clear()
            return
        kb = InlineKeyboardBuilder()
        kb.row(types.InlineKeyboardButton(text=f"💳 Pay {amt}৳ এখন", url=payment_url))
        await m.answer(
            f"✅ **Invoice Ready**\\n💰 Amount: *{amt}৳*\\n\\n"
            "নিচের button এ ক্লিক করে bKash/Nagad এ পেমেন্ট করুন।\\n"
            "পেমেন্ট হলে ১০-৩০ সেকেন্ডে automatic balance যোগ হবে।",
            reply_markup=kb.as_markup()
        )
        await state.clear()
        return

    # ----- Manual / Binance branch (পুরানো logic, অপরিবর্তিত) -----
    if '$' in val_str or 'usd' in val_str.lower():
        try:
            num = float(''.join(filter(lambda x: x.isdigit() or x == '.', val_str)))
            if num < 1: return await m.answer("⚠️ Binance মিনিমাম ১ ডলার।")
            
            bdt_amount = int(num * 122)
            await state.update_data(amount_text=str(bdt_amount))
            await m.answer(f"💵 $1 = 122৳ হিসেবে আপনার ডিপোজিট: **{bdt_amount}৳**\\n\\n📸 **পেমেন্টের স্ক্রিনশট দিন (বাধ্যতামূলক)**")
        except: return await m.answer("⚠️ সঠিক পরিমাণ লিখুন (যেমন: 1$)")

    elif val_str.isdigit():
        if int(val_str) < 10: return await m.answer("⚠️ মিনিমাম ডিপোজিট ১০ টাকা।")
        await state.update_data(amount_text=val_str)
        await m.answer("📸 **পেমেন্টের স্ক্রিনশট দিন (বাধ্যতামূলক)**\\nস্ক্রিনশট ছাড়া রিকোয়েস্ট গ্রহণ হবে না।")

    else:
        return await m.answer("⚠️ দয়া করে সংখ্যায় লিখুন (যেমন: 50 অথবা 1$)")

    await state.set_state(ShopStates.waiting_for_screenshot)
'''


def die(msg):
    print(f"\n❌ {msg}\n")
    sys.exit(1)


def main():
    if not os.path.exists(STORE_PY):
        die(f"{STORE_PY} এই folder এ নাই। সঠিক folder এ গিয়ে script চালান।")

    # 1. Backup
    shutil.copy2(STORE_PY, BACKUP)
    print(f"✅ Backup: {BACKUP}")

    with open(STORE_PY, "r", encoding="utf-8") as f:
        src = f.read()

    # 2. Already patched?
    if "create_zinipay_invoice" in src:
        die("Already patched! আবার patch করার দরকার নাই।")

    # 3. Add helper after last `import` line (flexible matching)
    import_lines = [m for m in re.finditer(r'^(?:import |from )\S.*$', src, re.MULTILINE)]
    if not import_lines:
        die("Kono import line pawa jayni — manual check dorkar")
    last_import = import_lines[-1]
    insert_pos = last_import.end()
    src = src[:insert_pos] + "\n" + NEW_HELPER + src[insert_pos:]
    print("✅ Helper function add hoyechhe (after last import)")

    # 4. Replace dep_start function
    pat_start = re.compile(
        r'@dp\.callback_query\(F\.data == "deposit"\)\s*\n'
        r'async def dep_start\(.*?\n'
        r'(?=@dp\.message\(ShopStates\.waiting_for_deposit_num\))',
        re.DOTALL
    )
    if not pat_start.search(src):
        die("dep_start handler পাওয়া যায়নি — manual check দরকার")
    src = pat_start.sub(NEW_DEP_START + "\n", src, count=1)
    print("✅ dep_start replaced (3 option menu)")

    # 5. Replace dep_amt function
    pat_amt = re.compile(
        r'@dp\.message\(ShopStates\.waiting_for_deposit_amount\)\s*\n'
        r'async def dep_amt\(.*?\n'
        r'(?=@dp\.message\(ShopStates\.waiting_for_screenshot\))',
        re.DOTALL
    )
    if not pat_amt.search(src):
        die("dep_amt handler পাওয়া যায়নি — manual check দরকার")
    src = pat_amt.sub(NEW_DEP_AMT + "\n", src, count=1)
    print("✅ dep_amt replaced (auto + manual branch)")

    # 6. Write
    with open(STORE_PY, "w", encoding="utf-8") as f:
        f.write(src)

    # 7. Syntax check
    try:
        py_compile.compile(STORE_PY, doraise=True)
        print("✅ Syntax OK")
    except py_compile.PyCompileError as e:
        print(f"❌ Syntax error! Restoring backup...")
        shutil.copy2(BACKUP, STORE_PY)
        die(f"Compile error: {e}")

    print(f"\n🎉 Patch successful!\n")
    print(f"   • Backup saved: {BACKUP}")
    print(f"   • Restart bot:  pm2 restart bot && pm2 logs bot --lines 30")
    print(f"   • Revert if needed: cp {BACKUP} {STORE_PY} && pm2 restart bot\n")


if __name__ == "__main__":
    main()
