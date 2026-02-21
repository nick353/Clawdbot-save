#!/usr/bin/env python3
"""
Adobe Podcastサイトを詳細に調査して、アップロードボタンのセレクタを特定
"""

from playwright.sync_api import sync_playwright
import time

def investigate_adobe_podcast():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,  # VPS環境のためヘッドレスモード
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        )
        
        context = browser.new_context()
        page = context.new_page()
        
        try:
            print("📡 Adobe Podcastにアクセス中...")
            page.goto("https://podcast.adobe.com/enhance", wait_until="networkidle", timeout=60000)
            
            print("⏳ ページ読み込み待機中...")
            time.sleep(10)  # 追加の待機時間
            
            # スクリーンショット1: ページ全体
            page.screenshot(path="/tmp/adobe-podcast-full.png", full_page=True)
            print("✅ スクリーンショット保存: /tmp/adobe-podcast-full.png")
            
            # HTML全体を取得
            html = page.content()
            with open("/tmp/adobe-podcast.html", "w") as f:
                f.write(html)
            print("✅ HTML保存: /tmp/adobe-podcast.html")
            
            # input要素を探す
            print("\n🔍 input要素を探索中...")
            inputs = page.locator('input').all()
            print(f"見つかったinput要素: {len(inputs)}個")
            
            for i, input_elem in enumerate(inputs):
                try:
                    input_type = input_elem.get_attribute('type')
                    input_id = input_elem.get_attribute('id')
                    input_class = input_elem.get_attribute('class')
                    input_accept = input_elem.get_attribute('accept')
                    print(f"  [{i}] type={input_type}, id={input_id}, class={input_class}, accept={input_accept}")
                except:
                    pass
            
            # button要素を探す
            print("\n🔍 button要素を探索中...")
            buttons = page.locator('button').all()
            print(f"見つかったbutton要素: {len(buttons)}個")
            
            for i, button in enumerate(buttons):
                try:
                    text = button.inner_text()
                    button_id = button.get_attribute('id')
                    button_class = button.get_attribute('class')
                    if text:
                        print(f"  [{i}] text='{text}', id={button_id}, class={button_class}")
                except:
                    pass
            
            # data属性を持つ要素を探す
            print("\n🔍 data-testid属性を持つ要素を探索中...")
            test_elems = page.locator('[data-testid]').all()
            print(f"見つかった要素: {len(test_elems)}個")
            
            for i, elem in enumerate(test_elems[:20]):  # 最初の20個のみ
                try:
                    testid = elem.get_attribute('data-testid')
                    tag = elem.evaluate('el => el.tagName')
                    print(f"  [{i}] tag={tag}, data-testid={testid}")
                except:
                    pass
            
            print("\n✅ 調査完了！")
            
        except Exception as e:
            print(f"❌ エラー: {e}")
        
        finally:
            browser.close()

if __name__ == "__main__":
    investigate_adobe_podcast()
