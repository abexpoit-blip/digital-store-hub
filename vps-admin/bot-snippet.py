# =====================================================================
# Bot এ এই function টা add করুন (যেকোনো জায়গায়, যেমন helpers section এ)
# Replace request টা web admin panel এ পাঠাবে।
# =====================================================================
import sqlite3, time

def save_replace_request(user_id, username, category, old_data, reason=""):
    """User এর replace request DB তে save করে — web panel এ admin দেখবে।"""
    conn = sqlite3.connect('store.db')
    try:
        # Table টা web panel auto-create করে, কিন্তু safety জন্য আবার ensure করি
        conn.execute("""
            CREATE TABLE IF NOT EXISTS replace_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT,
                category TEXT,
                old_data TEXT,
                reason TEXT,
                status TEXT DEFAULT 'pending',
                created_at INTEGER NOT NULL,
                collected_at INTEGER
            )
        """)
        conn.execute(
            "INSERT INTO replace_requests (user_id, username, category, old_data, reason, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, 'pending', ?)",
            (user_id, username or '', category or '', old_data or '', reason or '', int(time.time() * 1000))
        )
        conn.commit()
    finally:
        conn.close()


# ======================================================================
# এখন আপনার existing replace handler এ শুধু এই এক লাইন add করতে হবে।
# উদাহরণ — ShopStates.waiting_for_replace_data এর handler এ:
#
# @dp.message(ShopStates.waiting_for_replace_data)
# async def receive_replace_data(message: types.Message, state: FSMContext):
#     data = await state.get_data()
#     category = data.get('replace_category', 'unknown')
#     old_data = message.text or ''
#
#     # ↓ এই লাইন add করুন ↓
#     save_replace_request(
#         user_id=message.from_user.id,
#         username=f"@{message.from_user.username}" if message.from_user.username else message.from_user.first_name,
#         category=category,
#         old_data=old_data,
#         reason="user requested replace"
#     )
#
#     await message.answer("✅ Replace request পেয়েছি। Admin শীঘ্রই আপনাকে দিবে।")
#     # ... admin notification আগের মতই থাকবে
#     await state.clear()
# ======================================================================
