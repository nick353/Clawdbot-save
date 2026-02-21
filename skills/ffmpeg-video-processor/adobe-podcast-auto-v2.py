#!/usr/bin/env python3
"""
Adobe Podcast Enhance自動化 v2
JavaScriptレンダリングを考慮した改良版
"""

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import time
import sys
from pathlib import Path

def enhance_audio(input_file, output_file, timeout=300000):
    """Adobe Podcast Enhanceで音声を処理"""
    
    input_path = Path(input_file).resolve()
    output_path = Path(output_file).resolve()
    
    if not input_path.exists():
        print(f"❌ エラー: 入力ファイルが見つかりません: {input_path}")
        sys.exit(1)
    
    print(f"🎵 Adobe Podcast Enhance v2で音声を処理中...")
    print(f"入力: {input_path}")
    print(f"出力: {output_path}")
    
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
        
        context = browser.new_context()
        page = context.new_page()
        
        try:
            # Adobe Podcastにアクセス
            print("📡 Adobe Podcastにアクセス中...")
            page.goto("https://podcast.adobe.com/enhance", timeout=60000)
            
            # JavaScriptレンダリングを待機
            print("⏳ ページレンダリング待機中（30秒）...")
            page.wait_for_timeout(30000)
            
            # スクリーンショット（デバッグ用）
            page.screenshot(path="/tmp/adobe-podcast-loaded.png", full_page=True)
            print("📸 スクリーンショット保存: /tmp/adobe-podcast-loaded.png")
            
            # 様々な方法でinput[type="file"]を探す
            print("🔍 ファイル入力要素を探索中...")
            
            # 方法1: 一般的なfile input
            file_inputs = page.locator('input[type="file"]').all()
            print(f"  - 見つかったfile input: {len(file_inputs)}個")
            
            if len(file_inputs) > 0:
                print("✅ File inputを発見！アップロード中...")
                file_inputs[0].set_input_files(str(input_path))
                uploaded = True
            else:
                # 方法2: 隠されたinputを探す
                print("  - 隠されたinputを探索中...")
                all_inputs = page.locator('input').all()
                print(f"  - 全input要素: {len(all_inputs)}個")
                
                for inp in all_inputs:
                    try:
                        inp_type = inp.get_attribute('type')
                        if inp_type == 'file' or inp.get_attribute('accept'):
                            print(f"  ✅ 隠されたfile inputを発見！")
                            inp.set_input_files(str(input_path))
                            uploaded = True
                            break
                    except:
                        continue
                
                if not uploaded:
                    # 方法3: ドラッグ&ドロップエリアを探す
                    print("  - ドラッグ&ドロップエリアを探索中...")
                    drop_zones = [
                        '[role="button"]',
                        '.drop-zone',
                        '[data-testid*="upload"]',
                        '[data-testid*="file"]',
                    ]
                    
                    for selector in drop_zones:
                        try:
                            elements = page.locator(selector).all()
                            if len(elements) > 0:
                                print(f"  - {selector}: {len(elements)}個見つかりました")
                        except:
                            pass
                    
                    print("❌ アップロード方法が見つかりませんでした")
                    print("\n💡 代替案: 手動アップロードモード")
                    print(f"  1. ブラウザでhttps://podcast.adobe.com/enhanceを開く")
                    print(f"  2. {input_path}をアップロード")
                    print(f"  3. 処理完了後、{output_path}に保存")
                    browser.close()
                    sys.exit(1)
            
            print("⏳ アップロード処理待機中...")
            page.wait_for_timeout(10000)
            
            # 処理完了を待機
            print("⏳ Adobe Podcast処理待機中（最大5分）...")
            
            # Downloadボタンを探す
            download_selectors = [
                'button:has-text("Download")',
                'a:has-text("Download")',
                '[data-testid*="download"]',
                'button:has-text("download")',
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
                page.screenshot(path="/tmp/adobe-podcast-final.png", full_page=True)
                print("📸 最終スクリーンショット: /tmp/adobe-podcast-final.png")
                browser.close()
                sys.exit(1)
            
        except Exception as e:
            print(f"❌ エラー: {e}")
            page.screenshot(path="/tmp/adobe-podcast-error-v2.png", full_page=True)
            print("📸 エラースクリーンショット: /tmp/adobe-podcast-error-v2.png")
            browser.close()
            sys.exit(1)
        
        finally:
            browser.close()
    
    print("🎉 音声処理が完了しました！")
    return str(output_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使い方: ./adobe-podcast-auto-v2.py <input.wav> <output.wav>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    enhance_audio(input_file, output_file)
