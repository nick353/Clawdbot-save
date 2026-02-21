#!/usr/bin/env python3
# adobe-podcast-enhance.py - Adobe Podcast自動音声処理
# 作成: リッキー 🐥

import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

def enhance_audio_with_adobe(input_file, output_file, timeout=180):
    """
    Adobe Podcastで音声を自動処理
    
    Args:
        input_file: 入力音声ファイル（WAV）
        output_file: 出力音声ファイル（WAV）
        timeout: タイムアウト（秒）
    """
    input_path = Path(input_file).resolve()
    output_path = Path(output_file).resolve()
    
    if not input_path.exists():
        raise FileNotFoundError(f"入力ファイルが見つかりません: {input_file}")
    
    print(f"🎵 Adobe Podcastで音声処理を開始...")
    print(f"入力: {input_path}")
    print(f"出力: {output_path}")
    
    with sync_playwright() as p:
        # ブラウザ起動（ヘッドレスモード）
        print("🌐 ブラウザ起動中...")
        browser = p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        
        try:
            # 新しいページを開く
            page = browser.new_page()
            
            # Adobe Podcast Enhanceにアクセス
            print("📱 Adobe Podcast Enhanceにアクセス中...")
            page.goto('https://podcast.adobe.com/enhance', wait_until='networkidle', timeout=30000)
            
            # ページが読み込まれるまで少し待機
            time.sleep(2)
            
            # ファイルアップロード
            print("📤 ファイルをアップロード中...")
            
            # ファイル入力要素を探す
            file_input = page.locator('input[type="file"]').first
            if not file_input.is_visible(timeout=10000):
                # 別のセレクタを試す
                file_input = page.locator('input[accept*="audio"]').first
            
            # ファイルをアップロード
            file_input.set_input_files(str(input_path))
            
            print("⏳ 処理完了を待機中...")
            print("   (音声の長さによって1-3分かかります)")
            
            # 処理完了を待機（ダウンロードボタンが表示されるまで）
            # 複数のセレクタを試す
            download_button = None
            selectors = [
                'button:has-text("Download")',
                'a:has-text("Download")',
                '[aria-label*="Download"]',
                'button[download]',
                'a[download]'
            ]
            
            for selector in selectors:
                try:
                    download_button = page.locator(selector).first
                    download_button.wait_for(state='visible', timeout=timeout * 1000)
                    print(f"✅ 処理完了！（セレクタ: {selector}）")
                    break
                except PlaywrightTimeout:
                    continue
            
            if download_button is None:
                raise Exception("ダウンロードボタンが見つかりませんでした")
            
            # ダウンロード
            print("📥 処理済みファイルをダウンロード中...")
            
            with page.expect_download(timeout=30000) as download_info:
                download_button.click()
            
            download = download_info.value
            download.save_as(str(output_path))
            
            print(f"✅ ダウンロード完了: {output_path}")
            print(f"   ファイルサイズ: {output_path.stat().st_size / 1024 / 1024:.2f} MB")
            
        except Exception as e:
            print(f"❌ エラー: {e}")
            
            # デバッグ用にスクリーンショットを保存
            try:
                screenshot_path = output_path.parent / "adobe_error_screenshot.png"
                page.screenshot(path=str(screenshot_path))
                print(f"   スクリーンショット保存: {screenshot_path}")
            except:
                pass
            
            raise
        
        finally:
            browser.close()
            print("🌐 ブラウザを終了しました")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使い方: python3 adobe-podcast-enhance.py <input.wav> <output.wav>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    try:
        enhance_audio_with_adobe(input_file, output_file)
        print("\n🎉 Adobe Podcast処理が完了しました！")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 処理失敗: {e}")
        sys.exit(1)
