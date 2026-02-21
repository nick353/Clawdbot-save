#!/usr/bin/env python3
"""
Instagram 投稿スクリプト - instagrapi版
モバイルAPIを使用 → VPSでも安定動作

環境変数:
  IG_USERNAME: Instagramユーザー名 (デフォルト: nisen_prints)
  IG_PASSWORD: Instagramパスワード (必須)

Usage: python3 post-to-instagram-instagrapi.py <image_path> <caption>
"""

import sys
import os
import json
from pathlib import Path

image_path = sys.argv[1] if len(sys.argv) > 1 else None
caption = sys.argv[2] if len(sys.argv) > 2 else None
ig_username = os.environ.get('IG_USERNAME', 'nisen_prints')
ig_password = os.environ.get('IG_PASSWORD')

if not image_path or not caption:
    print("使い方: python3 post-to-instagram-instagrapi.py <image_path> <caption>")
    sys.exit(1)

if not os.path.exists(image_path):
    print(f"❌ 画像が見つかりません: {image_path}")
    sys.exit(1)

if not ig_password:
    print("❌ IG_PASSWORD 環境変数が設定されていません")
    sys.exit(1)

from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ChallengeRequired, TwoFactorRequired

SCRIPT_DIR = Path(__file__).parent
SESSION_FILE = SCRIPT_DIR / f"session-{ig_username}.json"

print(f"📸 Instagram 投稿開始（instagrapi版）...")
print(f"👤 ユーザー: {ig_username}")
print(f"🖼️  画像: {image_path}")
print(f"📝 キャプション: {caption[:80]}...")

cl = Client()
cl.delay_range = [1, 3]  # リクエスト間隔（レート制限対策）

# ─── Step 1: ログイン ───
def login():
    if SESSION_FILE.exists():
        print(f"📂 セッションを読み込み中: {SESSION_FILE}")
        try:
            cl.load_settings(str(SESSION_FILE))
            cl.login(ig_username, ig_password)
            print("✅ セッション再利用でログイン成功")
            return True
        except LoginRequired:
            print("⚠️  セッションが無効 → 新規ログイン")
            SESSION_FILE.unlink(missing_ok=True)

    print("🔐 新規ログイン中...")
    try:
        cl.login(ig_username, ig_password)
        cl.dump_settings(str(SESSION_FILE))
        print(f"✅ ログイン成功（セッション保存: {SESSION_FILE}）")
        return True
    except ChallengeRequired as e:
        print(f"⚠️  チャレンジ認証が必要: {e}")
        print("   Instagramアプリで認証を完了してから再試行してください")
        return False
    except TwoFactorRequired:
        print("⚠️  2段階認証が必要です")
        return False
    except Exception as e:
        print(f"❌ ログインエラー: {e}")
        return False

if not login():
    sys.exit(1)

# ─── Step 2: 画像投稿 ───
print("\n📤 画像を投稿中...")
try:
    from PIL import Image
    # Instagram要件: 正方形または指定比率、JPEG
    img = Image.open(image_path)
    w, h = img.size
    
    # 正方形にクロップ（必要な場合）
    if w != h:
        size = min(w, h)
        left = (w - size) // 2
        top = (h - size) // 2
        img = img.crop((left, top, left + size, top + size))
        print(f"✂️  正方形にクロップ: {size}x{size}")
    
    # JPEGに変換
    prepared_path = "/tmp/ig-upload-prepared.jpg"
    img.convert("RGB").save(prepared_path, "JPEG", quality=95)
    print(f"✅ 画像準備完了: {prepared_path}")
    upload_path = prepared_path
    
except ImportError:
    print("⚠️  PIL未インストール、元画像をそのまま使用")
    upload_path = image_path

try:
    media = cl.photo_upload(
        path=upload_path,
        caption=caption
    )
    print(f"\n🎉 投稿成功！")
    print(f"📎 メディアID: {media.id}")
    print(f"🔗 URL: https://www.instagram.com/p/{media.code}/")
    
    # 新しいCookieをJSONに保存（他スクリプト用）
    cookies_path = SCRIPT_DIR / "cookies" / "instagram.json"
    try:
        settings = cl.get_settings()
        # cookiesをPuppeteer形式に変換して保存
        import time
        puppeteer_cookies = []
        for name, value in (settings.get('cookies') or {}).items():
            puppeteer_cookies.append({
                "name": name,
                "value": str(value),
                "domain": ".instagram.com",
                "path": "/",
                "httpOnly": False,
                "secure": True,
                "expires": int(time.time()) + 365 * 24 * 3600
            })
        if puppeteer_cookies:
            with open(cookies_path, 'w') as f:
                json.dump(puppeteer_cookies, f, indent=2)
            print(f"✅ Cookieも更新しました ({len(puppeteer_cookies)}件)")
    except Exception as e:
        print(f"⚠️  Cookie更新スキップ: {e}")
    
    sys.exit(0)
    
except Exception as e:
    print(f"❌ 投稿エラー: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
