# =====================================================================
#  ZiniPay Automatic Deposit Integration for store.py
#  ভাই এই snippet টা আপনার store.py এ যোগ করতে হবে। নিচের ৩টা section follow করুন।
# =====================================================================
#
# ---------------------------------------------------------------------
# SECTION 1: file এর উপরে (other imports এর পাশে) যোগ করুন
# ---------------------------------------------------------------------
import os, requests

VPS_ADMIN_URL    = os.environ.get("VPS_ADMIN_URL", "http://localhost:3000")
DOWNLOAD_SECRET  = os.environ.get("DOWNLOAD_SECRET", "")  # admin panel এর সাথে same

def create_zinipay_invoice(user_id: int, username: str, amount: int):
    """admin panel এর /zinipay/create-invoice কে call করে — returns payment_url or None"""
    try:
        r = requests.post(
            f"{VPS_ADMIN_URL}/zinipay/create-invoice",
            json={
                "secret":   DOWNLOAD_SECRET,
                "user_id":  user_id,
                "username": username,
                "amount":   int(amount),
            },
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


# ---------------------------------------------------------------------
# SECTION 2: existing `dep_start` handler টা পুরোপুরি replace করুন
# (line ~978 এ আছে — `@dp.callback_query(F.data == "deposit")`)
# ---------------------------------------------------------------------
@dp.callback_query(F.data == "deposit")
async def dep_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    kb = InlineKeyboardBuilder()
    kb.row(types.InlineKeyboardButton(text="⚡ Auto (bKash/Nagad)", callback_data="dep_auto"))
    kb.row(types.InlineKeyboardButton(text="📝 Manual (Screenshot)", callback_data="dep_manual"))
    kb.row(types.InlineKeyboardButton(text="🪙 Binance", callback_data="dep_binance"))
    await c.message.answer(
        "💳 **Deposit Method বাছাই করুন**\n\n"
        "⚡ **Auto** — bKash/Nagad এ পাঠিয়ে দিন, ব্যালেন্স ১০ সেকেন্ডে যোগ হবে\n"
        "📝 **Manual** — screenshot দিন, admin manually approve করবে\n"
        "🪙 **Binance** — UID দিয়ে USDT পাঠান\n\n"
        "⚠️ মিনিমাম ১০৳ (Binance 1$)",
        reply_markup=kb.as_markup()
    )


# --- AUTO PAYMENT (ZiniPay) ----
@dp.callback_query(F.data == "dep_auto")
async def dep_auto_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    await c.message.answer("💰 কত টাকা deposit করবেন? (মিনিমাম 10, যেমন: 100)")
    await state.set_state(ShopStates.waiting_for_deposit_amount)
    await state.update_data(deposit_method="auto")


# --- MANUAL (পুরানো flow — অপরিবর্তিত) ----
@dp.callback_query(F.data == "dep_manual")
async def dep_manual_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    msg = (f"📝 **Manual Deposit**\n1️⃣ Bkash: `{BKASH_NUMBER}`\n2️⃣ Nagad: `{NAGAD_NUMBER}`\n\n"
           f"⚠️ মিনিমাম ১০৳\nটাকা পাঠানোর পর sender নাম্বার লিখুন:")
    await c.message.answer(msg)
    await state.set_state(ShopStates.waiting_for_deposit_num)
    await state.update_data(deposit_method="manual")


@dp.callback_query(F.data == "dep_binance")
async def dep_binance_start(c: types.CallbackQuery, state: FSMContext):
    await c.answer()
    msg = (f"🪙 **Binance Deposit**\nUID: `{BINANCE_ID}`\nমিনিমাম 1$ (= 122৳)\n\nUSDT পাঠানোর পর sender UID লিখুন:")
    await c.message.answer(msg)
    await state.set_state(ShopStates.waiting_for_deposit_num)
    await state.update_data(deposit_method="binance")


# ---------------------------------------------------------------------
# SECTION 3: existing `dep_amt` handler এ একটা branch add করুন
# (line ~995 এ আছে — `@dp.message(ShopStates.waiting_for_deposit_amount)`)
# নিচের কোডটা পুরো function টা replace করবে
# ---------------------------------------------------------------------
@dp.message(ShopStates.waiting_for_deposit_amount)
async def dep_amt(m: types.Message, state: FSMContext):
    if m.text.startswith("/"): return
    val_str = to_english_num(m.text).strip()
    data = await state.get_data()
    method = data.get("deposit_method", "manual")

    # --- AUTO (ZiniPay) branch ---
    if method == "auto":
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
            f"✅ **Invoice Ready**\n💰 Amount: *{amt}৳*\n\n"
            "নিচের button এ ক্লিক করে bKash/Nagad এ পেমেন্ট করুন।\n"
            "পেমেন্ট হলে ১০-৩০ সেকেন্ডে automatic balance যোগ হবে।",
            reply_markup=kb.as_markup()
        )
        await state.clear()
        return

    # --- BINANCE / MANUAL branch (পুরানো logic) ---
    if '$' in val_str or 'usd' in val_str.lower():
        try:
            num = float(''.join(filter(lambda x: x.isdigit() or x == '.', val_str)))
            if num < 1: return await m.answer("⚠️ Binance মিনিমাম ১ ডলার।")
            bdt_amount = int(num * 122)
            await state.update_data(amount_text=str(bdt_amount))
            await m.answer(f"💵 $1 = 122৳ হিসেবে: **{bdt_amount}৳**\n\n📸 পেমেন্টের স্ক্রিনশট দিন (বাধ্যতামূলক)")
        except: return await m.answer("⚠️ সঠিক পরিমাণ লিখুন (যেমন: 1$)")
    elif val_str.isdigit():
        if int(val_str) < 10: return await m.answer("⚠️ মিনিমাম ১০ টাকা।")
        await state.update_data(amount_text=val_str)
        await m.answer("📸 পেমেন্টের স্ক্রিনশট দিন (বাধ্যতামূলক)")
    else:
        return await m.answer("⚠️ সংখ্যায় লিখুন (যেমন: 50 অথবা 1$)")
    await state.set_state(ShopStates.waiting_for_screenshot)


# ---------------------------------------------------------------------
# SECTION 4 (optional): /start এ ?start=paid বা ?start=cancel handle
# ---------------------------------------------------------------------
# আপনার existing /start handler এ এই check টা যোগ করুন:
#
# @dp.message(CommandStart(deep_link=True))
# async def start_deep(m: types.Message, command: CommandObject):
#     arg = command.args
#     if arg == "paid":
#         await m.answer("✅ Payment received! ব্যালেন্স কিছুক্ষণে যোগ হবে।")
#     elif arg == "cancel":
#         await m.answer("❌ Payment cancelled। আবার চেষ্টা করুন।")
#     # ... তারপর normal /start flow চালু রাখুন
