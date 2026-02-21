#!/usr/bin/env python3
"""Adobe Podcast API自動音声改善"""

import requests
import json
import time
import sys
import os

def enhance_audio(audio_file, output_file):
    token = os.environ.get('ADOBE_PODCAST_TOKEN')
    
    if not token:
        print("❌ ADOBE_PODCAST_TOKEN が設定されていません")
        return False
    
    # アップロード
    upload_url = "https://podcast.adobe.com/api/v1/upload"
    headers = {"Authorization": f"Bearer {token}"}
    
    with open(audio_file, 'rb') as f:
        files = {'audio': f}
        print("  → アップロード中...")
        response = requests.post(upload_url, headers=headers, files=files)
    
    if response.status_code != 200:
        print(f"❌ アップロード失敗: {response.status_code}")
        print(response.text)
        return False
    
    result = response.json()
    job_id = result.get('jobId') or result.get('id')
    
    if not job_id:
        print(f"❌ JobIDなし: {result}")
        return False
    
    print(f"  → JobID: {job_id}")
    
    # ポーリング
    status_url = f"https://podcast.adobe.com/api/v1/jobs/{job_id}"
    max_attempts = 60
    
    for attempt in range(max_attempts):
        time.sleep(5)
        
        status_response = requests.get(status_url, headers=headers)
        status_data = status_response.json()
        
        status = status_data.get('status')
        print(f"  → ステータス: {status} ({attempt + 1}/{max_attempts})")
        
        if status == 'completed':
            download_url = status_data.get('downloadUrl') or status_data.get('output')
            
            if download_url:
                print("  → ダウンロード中...")
                download_response = requests.get(download_url)
                
                with open(output_file, 'wb') as f:
                    f.write(download_response.content)
                
                print(f"✅ 完了: {output_file}")
                return True
            else:
                print("❌ ダウンロードURLなし")
                return False
        
        elif status == 'failed':
            error = status_data.get('error', 'Unknown error')
            print(f"❌ 失敗: {error}")
            return False
    
    print("❌ タイムアウト")
    return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使い方: python3 adobe-api-v2.py <input_audio> <output_audio>")
        sys.exit(1)
    
    input_audio = sys.argv[1]
    output_audio = sys.argv[2]
    
    success = enhance_audio(input_audio, output_audio)
    sys.exit(0 if success else 1)
