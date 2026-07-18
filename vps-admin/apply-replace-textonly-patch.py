#!/usr/bin/env python3
"""
Replace System: Text-only + Format Validation Patch (V1)
---------------------------------------------------------
✅ File/Photo/Document/Video/Voice/Sticker সব block
✅ প্রতিটি line-এ format check: UID PASSWORD COOKIES
✅ COOKIES-এ minimum ১টা "=" থাকতে হবে (cookie format)
✅ ভুল লাইন-এর exact number সহ error দেখাবে
✅ Warning message আরো strict + clear
✅ Retry allowed — state clear হবে না ভুল হলে

Deploy:
  cd /root/digital-store-hub
  git pull
  python3 vps-admin/apply-replace-textonly-patch.py
  pm2 restart nexus-bot
"""
import shutil, time, os, sys, py_compile

STORE = "/root/store.py"
BACKUP = f"{STORE}.bak.replfmt.{int(time.time())}"

if not os.path.exists(STORE):
    print(f"❌ {STORE} not found"); sys.exit(1)

src = open(STORE, "r", encoding="utf-8").read()

MARK = "# [REPLACE_TEXTONLY_PATCH_V1]"
if MARK in src:
    print("ℹ️  Already patched."); sys.exit(0)

shutil.copy(STORE, BACKUP)
print(f"✅ Backup: {BACKUP}")

# --- 1) Update the warning message (line ~1804-1810) ---
OLD_WARN_LINE = 'f"২. **Format:** রিপ্লেসের জন্য অবশ্যই **UID | PASS | COOKIES** এই ফরমেটে একাউন্ট সাবমিট করতে হবে। শুধু UID বা Cookie দিলে রিকোয়েস্ট রিজেক্ট করা হবে।\\n"'

NEW_WARN_LINE = '''f"২. **Format:** রিপ্লেসের জন্য অবশ্যই **UID PASS COOKIES** এই format-এ (space-separated) submit করতে হবে।\\n"
        f"৩. **শুধু TEXT accept হবে** — File / Photo / Screenshot / Document / Voice পাঠালে auto-reject।\\n"
        f"৪. **Multiple ID:** প্রতি লাইনে একটা ID (UID PASS COOKIES)।\\n"
        f"৫. **Format ভুল** হলে বা কোনো field missing হলে reject।\\n"'''

if OLD_WARN_LINE in src:
    src = src.replace(OLD_WARN_LINE, NEW_WARN_LINE, 1)
    print("✅ Warning message updated (stricter rules)")
else:
    print("⚠️  Warning line not found — skipping (not fatal)")

# --- 2) Update the prompt line (1815) ---
OLD_PROMPT = '''await c.message.edit_text("✍️ **আপনার নষ্ট আইডিগুলো দিন:**\\n*(একাধিক আইডি থাকলে নিচে নিচে দিন)*")'''

NEW_PROMPT = '''await c.message.edit_text(
        "✍️ **নষ্ট আইডিগুলো text আকারে দিন:**\\n\\n"
        "📌 **Format (প্রতি লাইনে):**\\n"
        "`UID PASSWORD COOKIES`\\n\\n"
        "📝 **Example:**\\n"
        "`100011... myPass123 datr=xxx; c_user=100011...; xs=...`\\n\\n"
        "⚠️ File / Photo / Screenshot পাঠালে **auto-reject**।\\n"
        "একাধিক ID হলে প্রতি লাইনে একটা করে দিন।"
    )'''

if OLD_PROMPT in src:
    src = src.replace(OLD_PROMPT, NEW_PROMPT, 1)
    print("✅ Prompt message updated")
else:
    print("⚠️  Prompt line not found — skipping")

# --- 3) Replace the process_replace_request handler ---
OLD_HANDLER_HEAD = '''@dp.message(ShopStates.waiting_for_replace_data)
async def process_replace_request(m: types.Message, state: FSMContext):
    if m.text and m.text.startswith("/"): return

    ticket_id = str(uuid.uuid4())[:8]
    user_data_text = m.text

    lines = [line for line in user_data_text.split('\\n') if line.strip()]
    acc_count_warning = f"⚠️ __ইউজার {len(lines)} টি একাউন্ট দিয়েছে!__" if len(lines) > 1 else ""'''

NEW_HANDLER_HEAD = '''@dp.message(ShopStates.waiting_for_replace_data)
async def process_replace_request(m: types.Message, state: FSMContext):
    # [REPLACE_TEXTONLY_PATCH_V1]
    # ---- Layer 1: block non-text (file/photo/doc/video/voice/sticker/etc) ----
    if m.content_type != "text" or not m.text:
        return await m.answer(
            "❌ **File / Photo / Screenshot / Document accept হবে না।**\\n\\n"
            "📝 শুধু **text** paste করুন এই format-এ:\\n"
            "`UID PASSWORD COOKIES`\\n\\n"
            "আবার চেষ্টা করুন অথবা /cancel দিন।"
        )

    if m.text.startswith("/"): return

    user_data_text = m.text.strip()

    # ---- Layer 2: per-line format validation ----
    raw_lines = [ln.strip() for ln in user_data_text.split("\\n") if ln.strip()]
    if not raw_lines:
        return await m.answer("❌ খালি text। UID PASS COOKIES format-এ দিন।")

    _errors = []
    for _i, _ln in enumerate(raw_lines, 1):
        _parts = _ln.split(None, 2)   # split into max 3 parts (UID, PASS, rest=COOKIES)
        if len(_parts) < 3:
            _errors.append(f"  • Line {_i}: শুধু {len(_parts)}টা field পাওয়া গেছে (দরকার 3 — UID PASS COOKIES)")
            continue
        _uid, _pw, _ck = _parts
        if len(_uid) < 3:
            _errors.append(f"  • Line {_i}: UID খুব ছোট ({_uid!r})")
        if len(_pw) < 3:
            _errors.append(f"  • Line {_i}: PASSWORD খুব ছোট")
        if "=" not in _ck:
            _errors.append(f"  • Line {_i}: COOKIES format ভুল (কোনো `=` নেই, যেমন `datr=...; c_user=...`)")

    if _errors:
        _err_txt = "\\n".join(_errors[:10])
        _more = f"\\n  ... আরো {len(_errors)-10}টা error" if len(_errors) > 10 else ""
        return await m.answer(
            f"❌ **Format Error** ({len(_errors)}টা issue পেলাম):\\n\\n"
            f"{_err_txt}{_more}\\n\\n"
            f"✅ সঠিক format:\\n"
            f"`UID PASSWORD COOKIES`\\n\\n"
            f"প্রতি লাইনে একটা ID দিয়ে আবার পাঠান, অথবা /cancel দিন।"
        )

    # ---- All valid, proceed with original flow ----
    ticket_id = str(uuid.uuid4())[:8]
    lines = raw_lines
    acc_count_warning = f"⚠️ __ইউজার {len(lines)} টি একাউন্ট দিয়েছে!__" if len(lines) > 1 else ""'''

if OLD_HANDLER_HEAD in src:
    src = src.replace(OLD_HANDLER_HEAD, NEW_HANDLER_HEAD, 1)
    print("✅ Handler patched (text-only + format validation)")
else:
    print("❌ Handler block not found. Manual review needed.")
    print("   Backup restored path:", BACKUP)
    sys.exit(2)

# --- 4) Write + syntax check ---
open(STORE, "w", encoding="utf-8").write(src)
try:
    py_compile.compile(STORE, doraise=True)
    print("✅ Syntax OK")
except py_compile.PyCompileError as e:
    print("❌ Syntax error — restoring backup")
    shutil.copy(BACKUP, STORE)
    print(e); sys.exit(3)

print("\n🎉 Done!")
print("Deploy: pm2 restart nexus-bot && pm2 logs nexus-bot --lines 30 --nostream")
