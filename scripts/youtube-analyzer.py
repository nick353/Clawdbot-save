#!/usr/bin/env python3
import os
import json
import urllib.request
import urllib.error

def analyze_youtube_with_gemini(video_url, api_key):
    """Analyze YouTube video directly with Gemini API"""
    
    # Gemini 2.5 Flash - latest stable multimodal model
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{
                "text": f"""この YouTube 動画を詳細に分析してください: {video_url}

以下の点を含めて日本語で回答してください:
1. 動画の主なテーマと内容
2. 重要なポイント（箇条書き）
3. 具体的な手法や戦略（もしあれば）
4. 実用的な学びや洞察

動画タイトル: 6万円→20億円をライブで証明した伝説の男 "ロス・キャメロン" のトレード手法、完全まとめ！
"""
            }]
        }]
    }
    
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
            
            if 'candidates' in result and len(result['candidates']) > 0:
                parts = result['candidates'][0]['content']['parts']
                for part in parts:
                    if 'text' in part:
                        print(part['text'])
            else:
                print("分析結果が取得できませんでした")
                print(json.dumps(result, indent=2, ensure_ascii=False))
                
    except urllib.error.HTTPError as e:
        print(f"HTTPエラー {e.code}:")
        error_data = json.loads(e.read().decode('utf-8'))
        print(json.dumps(error_data, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"エラー: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    video_url = "https://youtu.be/ax7EnPl4gfM"
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        print("GEMINI_API_KEY が設定されていません")
        exit(1)
    
    print("動画分析中...")
    analyze_youtube_with_gemini(video_url, api_key)
