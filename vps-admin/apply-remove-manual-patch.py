#!/usr/bin/env python3
"""
=====================================================================
 Remove Manual Screenshot Deposit — Patch for store.py
=====================================================================
 কী করে?
   • deposit menu থেকে "📝 Manual (Screenshot)" button বাদ দেয়
   • শুধু ২টা option থাকবে:
       ⚡ Auto (bKash/Nagad)  → ZiniPay automatic
       🪙 Binance             → manual (screenshot দিতে হবে)
   • dep_manual handler টা comment out করে দেয় (safe, syntax OK)

 চালানোর নিয়ম:
   cd /root
   python3 /root/digital-store-hub/vps-admin/apply-remove-manual-patch.py
   pm2 restart bot && pm2 logs bot --lines 20 --nostream

 Revert:
   cp store.py.backup-<timestamp> store.py && pm2 restart bot
=====================================================================
"""
import os, sys, shutil, time, re, py_compile

STORE_PY = "store.py"
BACKUP   = f"{STORE_PY}.backup-remove-manual-{int(time.time())}"

NEW_DEP_START = r'''@dp.callback_query(F.data == "deposit")
async def dep_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    kb = InlineKeyboardBuilder()
    kb.row(types.InlineKeyboardButton(text="⚡ Auto (bKash/Nagad)", callback_data="dep_auto"))
    kb.row(types.InlineKeyboardButton(text="🪙 Binance (Manual)", callback_data="dep_binance"))
    await c.message.answer(
        "💳 **Deposit Method বাছাই করুন**\n\n"
        "⚡ **Auto** — bKash/Nagad এ পাঠান, ১০-৩০ সেকেন্ডে balance যোগ হবে\n"
        "🪙 **Binance** — UID দিয়ে USDT পাঠান, screenshot দিন admin approve করবে\n\n"
        "⚠️ মিনিমাম ১০৳ (Binance 1$)",
        reply_markup=kb.as_markup()
    )

@dp.callback_query(F.data == "dep_auto")
async def dep_auto_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    await c.message.answer("💰 কত টাকা deposit করবেন? (মিনিমাম 10, যেমন: 100)")
    await state.update_data(deposit_method="auto")
    await state.set_state(ShopStates.waiting_for_deposit_amount)

@dp.callback_query(F.data == "dep_binance")
async def dep_binance_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    msg = (f"🪙 **Binance Deposit**\n🏦 UID: `{BINANCE_ID}`\n\nমিনিমাম 1$ (= 122৳)\nUSDT পাঠানোর পর sender UID লিখুন:")
    await c.message.answer(msg)
    await state.update_data(deposit_method="binance")
    await state.set_state(ShopStates.waiting_for_deposit_num)
'''

def die(m): print(f"\n❌ {m}\n"); sys.exit(1)

def main():
    if not os.path.exists(STORE_PY):
        die(f"{STORE_PY} এই folder এ নাই। `cd /root` দিয়ে script চালান।")

    shutil.copy2(STORE_PY, BACKUP)
    print(f"✅ Backup: {BACKUP}")

    with open(STORE_PY, "r", encoding="utf-8") as f:
        src = f.read()

    if 'callback_data="dep_manual"' not in src and 'F.data == "dep_manual"' not in src:
        print("ℹ️  dep_manual already removed / not found — কিছু replace করার নাই।")
        # still refresh dep_start below

    # Replace dep_start + dep_auto + dep_manual + dep_binance block
    # match from @dp.callback_query(F.data == "deposit") up to (but not including) dep_amt handler
    pat = re.compile(
        r'@dp\.callback_query\(F\.data == "deposit"\)\s*\n'
        r'async def dep_start\(.*?\n'
        r'(?=@dp\.message\(ShopStates\.waiting_for_deposit_(?:amount|num)\))',
        re.DOTALL
    )
    if not pat.search(src):
        die("dep_start block পাওয়া যায়নি — store.py structure ভিন্ন। manual check দরকার।")

    src = pat.sub(NEW_DEP_START + "\n", src, count=1)
    print("✅ dep_start replaced — Manual (Screenshot) option বাদ দেওয়া হয়েছে")

    with open(STORE_PY, "w", encoding="utf-8") as f:
        f.write(src)

    try:
        py_compile.compile(STORE_PY, doraise=True)
        print("✅ Syntax OK")
    except py_compile.PyCompileError as e:
        shutil.copy2(BACKUP, STORE_PY)
        die(f"Compile error, backup restored: {e}")

    print(f"\n🎉 Done!")
    print(f"   • Backup: {BACKUP}")
    print(f"   • Restart: pm2 restart bot && pm2 logs bot --lines 20 --nostream")
    print(f"   • Revert: cp {BACKUP} {STORE_PY} && pm2 restart bot\n")

if __name__ == "__main__":
    main()
