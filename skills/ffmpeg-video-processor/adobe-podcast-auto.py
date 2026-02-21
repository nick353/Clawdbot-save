#!/usr/bin/env python3
"""
adobe-podcast-auto.py - Adobe Podcast Enhanceの完全自動化
Playwrightを使用してアップロード→処理→ダウンロードを自動化
作成: リッキー 🐥
"""

import os
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
except ImportError:
    print("❌ Playwrightがインストールされていません")
    print("インストール中...")
    os.system("pip3 install playwright")
    os.system("playwright install chromium")
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

def enhance_audio(input_file, output_file, timeout=300000):
    """
    Adobe Podcast Enhanceで音声を処理
    
    Args:
        input_file: 入力音声ファイル（WAV推奨）
        output_file: 出力音声ファイル
        timeout: タイムアウト（ミリ秒、デフォルト5分）
    """
    
    input_path = Path(input_file).resolve()
    output_path = Path(output_file).resolve()
    
    if not input_path.exists():
        print(f"❌ エラー: 入力ファイルが見つかりません: {input_path}")
        sys.exit(1)
    
    print(f"🎵 Adobe Podcast Enhanceで音声を処理中...")
    print(f"入力: {input_path}")
    print(f"出力: {output_path}")
    
    with sync_playwright() as p:
        # ブラウザを起動（ヘッドレスモード）
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        )
        
        context = browser.new_context()
        page = context.new_page()
        
        try:
            # Adobe Podcastにアクセス
            print("📡 Adobe Podcastにアクセス中...")
            page.goto("https://podcast.adobe.com/enhance", wait_until="domcontentloaded")
            page.wait_for_timeout(5000)
            
            # ファイルアップロード
            print("📤 ファイルをアップロード中...")
            
            # 様々なセレクタを試す
            upload_selectors = [
                'input[type="file"]',
                'input[accept*="audio"]',
                '[data-testid="file-input"]',
                '.file-input',
            ]
            
            uploaded = False
            for selector in upload_selectors:
                try:
                    upload_input = page.locator(selector).first
                    if upload_input.count() > 0:
                        upload_input.set_input_files(str(input_path))
                        uploaded = True
                        print(f"✅ アップロード成功（セレクタ: {selector}）")
                        break
                except Exception as e:
                    continue
            
            if not uploaded:
                print("❌ アップロードボタンが見つかりません")
                # スクリーンショットを保存
                page.screenshot(path="/tmp/adobe-podcast-error.png")
                print("スクリーンショット保存: /tmp/adobe-podcast-error.png")
                raise Exception("Upload button not found")
            
            print("⏳ 処理中...")
            page.wait_for_timeout(5000)
            
            # 処理完了を待機
            print("⏳ Adobe Podcastの処理を待機中...")
            
            # "Download" ボタンが表示されるまで待機
            try:
                download_button = page.locator('button:has-text("Download")').first
                download_button.wait_for(state="visible", timeout=timeout)
                print("✅ 処理完了！")
            except PlaywrightTimeoutError:
                print("❌ タイムアウト: 処理に時間がかかりすぎています")
                browser.close()
                sys.exit(1)
            
            # ダウンロード
            print("📥 ダウンロード中...")
            
            with page.expect_download() as download_info:
                download_button.click()
            
            download = download_info.value
            download.save_as(str(output_path))
            
            print(f"✅ ダウンロード完了: {output_path}")
            
        except Exception as e:
            print(f"❌ エラー: {e}")
            browser.close()
            sys.exit(1)
        
        finally:
            browser.close()
    
    print("🎉 音声処理が完了しました！")
    return str(output_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使い方: ./adobe-podcast-auto.py <input.wav> <output.wav>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    enhance_audio(input_file, output_file)
