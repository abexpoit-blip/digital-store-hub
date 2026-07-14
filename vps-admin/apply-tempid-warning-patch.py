#!/usr/bin/env python3
"""
=====================================================================
 Temp ID Purchase Warning Patch for store.py
=====================================================================
 কী করে?
   • Temp ID কেনার সাথে সাথে user কে extra warning message পাঠায়
   • Message: Replace time 2 hour, verify হলে replace নাই,
     শুধু login issue হলে replace সম্ভব

 কোথায় inject করে?
   • line ~991 এ delivery message ("আপনার ... প্রোডাক্ট") এর পরে
   • condition: cat == 'tempid' হলেই

 চালানো:
   cd /root
   python3 /root/digital-store-hub/vps-admin/apply-tempid-warning-patch.py
   pm2 restart bot && pm2 logs bot --lines 25 --nostream

 Revert:
   cp store.py.backup-tempid-warn-<timestamp> store.py && pm2 restart bot
=====================================================================
"""
import os, sys, shutil, time, re, py_compile

STORE_PY = "store.py"
BACKUP   = f"{STORE_PY}.backup-tempid-warn-{int(time.time())}"

MARKER = "# [TEMPID_WARN_PATCH]"

# The delivery line pattern (line ~991)
# _lbl = {...}.get(cat, cat.upper()); await m.answer(f"🆔 **আপনার {_lbl} প্রোডাক্ট:**")
DELIVERY_RE = re.compile(
    r'^(?P<indent>[ \t]*)(_lbl\s*=\s*\{[^}]*"tempid"[^}]*\}[^;\n]*;\s*await\s+m\.answer\(f"🆔[^"\n]*"\))[ \t]*$',
    re.MULTILINE
)

def die(m): print(f"\n❌ {m}\n"); sys.exit(1)

def main():
    if not os.path.exists(STORE_PY):
        die(f"{STORE_PY} এই folder এ নাই। `cd /root` করে চালান।")

    with open(STORE_PY, "r", encoding="utf-8") as f:
        src = f.read()

    if MARKER in src:
        die("Already patched! আবার patch করার দরকার নাই।")

    m = DELIVERY_RE.search(src)
    if not m:
        die("Delivery message line (line ~991) খুঁজে পাওয়া যায়নি — store.py structure ভিন্ন।")

    shutil.copy2(STORE_PY, BACKUP)
    print(f"✅ Backup: {BACKUP}")

    indent = m.group("indent")
    warning_block = (
        f'\n{indent}{MARKER}\n'
        f'{indent}if cat == "tempid":\n'
        f'{indent}    await m.answer(\n'
        f'{indent}        "⚠️ **Temp ID — গুরুত্বপূর্ণ নিয়ম**\\n\\n"\n'
        f'{indent}        "⏱ Replace time: **2 ঘণ্টা**\\n\\n"\n'
        f'{indent}        "❌ Verify হয়ে গেলে replace **হবে না**\\n"\n'
        f'{indent}        "✅ শুধু **login issue** হলে replace সম্ভব\\n\\n"\n'
        f'{indent}        "নিয়মের বাইরে replace request দিলে **reject** করা হবে।"\n'
        f'{indent}    )\n'
    )

    # insert right after the delivery line
    new_src = src[:m.end()] + warning_block + src[m.end():]

    with open(STORE_PY, "w", encoding="utf-8") as f:
        f.write(new_src)
    print("✅ Warning message inject হয়েছে (delivery line এর পরে)")

    try:
        py_compile.compile(STORE_PY, doraise=True)
        print("✅ Syntax OK")
    except py_compile.PyCompileError as e:
        shutil.copy2(BACKUP, STORE_PY)
        die(f"Compile error, backup restored: {e}")

    print(f"\n🎉 Done!")
    print(f"   • Backup: {BACKUP}")
    print(f"   • Restart: pm2 restart bot && pm2 logs bot --lines 20 --nostream")
    print(f"   • Revert:  cp {BACKUP} {STORE_PY} && pm2 restart bot\n")

if __name__ == "__main__":
    main()
