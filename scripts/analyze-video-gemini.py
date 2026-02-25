#!/usr/bin/env python3
"""
Gemini APIでローカル動画ファイルを分析してInstagram用キャプションを生成
"""
import os
import sys
import json
import time
import urllib.request
import urllib.error

def upload_video_to_gemini(video_path, api_key):
    """Upload video file to Gemini File API"""
    # Get file size
    file_size = os.path.getsize(video_path)
    
    # Step 1: Initialize upload
    init_url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={api_key}"
    
    metadata = {
        "file": {
            "display_name": os.path.basename(video_path)
        }
    }
    
    headers = {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(file_size),
        "X-Goog-Upload-Header-Content-Type": "video/mp4",
        "Content-Type": "application/json"
    }
    
    req = urllib.request.Request(
        init_url,
        data=json.dumps(metadata).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            upload_url = response.headers.get('X-Goog-Upload-URL')
            
        # Step 2: Upload file content
        with open(video_path, 'rb') as f:
            video_data = f.read()
        
        upload_headers = {
            "X-Goog-Upload-Command": "upload, finalize",
            "X-Goog-Upload-Offset": "0",
            "Content-Type": "video/mp4"
        }
        
        upload_req = urllib.request.Request(
            upload_url,
            data=video_data,
            headers=upload_headers,
            method='POST'
        )
        
        with urllib.request.urlopen(upload_req, timeout=300) as response:
            result = json.loads(response.read().decode('utf-8'))
            file_uri = result['file']['uri']
            file_name = result['file']['name']
            
        print(f"✅ 動画アップロード完了: {file_name}", file=sys.stderr)
        
        # Step 3: Wait for processing
        state_url = f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={api_key}"
        
        for i in range(30):  # Max 30 attempts (5 minutes)
            state_req = urllib.request.Request(state_url)
            with urllib.request.urlopen(state_req, timeout=10) as response:
                state = json.loads(response.read().decode('utf-8'))
                
            if state.get('state') == 'ACTIVE':
                print(f"✅ 動画処理完了", file=sys.stderr)
                return file_uri
            elif state.get('state') == 'FAILED':
                raise Exception(f"動画処理失敗: {state}")
            
            print(f"⏳ 動画処理中... ({i+1}/30)", file=sys.stderr)
            time.sleep(10)
        
        raise Exception("動画処理タイムアウト")
        
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f"アップロードエラー {e.code}: {error_body}")

def analyze_video_with_gemini(file_uri, api_key):
    """Analyze video using Gemini 2.5 Flash with video understanding"""
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [
                {
                    "fileData": {
                        "mimeType": "video/mp4",
                        "fileUri": file_uri
                    }
                },
                {
                    "text": """この動画を分析して、Instagram用の魅力的なキャプションを生成してください。

【要件】
- キャッチーな一文で始める
- 動画の内容を3-5行で簡潔に説明
- ハッシュタグ5-10個（英語＋日本語ミックス）
- 絵文字を適度に使用
- 150文字以内

【出力形式】
キャプション本文

#hashtag1 #hashtag2 #hashtag3
"""
                }
            ]
        }]
    }
    
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode('utf-8'))
            
            if 'candidates' in result and len(result['candidates']) > 0:
                parts = result['candidates'][0]['content']['parts']
                for part in parts:
                    if 'text' in part:
                        return part['text'].strip()
            else:
                raise Exception(f"分析結果なし: {result}")
                
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f"分析エラー {e.code}: {error_body}")

def main():
    if len(sys.argv) < 2:
        print("使い方: python3 analyze-video-gemini.py <動画ファイル>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    if not os.path.exists(video_path):
        print(f"❌ ファイルが見つかりません: {video_path}")
        sys.exit(1)
    
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY環境変数が設定されていません")
        sys.exit(1)
    
    try:
        print(f"📹 動画分析開始: {video_path}", file=sys.stderr)
        
        # Upload video
        file_uri = upload_video_to_gemini(video_path, api_key)
        
        # Analyze video
        caption = analyze_video_with_gemini(file_uri, api_key)
        
        # Output caption
        print(caption)
        
    except Exception as e:
        print(f"❌ エラー: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
