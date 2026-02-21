#!/usr/bin/env python3
"""
WaveSpeedAI Sora動画処理スクリプト（正しい実装）
1. 動画アップロード
2. ウォーターマーク除去
3. 画質向上
"""

import requests
import json
import time
import sys
import os

def upload_file(api_key, file_path):
    """ファイルをWaveSpeedAIにアップロード"""
    print(f"📤 動画アップロード中: {file_path}")
    
    url = "https://api.wavespeed.ai/api/v3/media/upload/binary"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    with open(file_path, 'rb') as f:
        files = {"file": f}
        response = requests.post(url, headers=headers, files=files)
    
    if response.status_code != 200:
        print(f"❌ アップロード失敗: {response.status_code}")
        print(response.text)
        return None
    
    result = response.json()
    data = result.get("data", {})
    file_url = data.get("download_url") or data.get("url") or result.get("url")
    
    if not file_url:
        print(f"❌ URLなし: {result}")
        return None
    
    print(f"✅ アップロード完了: {file_url}")
    return file_url

def remove_watermark(api_key, video_url):
    """ウォーターマーク除去"""
    print(f"🧹 ウォーターマーク除去中...")
    
    url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-watermark-remover"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {"video": video_url}
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code not in [200, 201]:
        print(f"❌ タスク作成失敗: {response.status_code}")
        print(response.text)
        return None
    
    result = response.json()
    task_id = result.get("data", {}).get("id") or result.get("id")
    
    if not task_id:
        print(f"❌ タスクIDなし: {result}")
        return None
    
    print(f"  → タスクID: {task_id}")
    
    # ポーリング
    get_url = f"https://api.wavespeed.ai/api/v3/predictions/{task_id}/result"
    max_attempts = 60
    
    for attempt in range(max_attempts):
        time.sleep(10)
        
        status_response = requests.get(get_url, headers=headers)
        status_data = status_response.json()
        
        data = status_data.get("data", status_data)
        status = data.get("status")
        
        print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
        
        if status == "completed":
            outputs = data.get("outputs", [])
            if outputs:
                output_url = outputs[0]
                print(f"✅ 完了: {output_url}")
                return output_url
            else:
                print(f"❌ 出力URLなし")
                return None
        
        elif status == "failed":
            error = data.get("error", "Unknown error")
            print(f"❌ 失敗: {error}")
            return None
    
    print(f"❌ タイムアウト")
    return None

def upscale_video(api_key, video_url):
    """画質向上"""
    print(f"🎨 画質向上中...")
    
    url = "https://api.wavespeed.ai/api/v3/wavespeed-ai/video-upscaler-pro"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "video": video_url,
        "scale": 2
    }
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code not in [200, 201]:
        print(f"❌ タスク作成失敗: {response.status_code}")
        print(response.text)
        return None
    
    result = response.json()
    task_id = result.get("data", {}).get("id") or result.get("id")
    
    if not task_id:
        print(f"❌ タスクIDなし: {result}")
        return None
    
    print(f"  → タスクID: {task_id}")
    
    # ポーリング
    get_url = f"https://api.wavespeed.ai/api/v3/predictions/{task_id}/result"
    max_attempts = 60
    
    for attempt in range(max_attempts):
        time.sleep(10)
        
        status_response = requests.get(get_url, headers=headers)
        status_data = status_response.json()
        
        data = status_data.get("data", status_data)
        status = data.get("status")
        
        print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
        
        if status == "completed":
            outputs = data.get("outputs", [])
            if outputs:
                output_url = outputs[0]
                print(f"✅ 完了: {output_url}")
                return output_url
            else:
                print(f"❌ 出力URLなし")
                return None
        
        elif status == "failed":
            error = data.get("error", "Unknown error")
            print(f"❌ 失敗: {error}")
            return None
    
    print(f"❌ タイムアウト")
    return None

def download_file(url, output_path):
    """ファイルダウンロード"""
    print(f"💾 ダウンロード中: {output_path}")
    
    response = requests.get(url, stream=True)
    
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"✅ 保存完了: {output_path}")

def main():
    if len(sys.argv) < 3:
        print("使い方: python3 wavespeed-correct.py <input_video> <output_video>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    api_key = os.environ.get("WAVESPEED_API_KEY")
    if not api_key:
        print("❌ エラー: WAVESPEED_API_KEY が設定されていません")
        sys.exit(1)
    
    print("🎬 WaveSpeedAI処理開始")
    print(f"入力: {input_file}")
    print(f"出力: {output_file}")
    print("")
    
    # ステップ1: アップロード
    video_url = upload_file(api_key, input_file)
    if not video_url:
        sys.exit(1)
    
    # ステップ2: ウォーターマーク除去
    cleaned_url = remove_watermark(api_key, video_url)
    if not cleaned_url:
        sys.exit(1)
    
    # ステップ3: 画質向上
    upscaled_url = upscale_video(api_key, cleaned_url)
    if not upscaled_url:
        sys.exit(1)
    
    # ステップ4: ダウンロード
    download_file(upscaled_url, output_file)
    
    print("")
    print("✅ 全処理完了！")
    print(f"出力ファイル: {output_file}")

if __name__ == "__main__":
    main()
