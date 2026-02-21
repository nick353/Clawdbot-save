#!/usr/bin/env python3
# debug-adobe-page.py - Adobe Podcastページ構造調査
# 作成: リッキー 🐥

from playwright.sync_api import sync_playwright
import time

def debug_adobe_page():
    """Adobe Podcastのページ構造をデバッグ"""
    
    with sync_playwright() as p:
        print("🌐 ブラウザ起動中...")
        browser = p.chromium.launch(
            headless=True,  # VPS環境のためヘッドレス
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        page = browser.new_page()
        
        print("📱 Adobe Podcast Enhanceにアクセス中...")
        page.goto('https://podcast.adobe.com/enhance', wait_until='networkidle', timeout=60000)
        
        # ページが完全に読み込まれるまで待機
        print("⏳ ページ読み込み待機中...")
        time.sleep(5)
        
        # スクリーンショット保存
        print("📸 スクリーンショット保存...")
        page.screenshot(path='/tmp/adobe_page_loaded.png', full_page=True)
        
        # ページのHTMLを保存
        print("💾 HTML保存...")
        html = page.content()
        with open('/tmp/adobe_page.html', 'w', encoding='utf-8') as f:
            f.write(html)
        
        # すべてのinput要素を探す
        print("\n🔍 input要素を検索中...")
        inputs = page.locator('input').all()
        print(f"   見つかったinput要素: {len(inputs)}個")
        
        for i, inp in enumerate(inputs):
            try:
                input_type = inp.get_attribute('type')
                input_accept = inp.get_attribute('accept')
                input_id = inp.get_attribute('id')
                input_class = inp.get_attribute('class')
                print(f"   [{i}] type={input_type}, accept={input_accept}, id={input_id}, class={input_class}")
            except:
                pass
        
        # すべてのbutton要素を探す
        print("\n🔍 button要素を検索中...")
        buttons = page.locator('button').all()
        print(f"   見つかったbutton要素: {len(buttons)}個")
        
        for i, btn in enumerate(buttons[:10]):  # 最初の10個のみ
            try:
                btn_text = btn.inner_text()
                btn_class = btn.get_attribute('class')
                print(f"   [{i}] text={btn_text}, class={btn_class}")
            except:
                pass
        
        # ページタイトルとURL
        print(f"\n📄 ページタイトル: {page.title()}")
        print(f"📄 現在のURL: {page.url}")
        
        print("\n✅ デバッグ完了")
        print("   スクリーンショット: /tmp/adobe_page_loaded.png")
        print("   HTML: /tmp/adobe_page.html")
        
        browser.close()

if __name__ == "__main__":
    debug_adobe_page()
