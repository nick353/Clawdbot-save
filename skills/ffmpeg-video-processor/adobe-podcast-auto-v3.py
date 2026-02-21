#!/usr/bin/env python3
"""
Adobe Podcast Enhance自動化 v3
Cookie認証対応版
"""

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import time
import sys
import json
from pathlib import Path

def load_cookies(cookie_file):
    """EditThisCookie形式のCookieをPlaywright形式に変換"""
    with open(cookie_file, 'r') as f:
        cookies = json.load(f)
    
    playwright_cookies = []
    for cookie in cookies:
        playwright_cookie = {
            'name': cookie['name'],
            'value': cookie['value'],
            'domain': cookie['domain'],
            'path': cookie['path'],
        }
        
        # オプショナルフィールド
        if 'expirationDate' in cookie:
            playwright_cookie['expires'] = int(cookie['expirationDate'])
        if 'httpOnly' in cookie:
            playwright_cookie['httpOnly'] = cookie['httpOnly']
        if 'secure' in cookie:
            playwright_cookie['secure'] = cookie['secure']
        if 'sameSite' in cookie and cookie['sameSite'] != 'unspecified':
            # sameSiteの値をマッピング
            sameSite_map = {
                'no_restriction': 'None',
                'lax': 'Lax',
                'strict': 'Strict'
            }
            sameSite = sameSite_map.get(cookie['sameSite'], 'Lax')
            playwright_cookie['sameSite'] = sameSite
        
        playwright_cookies.append(playwright_cookie)
    
    return playwright_cookies

def enhance_audio(input_file, output_file, cookie_file, timeout=300000):
    """Adobe Podcast Enhanceで音声を処理（Cookie認証）"""
    
    input_path = Path(input_file).resolve()
    output_path = Path(output_file).resolve()
    cookie_path = Path(cookie_file).resolve()
    
    if not input_path.exists():
        print(f"❌ エラー: 入力ファイルが見つかりません: {input_path}")
        sys.exit(1)
    
    if not cookie_path.exists():
        print(f"❌ エラー: Cookieファイルが見つかりません: {cookie_path}")
        sys.exit(1)
    
    print(f"🎵 Adobe Podcast Enhance v3（Cookie認証）で音声を処理中...")
    print(f"入力: {input_path}")
    print(f"出力: {output_path}")
    print(f"Cookie: {cookie_path}")
    
    # Cookieを読み込み
    print("🍪 Cookieを読み込み中...")
    cookies = load_cookies(cookie_path)
    print(f"✅ {len(cookies)}個のCookieを読み込みました")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        )
        
        # Cookieを設定してコンテキスト作成
        context = browser.new_context()
        context.add_cookies(cookies)
        
        page = context.new_page()
        
        try:
            # Adobe Podcastにアクセス
            print("📡 Adobe Podcastにアクセス中...")
            page.goto("https://podcast.adobe.com/enhance", wait_until="networkidle", timeout=60000)
            
            # JavaScriptレンダリングを待機
            print("⏳ ページレンダリング待機中（10秒）...")
            page.wait_for_timeout(10000)
            
            # スクリーンショット（デバッグ用）
            page.screenshot(path="/tmp/adobe-podcast-with-cookies.png", full_page=True)
            print("📸 スクリーンショット保存: /tmp/adobe-podcast-with-cookies.png")
            
            # ファイル入力要素を探す
            print("🔍 ファイル入力要素を探索中...")
            
            # 複数の方法で探索
            selectors_to_try = [
                'input[type="file"]',
                'input[accept*="audio"]',
                'input[accept*="wav"]',
                '[data-testid*="upload"]',
                '[data-testid*="file"]',
            ]
            
            file_input = None
            for selector in selectors_to_try:
                try:
                    elements = page.locator(selector).all()
                    if len(elements) > 0:
                        print(f"  ✅ 発見: {selector} ({len(elements)}個)")
                        file_input = elements[0]
                        break
                except:
                    continue
            
            if file_input is None:
                print("❌ ファイル入力要素が見つかりませんでした")
                print("\n🔍 ページ内のすべてのinput要素:")
                all_inputs = page.locator('input').all()
                for i, inp in enumerate(all_inputs):
                    try:
                        inp_type = inp.get_attribute('type')
                        inp_id = inp.get_attribute('id')
                        inp_class = inp.get_attribute('class')
                        print(f"  [{i}] type={inp_type}, id={inp_id}, class={inp_class}")
                    except:
                        pass
                
                browser.close()
                sys.exit(1)
            
            # ファイルをアップロード
            print("📤 ファイルをアップロード中...")
            file_input.set_input_files(str(input_path))
            print("✅ アップロード完了")
            
            # アップロード処理を待機
            print("⏳ アップロード処理待機中（10秒）...")
            page.wait_for_timeout(10000)
            
            # 処理完了を待機
            print("⏳ Adobe Podcast処理待機中（最大5分）...")
            
            # Downloadボタンを探す
            download_selectors = [
                'button:has-text("Download")',
                'a:has-text("Download")',
                'button:has-text("download")',
                'a:has-text("download")',
                '[aria-label*="Download"]',
                '[aria-label*="download"]',
            ]
            
            downloaded = False
            for selector in download_selectors:
                try:
                    print(f"  - {selector}を探索中...")
                    download_btn = page.locator(selector).first
                    download_btn.wait_for(state="visible", timeout=timeout)
                    print(f"  ✅ ダウンロードボタン発見: {selector}")
                    
                    # ダウンロード
                    with page.expect_download() as download_info:
                        download_btn.click()
                    
                    download = download_info.value
                    download.save_as(str(output_path))
                    downloaded = True
                    print(f"✅ ダウンロード完了: {output_path}")
                    break
                    
                except PlaywrightTimeoutError:
                    continue
                except Exception as e:
                    print(f"  - エラー: {e}")
                    continue
            
            if not downloaded:
                print("❌ ダウンロードボタンが見つかりませんでした")
                page.screenshot(path="/tmp/adobe-podcast-final-v3.png", full_page=True)
                print("📸 最終スクリーンショット: /tmp/adobe-podcast-final-v3.png")
                browser.close()
                sys.exit(1)
            
        except Exception as e:
            print(f"❌ エラー: {e}")
            page.screenshot(path="/tmp/adobe-podcast-error-v3.png", full_page=True)
            print("📸 エラースクリーンショット: /tmp/adobe-podcast-error-v3.png")
            browser.close()
            sys.exit(1)
        
        finally:
            browser.close()
    
    print("🎉 音声処理が完了しました！")
    return str(output_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使い方: ./adobe-podcast-auto-v3.py <input.wav> <output.wav> [cookie.json]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    cookie_file = sys.argv[3] if len(sys.argv) > 3 else "adobe-cookies.json"
    
    enhance_audio(input_file, output_file, cookie_file)
